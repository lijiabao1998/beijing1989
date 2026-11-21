import type { PhotoCaptureRecord } from '../save/save';
import type { SceneId } from '../types';

const esc = (s: string) => s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));

function hash2d(x: number, y: number, seed: number): number {
  let n = (x * 374761393 + y * 668265263 + seed * 1442695041) | 0;
  n = (n ^ (n >>> 13)) * 1274126177;
  return (n ^ (n >>> 16)) >>> 0;
}

/**
 * Emulate 1989 Lucky/Gongyuan 400 (樂凱/公元 400) silver-gelatin B&W darkroom contact print
 * directly from the rendered 3D WebGL frame (480x320 35mm 3:2 aspect, compact JPEG).
 */
export function captureSilverGelatinPhoto(
  sourceCanvas: HTMLCanvasElement,
  opts: {
    id: string;
    frameNo: number;
    chapterId: string;
    sceneId: SceneId;
    dateLabel: string;
    lensMm: 35 | 50 | 85;
    caption: string;
  }
): PhotoCaptureRecord {
  const W = 480;
  const H = 320;
  let dataUrl = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';

  try {
    const out = document.createElement('canvas');
    out.width = W;
    out.height = H;
    const g = out.getContext('2d');
    if (g) {
      const sw = sourceCanvas.width || W;
      const sh = sourceCanvas.height || H;
      const targetAspect = W / H;
      const srcAspect = sw / sh;
      let sx = 0;
      let sy = 0;
      let cropW = sw;
      let cropH = sh;
      if (srcAspect > targetAspect) {
        cropW = Math.round(sh * targetAspect);
        sx = Math.round((sw - cropW) / 2);
      } else {
        cropH = Math.round(sw / targetAspect);
        sy = Math.round((sh - cropH) / 2);
      }

      g.fillStyle = '#0e0d0c';
      g.fillRect(0, 0, W, H);
      g.drawImage(sourceCanvas, sx, sy, cropW, cropH, 0, 0, W, H);

      const img = g.getImageData(0, 0, W, H);
      const d = img.data;
      const cx = W * 0.5;
      const cy = H * 0.5;
      const invR2 = 1 / (cx * cx + cy * cy);

      for (let y = 0; y < H; y++) {
        const dy = y - cy;
        for (let x = 0; x < W; x++) {
          const idx = (y * W + x) * 4;
          const r = d[idx]!;
          const gr = d[idx + 1]!;
          const b = d[idx + 2]!;
          // Panchromatic 35mm emulsion weighting + subtle red-filter sky separation
          let lum = (0.31 * r + 0.59 * gr + 0.10 * b) / 255;
          // Classic S-curve contrast (deep shadow toe + crisp silver highlights)
          lum = lum < 0.5
            ? 0.5 * Math.pow(2 * lum, 1.34)
            : 1 - 0.5 * Math.pow(2 * (1 - lum), 1.30);
          lum = 0.045 + 0.93 * lum;

          const dx = x - cx;
          const r2 = (dx * dx + dy * dy) * invR2;
          const vig = 1 - 0.34 * r2;
          const grain = (((hash2d(x, y, opts.frameNo) & 255) / 255) - 0.5) * 0.085;
          const v = Math.max(0, Math.min(1, lum * vig + grain));

          // Warm fiber-base silver-gelatin selenium tone
          d[idx] = Math.min(255, Math.round(v * 255 * 1.015));
          d[idx + 1] = Math.min(255, Math.round(v * 255 * 0.995));
          d[idx + 2] = Math.min(255, Math.round(v * 255 * 0.945));
          d[idx + 3] = 255;
        }
      }
      g.putImageData(img, 0, 0);

      // Subtle 1989 LED databack stamp in corner
      const dateNums = opts.dateLabel.match(/\d+/g);
      const stamp = dateNums && dateNums.length >= 2
        ? `'89 ${dateNums[dateNums.length - 2]!.padStart(2, '0')} ${dateNums[dateNums.length - 1]!.padStart(2, '0')}`
        : `'89 SPRING`;
      g.font = 'bold 12px monospace';
      g.textAlign = 'right';
      g.fillStyle = 'rgba(255, 168, 86, 0.72)';
      g.fillText(stamp, W - 12, H - 10);

      dataUrl = out.toDataURL('image/jpeg', 0.78);
    }
  } catch {
    // fallback placeholder kept above
  }

  return {
    id: opts.id,
    frameNo: opts.frameNo,
    chapterId: opts.chapterId,
    sceneId: opts.sceneId,
    dateLabel: opts.dateLabel,
    lensMm: opts.lensMm,
    caption: opts.caption,
    dataUrl,
    selectedForPrint: opts.frameNo <= 4,
    takenAt: Date.now(),
  };
}

function sprocketRowHtml(count = 16): string {
  return `<div class="dr-sprockets" aria-hidden="true">${'<span></span>'.repeat(count)}</div>`;
}

export function renderDarkroomHtml(photos: PhotoCaptureRecord[], safelight = false): string {
  const count = photos.length;
  const header = `
    <div class="dr-head">
      <div>
        <strong>暗房接觸印相片（Lucky Pan 400 ・ 35mm）</strong>
        <span class="small">共顯影 ${count} 格底片｜點擊任一格放大檢視與輸出</span>
      </div>
      <div class="dr-actions">
        <button type="button" id="dr-safelight-toggle" class="${safelight ? 'on' : ''}">${safelight ? '燈箱白光檢視' : '暗房安全紅燈'}</button>
      </div>
    </div>`;

  if (!count) {
    return `<div class="dr-wrap${safelight ? ' safelight' : ''}">
      ${header}
      <div class="dr-empty">
        <p>顯影盤裡還沒有底片。</p>
        <p class="small">在探索街道、校園、長安街或胡同時，隨時按下鍵盤 <strong>F</strong> 或點擊上方「取景 (F)」舉起 35mm 相機，按下快門即可在此沖印出銀鹽黑白底片。</p>
      </div>
    </div>`;
  }

  const strips: string[] = [];
  for (let i = 0; i < photos.length; i += 6) {
    const chunk = photos.slice(i, i + 6);
    const framesHtml = chunk.map((p, idx) => {
      const num = String(p.frameNo || i + idx + 1).padStart(2, '0');
      return `<button type="button" class="dr-frame${p.selectedForPrint ? ' selected' : ''}${i === 0 && idx === 0 ? ' active' : ''}" data-dr-id="${esc(p.id)}-${idx + i}" data-dr-idx="${i + idx}">
        <span class="dr-edge">${num}A ・ ${p.lensMm}mm</span>
        <img src="${esc(p.dataUrl)}" alt="${esc(p.caption)}" />
        <span class="dr-cap">${esc(p.caption)}</span>
        ${p.selectedForPrint ? '<span class="dr-mark" title="已勾選入冊">✓ 入冊</span>' : ''}
      </button>`;
    }).join('');
    strips.push(`<div class="dr-strip">
      ${sprocketRowHtml(18)}
      <div class="dr-frames">${framesHtml}</div>
      ${sprocketRowHtml(18)}
    </div>`);
  }

  const first = photos[0]!;
  return `<div class="dr-wrap${safelight ? ' safelight' : ''}">
    ${header}
    <div class="dr-strips">${strips.join('')}</div>
    <div class="dr-loupe" id="dr-loupe">
      <div class="dr-print-paper">
        <img id="dr-loupe-img" src="${esc(first.dataUrl)}" alt="${esc(first.caption)}" />
        <div class="dr-print-meta">
          <strong id="dr-loupe-cap">${esc(first.caption)}</strong>
          <span class="small" id="dr-loupe-info">#${String(first.frameNo).padStart(2, '0')}A ｜ ${first.lensMm}mm 鏡頭 ｜ ${esc(first.dateLabel || first.sceneId)}</span>
        </div>
      </div>
      <div class="dr-loupe-ctrl">
        <button type="button" id="dr-select-print" class="${first.selectedForPrint ? 'on' : ''}">${first.selectedForPrint ? '✓ 已勾選放入畫冊/紀念冊' : '勾選放入畫冊/紀念冊'}</button>
        <button type="button" id="dr-download-print">下載 35mm 銀鹽相片 (PNG)</button>
      </div>
    </div>
  </div>`;
}

function downloadSilverPrintPng(photo: PhotoCaptureRecord): void {
  try {
    const img = new Image();
    img.onload = () => {
      const pw = 760;
      const ph = 560;
      const c = document.createElement('canvas');
      c.width = pw;
      c.height = ph;
      const g = c.getContext('2d');
      if (!g) return;
      g.fillStyle = '#f2ede2';
      g.fillRect(0, 0, pw, ph);
      g.strokeStyle = '#d4cbb8';
      g.lineWidth = 2;
      g.strokeRect(10, 10, pw - 20, ph - 20);
      g.fillStyle = '#121110';
      g.fillRect(36, 32, pw - 72, 452);
      g.drawImage(img, 40, 36, pw - 80, 444);
      g.fillStyle = '#241e18';
      g.font = 'bold 20px "Noto Serif CJK TC",serif';
      g.fillText(photo.caption, 40, 514);
      g.fillStyle = '#6c5c46';
      g.font = '14px monospace';
      g.fillText(
        `BEIJING 1989  •  FRAME #${String(photo.frameNo).padStart(2, '0')}A  •  ${photo.lensMm}mm  •  ${photo.dateLabel}`,
        40,
        538
      );
      const a = document.createElement('a');
      a.href = c.toDataURL('image/png');
      a.download = `beijing1989-frame-${String(photo.frameNo).padStart(2, '0')}.png`;
      a.click();
    };
    img.src = photo.dataUrl;
  } catch { /* ignore */ }
}

export function bindDarkroomModal(
  container: HTMLElement,
  photos: PhotoCaptureRecord[],
  onChange?: () => void
): () => void {
  let activeIdx = 0;
  let safelight = false;

  const wrap = container.querySelector<HTMLElement>('.dr-wrap');
  const safeBtn = container.querySelector<HTMLButtonElement>('#dr-safelight-toggle');
  const loupeImg = container.querySelector<HTMLImageElement>('#dr-loupe-img');
  const loupeCap = container.querySelector<HTMLElement>('#dr-loupe-cap');
  const loupeInfo = container.querySelector<HTMLElement>('#dr-loupe-info');
  const selBtn = container.querySelector<HTMLButtonElement>('#dr-select-print');
  const dlBtn = container.querySelector<HTMLButtonElement>('#dr-download-print');
  const frameBtns = [...container.querySelectorAll<HTMLButtonElement>('.dr-frame[data-dr-idx]')];

  const syncActive = () => {
    const p = photos[activeIdx];
    frameBtns.forEach((b, i) => {
      const rec = photos[i];
      b.classList.toggle('active', i === activeIdx);
      b.classList.toggle('selected', Boolean(rec?.selectedForPrint));
      let mark = b.querySelector('.dr-mark');
      if (rec?.selectedForPrint && !mark) {
        mark = document.createElement('span');
        mark.className = 'dr-mark';
        mark.textContent = '✓ 入冊';
        b.appendChild(mark);
      } else if (!rec?.selectedForPrint && mark) {
        mark.remove();
      }
    });
    if (!p) return;
    if (loupeImg) {
      loupeImg.src = p.dataUrl;
      loupeImg.alt = p.caption;
    }
    if (loupeCap) loupeCap.textContent = p.caption;
    if (loupeInfo) {
      loupeInfo.textContent = `#${String(p.frameNo).padStart(2, '0')}A ｜ ${p.lensMm}mm 鏡頭 ｜ ${p.dateLabel || p.sceneId}`;
    }
    if (selBtn) {
      selBtn.classList.toggle('on', Boolean(p.selectedForPrint));
      selBtn.textContent = p.selectedForPrint ? '✓ 已勾選放入畫冊/紀念冊' : '勾選放入畫冊/紀念冊';
    }
  };

  if (safeBtn && wrap) {
    safeBtn.onclick = () => {
      safelight = !safelight;
      wrap.classList.toggle('safelight', safelight);
      safeBtn.classList.toggle('on', safelight);
      safeBtn.textContent = safelight ? '燈箱白光檢視' : '暗房安全紅燈';
    };
  }

  for (const btn of frameBtns) {
    btn.onclick = () => {
      const idx = Number(btn.dataset.drIdx);
      if (Number.isFinite(idx) && photos[idx]) {
        activeIdx = idx;
        syncActive();
      }
    };
  }

  if (selBtn) {
    selBtn.onclick = () => {
      const p = photos[activeIdx];
      if (!p) return;
      p.selectedForPrint = !p.selectedForPrint;
      syncActive();
      onChange?.();
    };
  }

  if (dlBtn) {
    dlBtn.onclick = () => {
      const p = photos[activeIdx];
      if (p) downloadSilverPrintPng(p);
    };
  }

  syncActive();

  return () => {
    if (safeBtn) safeBtn.onclick = null;
    if (selBtn) selBtn.onclick = null;
    if (dlBtn) dlBtn.onclick = null;
    frameBtns.forEach(b => { b.onclick = null; });
  };
}
