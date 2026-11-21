"""
Generate cinema-grade 1980s documentary broadcast voiceover MP3 tracks for all 32 chapters.
Pipeline:
  1. Reads 32 chapters from data/events/chapters.json + src/data/routeMetas.ts (zero external data duplication).
  2. Synthesizes raw Mandarin WAV narration in a single batched Windows WinRT SpeechSynthesizer run
     (Microsoft Kangkang for student/worker/journalist routes; Microsoft Yaoyao for resident route).
  3. Masters each WAV with Python (numpy + scipy):
     - Subtle warm archival pitch/cadence resampling (0.965x male / 0.980x female)
     - 1980s broadcast EQ: 105 Hz HPF, +2.4 dB warm chest shelf @ 240 Hz, +1.8 dB clarity @ 2.7 kHz, 6.4 kHz silk LPF
     - Analog magnetic tape saturation (soft tanh drive blend)
     - Beijing wooden broadcast studio early-room IR convolution (0.22s, 10% wet) + quiet tape floor
     - RMS loudness normalization (-17 dBFS, peak-limited -1.5 dBFS) + 120 ms fades
  4. Encodes mono 48 kbps MP3s into public/audio/voice/{chapterId}.mp3 via imageio_ffmpeg.
"""

from __future__ import annotations

import json
import os
import re
import subprocess
import sys
import tempfile
import wave
from pathlib import Path

import imageio_ffmpeg
import numpy as np
from scipy import signal

ROOT = Path(__file__).resolve().parent.parent
CHAPTERS_JSON = ROOT / "data" / "events" / "chapters.json"
ROUTE_METAS_TS = ROOT / "src" / "data" / "routeMetas.ts"
OUT_DIR = ROOT / "public" / "audio" / "voice"


def parse_route_metas() -> dict[str, dict[str, str]]:
    text = ROUTE_METAS_TS.read_text(encoding="utf-8")
    out: dict[str, dict[str, str]] = {}
    # Match each chapter metadata entry block starting at `id: '...'` until the next entry or array end
    block_re = re.compile(
        r"\{\s*id:\s*'([^']+)'(.*?)(?=\n\s*\},\s*(?:\n\s*\{|\n\];))",
        re.DOTALL,
    )
    for m in block_re.finditer(text):
        cid = m.group(1)
        body = m.group(2)
        def grab(field: str) -> str:
            fm = re.search(rf"{field}:\s*'([^']*)'", body)
            return fm.group(1) if fm else ""

        beat_m = re.search(r"storyBeats:\s*\[\s*\{[^\}]*text:\s*'([^']*)'", body, re.DOTALL)
        out[cid] = {
            "dateStamp": grab("dateStamp"),
            "title": grab("title"),
            "subtitle": grab("subtitle"),
            "context": grab("context"),
            "beat0": beat_m.group(1) if beat_m else "",
        }
    return out


def build_scripts() -> list[dict[str, str]]:
    chapters_data = json.loads(CHAPTERS_JSON.read_text(encoding="utf-8"))
    metas = parse_route_metas()
    items: list[dict[str, str]] = []

    for vp, ch_list in chapters_data.get("routes", {}).items():
        for ch in ch_list:
            cid = ch["id"]
            m = metas.get(cid, {})
            date_label = m.get("dateStamp") or ch.get("date", "")
            subtitle = m.get("subtitle", "")
            beat0 = m.get("beat0") or m.get("context") or ch.get("title", {}).get("zh", cid)
            # Keep opening documentary voiceover concise & natural (~35-65 CJK chars, <= 12s)
            lead = f"{date_label}，{subtitle}。" if subtitle else f"{date_label}。"
            # Truncate multi-sentence beat0 cleanly at first or second sentence boundary
            sentences = re.split(r"(?<=[。！？])", beat0.strip())
            body = ""
            for s in sentences:
                if not s:
                    continue
                if len(body) + len(s) > 64 and body:
                    break
                body += s
                if len(body) >= 34:
                    break
            narration = f"{lead}{body}".strip()
            voice = "Yaoyao" if vp == "resident" else "Kangkang"
            items.append({
                "id": cid,
                "viewpoint": vp,
                "voice": voice,
                "text": narration,
            })
    return items


def synthesize_batch_winrt(items: list[dict[str, str]], raw_dir: Path) -> None:
    manifest_path = raw_dir / "manifest.json"
    manifest = [
        {"id": it["id"], "voice": it["voice"], "text": it["text"], "wav": str(raw_dir / f"{it['id']}.wav")}
        for it in items
    ]
    manifest_path.write_text(json.dumps(manifest, ensure_ascii=False), encoding="utf-8")

    ps_script = r'''
param([string]$ManifestPath)
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Runtime.WindowsRuntime
[void][Windows.Media.SpeechSynthesis.SpeechSynthesizer, Windows.Media.SpeechSynthesis, ContentType=WindowsRuntime]
[void][Windows.Storage.Streams.IInputStream, Windows.Storage.Streams, ContentType=WindowsRuntime]

$asTaskOp = ([System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object {
  $_.Name -eq 'AsTask' -and $_.IsGenericMethod -and $_.GetParameters().Count -eq 1 -and
  $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation`1'
})[0]

function Await-WinRT($op, [Type]$resultType) {
  $task = $asTaskOp.MakeGenericMethod($resultType).Invoke($null, @($op))
  $task.Wait(-1) | Out-Null
  return $task.Result
}

$voices = [Windows.Media.SpeechSynthesis.SpeechSynthesizer]::AllVoices
$kang = $voices | Where-Object { $_.DisplayName -match 'Kangkang' } | Select-Object -First 1
$yao  = $voices | Where-Object { $_.DisplayName -match 'Yaoyao' } | Select-Object -First 1
$hui  = $voices | Where-Object { $_.Language -match '^zh' } | Select-Object -First 1

$items = Get-Content -Raw -Encoding UTF8 $ManifestPath | ConvertFrom-Json
$synth = New-Object Windows.Media.SpeechSynthesis.SpeechSynthesizer
$synth.Options.SpeakingRate = 0.96

foreach ($it in $items) {
  if ($it.voice -eq 'Yaoyao' -and $yao) {
    $synth.Voice = $yao
    $synth.Options.AudioPitch = 0.98
  } elseif ($kang) {
    $synth.Voice = $kang
    $synth.Options.AudioPitch = 0.96
  } elseif ($hui) {
    $synth.Voice = $hui
    $synth.Options.AudioPitch = 0.97
  }
  $op = $synth.SynthesizeTextToStreamAsync($it.text)
  $stream = Await-WinRT $op ([Windows.Media.SpeechSynthesis.SpeechSynthesisStream])
  $netStream = [System.IO.WindowsRuntimeStreamExtensions]::AsStreamForRead($stream)
  $fs = [System.IO.File]::Create($it.wav)
  try {
    $netStream.CopyTo($fs)
  } finally {
    $fs.Dispose()
    $netStream.Dispose()
    $stream.Dispose()
  }
}
Write-Output ("Synthesized " + $items.Count + " raw WAVs cleanly")
'''
    ps_file = raw_dir / "synth.ps1"
    # BOM utf-8 so Windows PowerShell 5.1 reads UTF-8 params safely
    ps_file.write_text(ps_script, encoding="utf-8-sig")

    proc = subprocess.run(
        ["powershell", "-NoProfile", "-ExecutionPolicy", "Bypass", "-File", str(ps_file), "-ManifestPath", str(manifest_path)],
        capture_output=True,
        text=True,
    )
    if proc.returncode != 0:
        raise RuntimeError(f"WinRT TTS failed ({proc.returncode}):\n{proc.stdout}\n{proc.stderr}")
    print(proc.stdout.strip())


def read_wav_mono(path: Path) -> tuple[np.ndarray, int]:
    with wave.open(str(path), "rb") as wf:
        nch = wf.getnchannels()
        sw = wf.getsampwidth()
        sr = wf.getframerate()
        raw = wf.readframes(wf.getnframes())

    if sw == 2:
        data = np.frombuffer(raw, dtype=np.int16).astype(np.float64) / 32768.0
    elif sw == 1:
        data = (np.frombuffer(raw, dtype=np.uint8).astype(np.float64) - 128.0) / 128.0
    else:
        raise ValueError(f"Unsupported sample width {sw} in {path}")

    if nch > 1:
        data = data.reshape(-1, nch).mean(axis=1)
    return data, sr


def write_wav_mono(path: Path, x: np.ndarray, sr: int) -> None:
    pcm = np.clip(x * 32767.0, -32768, 32767).astype(np.int16)
    with wave.open(str(path), "wb") as wf:
        wf.setnchannels(1)
        wf.setsampwidth(2)
        wf.setframerate(sr)
        wf.writeframes(pcm.tobytes())


def peaking_eq(x: np.ndarray, sr: int, freq: float, q: float, db: float) -> np.ndarray:
    a_val = 10.0 ** (db / 40.0)
    w0 = 2.0 * np.pi * freq / sr
    alpha = np.sin(w0) / (2.0 * q)
    cw0 = np.cos(w0)
    b0 = 1.0 + alpha * a_val
    b1 = -2.0 * cw0
    b2 = 1.0 - alpha * a_val
    a0 = 1.0 + alpha / a_val
    a1 = -2.0 * cw0
    a2 = 1.0 - alpha / a_val
    return signal.lfilter([b0 / a0, b1 / a0, b2 / a0], [1.0, a1 / a0, a2 / a0], x)


def master_1980s_documentary(x: np.ndarray, sr_in: int, voice: str) -> tuple[np.ndarray, int]:
    target_sr = 24000
    # Slight pitch/cadence drop for warm documentary gravity
    pitch_ratio = 0.978 if voice == "Yaoyao" else 0.962
    effective_sr_in = int(round(sr_in * pitch_ratio))
    n_out = max(1, int(round(len(x) * target_sr / effective_sr_in)))
    x = signal.resample_poly(x, n_out, len(x)) if len(x) < 120000 else signal.resample(x, n_out)

    # Trim excess trailing/leading digital silence keeping crisp documentary breathing room
    abs_x = np.abs(x)
    nz = np.where(abs_x > 0.004)[0]
    if len(nz) > 0:
        start = max(0, int(nz[0]) - int(0.12 * target_sr))
        end = min(len(x), int(nz[-1]) + int(0.32 * target_sr))
        x = x[start:end]

    # Pre/post broadcast EQ chain
    sos_hpf = signal.butter(2, 105.0, btype="highpass", fs=target_sr, output="sos")
    x = signal.sosfilt(sos_hpf, x)
    x = peaking_eq(x, target_sr, 240.0, 0.9, 2.4)
    x = peaking_eq(x, target_sr, 2650.0, 1.2, 1.8)
    sos_lpf = signal.butter(3, 6400.0, btype="lowpass", fs=target_sr, output="sos")
    x = signal.sosfilt(sos_lpf, x)

    # Analog magnetic tape harmonic warmth
    sat = np.tanh(x * 1.45) / np.tanh(1.45)
    x = 0.65 * x + 0.35 * sat

    # Subtle Beijing studio room IR (0.22s warm early decay, 10% wet)
    rng = np.random.default_rng(1989)
    ir_len = int(0.22 * target_sr)
    t_ir = np.arange(ir_len) / target_sr
    ir = rng.normal(0.0, 1.0, ir_len) * np.exp(-t_ir / 0.055)
    ir = signal.sosfilt(signal.butter(2, 3200.0, btype="lowpass", fs=target_sr, output="sos"), ir)
    ir[0] = 0.0
    ir /= max(1e-6, np.linalg.norm(ir))
    wet = signal.fftconvolve(x, ir, mode="full")[: len(x)]
    x = x + 0.10 * wet

    # Gentle RMS leveling (-17 dBFS) + soft limiting at -1.5 dBFS
    rms = np.sqrt(np.mean(x ** 2)) + 1e-8
    gain = min(8.0, (10.0 ** (-17.0 / 20.0)) / rms)
    x *= gain
    ceil = 10.0 ** (-1.5 / 20.0)
    x = np.tanh(x / ceil) * ceil

    # Ultra-subtle -50 dB magnetic tape floor + smooth 120ms edges
    tape_noise = rng.normal(0.0, 10.0 ** (-50.0 / 20.0), len(x))
    tape_noise = signal.sosfilt(signal.butter(1, [180.0, 4200.0], btype="bandpass", fs=target_sr, output="sos"), tape_noise)
    x = x + tape_noise

    fade_in = min(int(0.06 * target_sr), len(x) // 4)
    fade_out = min(int(0.14 * target_sr), len(x) // 3)
    if fade_in > 0:
        x[:fade_in] *= np.linspace(0.0, 1.0, fade_in)
    if fade_out > 0:
        x[-fade_out:] *= np.linspace(1.0, 0.0, fade_out)

    return x, target_sr


def main() -> int:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    items = build_scripts()
    print(f"Parsed {len(items)} chapters across 4 viewpoints.")
    if len(items) != 32:
        raise RuntimeError(f"Expected 32 chapters, got {len(items)}")

    ffmpeg_exe = imageio_ffmpeg.get_ffmpeg_exe()

    with tempfile.TemporaryDirectory(prefix="b89_voice_") as tmp:
        raw_dir = Path(tmp)
        synthesize_batch_winrt(items, raw_dir)

        for idx, it in enumerate(items, 1):
            wav_in = raw_dir / f"{it['id']}.wav"
            wav_master = raw_dir / f"{it['id']}_master.wav"
            mp3_out = OUT_DIR / f"{it['id']}.mp3"

            raw_audio, sr_in = read_wav_mono(wav_in)
            mastered, sr_out = master_1980s_documentary(raw_audio, sr_in, it["voice"])
            write_wav_mono(wav_master, mastered, sr_out)

            ff = subprocess.run(
                [
                    ffmpeg_exe,
                    "-y",
                    "-v",
                    "error",
                    "-i",
                    str(wav_master),
                    "-ac",
                    "1",
                    "-ar",
                    str(sr_out),
                    "-c:a",
                    "libmp3lame",
                    "-b:a",
                    "48k",
                    str(mp3_out),
                ],
                capture_output=True,
                text=True,
            )
            if ff.returncode != 0:
                raise RuntimeError(f"ffmpeg failed for {it['id']}: {ff.stderr}")
            print(f"[{idx:02d}/32] {it['id']}.mp3 ({mp3_out.stat().st_size:,} B) [{it['voice']}] {it['text'][:24]}...")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
