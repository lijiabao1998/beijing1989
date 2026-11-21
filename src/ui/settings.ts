import type { NarratorVoiceMode } from '../play/narrator';

export type FontSizeScale = 'normal' | 'large' | 'xlarge';

export interface AppSettings {
  fontSize: FontSizeScale;
  showWhispers: boolean;
  postProcess: boolean;
  camSensitivity: 0.6 | 1.0 | 1.5;
  voiceMode: NarratorVoiceMode;
}

const STORAGE_KEY = 'beijing1989.settings.v1';

export function defaultSettings(defaultPostProcess: boolean): AppSettings {
  return {
    fontSize: 'normal',
    showWhispers: true,
    postProcess: defaultPostProcess,
    camSensitivity: 1.0,
    voiceMode: 'studio',
  };
}

export function loadSettings(defaultPostProcess: boolean): AppSettings {
  const base = defaultSettings(defaultPostProcess);
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return base;
    const parsed = JSON.parse(raw) as Partial<AppSettings>;
    if (parsed.fontSize === 'normal' || parsed.fontSize === 'large' || parsed.fontSize === 'xlarge') {
      base.fontSize = parsed.fontSize;
    }
    if (typeof parsed.showWhispers === 'boolean') base.showWhispers = parsed.showWhispers;
    if (typeof parsed.postProcess === 'boolean') base.postProcess = parsed.postProcess;
    if (parsed.camSensitivity === 0.6 || parsed.camSensitivity === 1.0 || parsed.camSensitivity === 1.5) {
      base.camSensitivity = parsed.camSensitivity;
    }
    if (parsed.voiceMode === 'studio' || parsed.voiceMode === 'tts') base.voiceMode = parsed.voiceMode;
  } catch { /* ignore corrupt storage */ }
  return base;
}

export function saveSettings(settings: AppSettings): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch { /* ignore storage quota */ }
}

export function applySettingsToDom(settings: AppSettings): void {
  if (typeof document === 'undefined') return;
  document.documentElement.dataset.fontSize = settings.fontSize;
}

export function renderSettingsPanelHtml(s: AppSettings): string {
  const fBtn = (val: FontSizeScale, lbl: string) =>
    `<button type="button" class="set-opt${s.fontSize === val ? ' on' : ''}" data-set-font="${val}">${lbl}</button>`;
  const sensBtn = (val: 0.6 | 1.0 | 1.5, lbl: string) =>
    `<button type="button" class="set-opt${s.camSensitivity === val ? ' on' : ''}" data-set-sens="${val}">${lbl}</button>`;

  return `
    <div class="set-panel">
      <div class="set-row">
        <span class="small">文字字體大小：</span>
        <div class="set-pills">${fBtn('normal', '標準')}${fBtn('large', '大字體')}${fBtn('xlarge', '特大字體')}</div>
      </div>
      <div class="set-row">
        <span class="small">鏡頭靈敏度：</span>
        <div class="set-pills">${sensBtn(0.6, '柔和')}${sensBtn(1.0, '標準')}${sensBtn(1.5, '靈敏')}</div>
      </div>
      <div class="set-row">
        <span class="small">旁白音軌來源：</span>
        <div class="set-pills">
          <button type="button" class="set-opt${s.voiceMode === 'studio' ? ' on' : ''}" data-set-voice="studio">磁帶錄音室原聲</button>
          <button type="button" class="set-opt${s.voiceMode === 'tts' ? ' on' : ''}" data-set-voice="tts">系統語音朗讀</button>
        </div>
      </div>
      <div class="set-row">
        <span class="small">畫面光暈與環境呢喃：</span>
        <div class="set-pills">
          <button type="button" id="set-pp-toggle" class="set-opt${s.postProcess ? ' on' : ''}">膠片輝光（Bloom）：${s.postProcess ? '開' : '關'}</button>
          <button type="button" id="set-whisper-toggle" class="set-opt${s.showWhispers ? ' on' : ''}">街巷低語字幕：${s.showWhispers ? '開' : '關'}</button>
        </div>
      </div>
      <details class="set-keys">
        <summary>鍵盤與取景快捷鍵一覽</summary>
        <ul>
          <li><code>W A S D</code> / 方向鍵：步行或騎車移動</li>
          <li><code>E</code> / <code>Space</code>：互動交談或取景框按下快門</li>
          <li><code>Q / R</code> 或滑鼠右鍵拖曳：旋轉攝影機視角</li>
          <li><code>C</code>：切換「電影運鏡 / 第三人稱隨行」</li>
          <li><code>F</code>：開啟或關閉 35mm 相機取景框（<code>1 2 3</code> 或 <code>V</code> 切換 35/50/85mm 焦段）</li>
          <li><code>G</code>：循環切換畫面影調（寫實膠片 / 黑白紀實 / 彩墨連環）</li>
          <li><code>M</code>：開啟街區示意圖與四線時間軸</li>
          <li><code>- / +</code>：調慢或加快自動引導倍速</li>
        </ul>
      </details>
    </div>
  `;
}

export function bindSettingsPanel(
  container: HTMLElement,
  initial: AppSettings,
  onChange: (next: AppSettings) => void,
): () => void {
  const cur: AppSettings = { ...initial };
  const fontBtns = [...container.querySelectorAll<HTMLButtonElement>('[data-set-font]')];
  const sensBtns = [...container.querySelectorAll<HTMLButtonElement>('[data-set-sens]')];
  const voiceBtns = [...container.querySelectorAll<HTMLButtonElement>('[data-set-voice]')];
  const ppBtn = container.querySelector<HTMLButtonElement>('#set-pp-toggle');
  const whBtn = container.querySelector<HTMLButtonElement>('#set-whisper-toggle');

  const emit = () => {
    saveSettings(cur);
    applySettingsToDom(cur);
    onChange({ ...cur });
  };

  fontBtns.forEach(b => {
    b.onclick = () => {
      cur.fontSize = b.dataset.setFont as FontSizeScale;
      fontBtns.forEach(x => x.classList.toggle('on', x === b));
      emit();
    };
  });
  sensBtns.forEach(b => {
    b.onclick = () => {
      const v = Number(b.dataset.setSens) as 0.6 | 1.0 | 1.5;
      cur.camSensitivity = v;
      sensBtns.forEach(x => x.classList.toggle('on', x === b));
      emit();
    };
  });
  voiceBtns.forEach(b => {
    b.onclick = () => {
      cur.voiceMode = b.dataset.setVoice as NarratorVoiceMode;
      voiceBtns.forEach(x => x.classList.toggle('on', x === b));
      emit();
    };
  });
  if (ppBtn) {
    ppBtn.onclick = () => {
      cur.postProcess = !cur.postProcess;
      ppBtn.classList.toggle('on', cur.postProcess);
      ppBtn.textContent = `膠片輝光（Bloom）：${cur.postProcess ? '開' : '關'}`;
      emit();
    };
  }
  if (whBtn) {
    whBtn.onclick = () => {
      cur.showWhispers = !cur.showWhispers;
      whBtn.classList.toggle('on', cur.showWhispers);
      whBtn.textContent = `街巷低語字幕：${cur.showWhispers ? '開' : '關'}`;
      emit();
    };
  }

  return () => {
    fontBtns.forEach(b => { b.onclick = null; });
    sensBtns.forEach(b => { b.onclick = null; });
    voiceBtns.forEach(b => { b.onclick = null; });
    if (ppBtn) ppBtn.onclick = null;
    if (whBtn) whBtn.onclick = null;
  };
}
