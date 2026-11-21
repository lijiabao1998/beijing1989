import { playPaper, playTapeClick } from '../play/audio';

const esc = (s: string) => s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));

export interface BulletinBoardOpts {
  aftermath?: boolean;
  onNoteSave?: (line: string) => void;
  onBack?: () => void;
}

interface BoardSheet {
  id: string;
  title: string;
  tag: string;
  medium: string;
  x: number;
  y: number;
  w: number;
  h: number;
  rot: number;
  paper: string;
  ink: string;
  vertical?: boolean;
  lines: string[];
  aftermathLines: string[];
  excerpt: string;
  aftermathExcerpt: string;
}

const BOARD_SHEETS: readonly BoardSheet[] = [
  {
    id: 'elegy',
    title: '白宣紙輓詩〈清明未遠〉',
    tag: '悼念大字報',
    medium: '白報紙裁張・墨汁手書・四角漿糊固定',
    x: 24,
    y: 22,
    w: 155,
    h: 225,
    rot: -1.4,
    paper: '#f3ede0',
    ink: '#1e1b18',
    vertical: true,
    lines: [
      '春風猶寒',
      '故人已遠',
      '丹心難涼',
      '秉筆難書',
      '—— 物理系幾名同學敬輓',
    ],
    aftermathLines: [
      '殘紙一角……漿糊風乾捲邊',
      '「……猶寒……」',
    ],
    excerpt: '三角地布告欄抄錄：白宣紙上墨寫「春風猶寒、故人已遠」，漿糊尚未乾透，幾行署名只寫「物理系幾名同學」。',
    aftermathExcerpt: '三角地清晨見聞：杉木布告欄大多已被鏟淨刷過，只剩欄角一小塊沒撕盡的宣紙邊，隱約可辨「猶寒」二字。',
  },
  {
    id: 'mimeo',
    title: '物理樓夜印〈同學聯絡單〉',
    tag: '蠟紙油印傳單',
    medium: '藍紫油墨蠟紙刻版・再生新聞紙・邊緣微暈',
    x: 196,
    y: 18,
    w: 175,
    h: 205,
    rot: 1.2,
    paper: '#ebe6d6',
    ink: '#2d245e',
    lines: [
      '夜半借物理樓東頭油印機趕印：',
      '一、明早七時於南門外小樹林集合，自備水壺與厚外套。',
      '二、請各宿舍互相轉告，沿途保持隊形秩序，勿起推擠。',
      '（蠟紙筆刻字跡稍淡，角落沾有紫色油墨指紋）',
    ],
    aftermathLines: [
      '藍紫墨痕被清水沖刷得模糊成片',
      '欄木上留下一圈粉筆清理標記',
    ],
    excerpt: '三角地油印傳單抄錄：藍色油墨印著「明早七時於南門外集合，自備水壺與厚外套，沿途保持秩序」。',
    aftermathExcerpt: '三角地牆面水痕：木框邊緣還留著一圈藍紫色蠟紙油墨浸進木紋的淡漬。',
  },
  {
    id: 'poem',
    title: '未名湖畔詩箋〈四月雨前〉',
    tag: '手抄詩稿',
    medium: '橫格稿紙・藍色鋼筆水・左角被風撕裂',
    x: 392,
    y: 26,
    w: 162,
    h: 192,
    rot: -0.9,
    paper: '#f7f3e6',
    ink: '#1c3b6b',
    lines: [
      '四月雨前',
      '路燈把楊樹影子拉進宿舍牆根',
      '暖水瓶裡的白開水還沒涼',
      '誰在窗下喊了一聲「拿粉筆來」',
      '整棟樓的燈，就一格接一格亮了',
    ],
    aftermathLines: [
      '稿紙整張被雨打濕撕去，木釘上只勾著一小條藍格紙角。',
    ],
    excerpt: '三角地手抄詩〈四月雨前〉：「誰在窗下喊了一聲拿粉筆來，整棟樓的燈，就一格接一格亮了。」',
    aftermathExcerpt: '三角地木釘上還掛著半枚藍格稿紙角，紙纖維已被六月的晨露泡得發軟。',
  },
  {
    id: 'dorm_notice',
    title: '後勤處〈開水房供應調整〉',
    tag: '校內日常通告',
    medium: '紅頭公文用箋・鉛字印刷・蓋圓形事務章',
    x: 42,
    y: 264,
    w: 168,
    h: 132,
    rot: 0.8,
    paper: '#f6eee6',
    ink: '#221f1c',
    lines: [
      '總務後勤科通知',
      '近日本校鍋爐房用煤緊張，三十二樓北側開水房晚間提前至九點半停氣，請同學錯峰打水。',
    ],
    aftermathLines: [
      '六月五日新貼通知：各樓宿管今日清點返校住宿名單，水房恢復早晚兩頓供應。',
    ],
    excerpt: '總務後勤通告：鍋爐房用煤緊張，三十二樓開水房晚間九點半停氣，提醒同學錯峰打水。',
    aftermathExcerpt: '清晨重貼的後勤通告寫著宿管今日清點名單、開水房恢復早晚兩頓正常燒水。',
  },
  {
    id: 'route_map',
    title: '圓珠筆手繪〈海淀進城車道圖〉',
    tag: '騎車路線簡圖',
    medium: '方格計算紙・紅藍圓珠筆雙色標註',
    x: 228,
    y: 242,
    w: 170,
    h: 152,
    rot: -1.6,
    paper: '#efe9d4',
    ink: '#223344',
    lines: [
      '西門 ➔ 中關村南大街 ➔ 白石橋（修車鋪過馬路）',
      '➔ 西直門立交橋南轉 ➔ 西單路口 ➔ 長安街北側輔路',
      '附註：西單街口夜裡風大，車隊記得靠右側欄杆行駛。',
    ],
    aftermathLines: [
      '方格紙被揭下後，背面半幅粘在松木板上，隱約可見「西單路口」四字。',
    ],
    excerpt: '三角地手繪騎行路線圖：標出中關村、白石橋、西單路口到長安街北側輔路的夜騎路段與修車點。',
    aftermathExcerpt: '布告欄木板上粘著半幅殘缺方格紙，只見紅圓珠筆畫著一小段街口折線。',
  },
  {
    id: 'lantern_note',
    title: '宿舍熄燈後便箋〈留給夜歸人〉',
    tag: '同學便條',
    medium: '筆記本撕頁・鉛筆書寫・圖釘壓邊',
    x: 416,
    y: 238,
    w: 150,
    h: 152,
    rot: 2.1,
    paper: '#f2ead0',
    ink: '#2d2b26',
    lines: [
      '318 宿舍門縫有鑰匙，暖壺裡留了熱水。',
      '半夜進門輕手些，走廊盡頭樓梯燈泡壞了，小心腳下炭盆。',
    ],
    aftermathLines: [
      '空圖釘一枚，釘腳下壓著半片乾枯的槐樹葉。',
    ],
    excerpt: '同學留字便箋：「318 門縫留鑰匙，暖壺裡有熱水，樓梯燈壞了小心腳下。」',
    aftermathExcerpt: '三角地佈告欄只剩幾枚空圖釘與乾枯的槐樹落葉，早晨風一吹發出細響。',
  },
];

/**
 * Interactive zoomable & pannable Peking University Triangle Bulletin Board (三角地布告欄特寫).
 */
export function mountBulletinBoardInspector(
  container: HTMLElement,
  opts?: BulletinBoardOpts,
): () => void {
  let aftermath = Boolean(opts?.aftermath);
  let zoom = 1.05;
  let panX = 0;
  let panY = 0;
  let selectedId = BOARD_SHEETS[0]!.id;
  let dragActive = false;
  let dragMoved = false;
  let startX = 0;
  let startY = 0;
  let startPanX = 0;
  let startPanY = 0;

  container.innerHTML = `
    <div class="bb-wrap" role="region" aria-label="北京大學三角地布告欄特寫">
      <div class="bb-top">
        <div>
          <h2 style="margin:0">北大三角地杉木布告欄</h2>
          <p class="small" style="margin:3px 0 0">拖曳木板瀏覽各張字條與油印單；點擊紙張可放大細讀並抄錄至日記。</p>
        </div>
        <div class="bb-tools">
          <button type="button" class="bb-era${aftermath ? '' : ' on'}" data-bb-era="april">四月十七日之夜</button>
          <button type="button" class="bb-era${aftermath ? ' on' : ''}" data-bb-era="june">六月五日清空殘跡</button>
          <button type="button" class="bb-zoom" data-bb-zoom="1">100%</button>
          <button type="button" class="bb-zoom on" data-bb-zoom="1.25">125%</button>
          <button type="button" class="bb-zoom" data-bb-zoom="1.65">165%</button>
          <button type="button" id="bb-reset">重置視角</button>
          ${opts?.onBack ? '<button type="button" id="bb-back">返回對話</button>' : ''}
        </div>
      </div>

      <div class="bb-grid">
        <div class="bb-viewport" id="bb-viewport" title="按住拖曳平移，滾輪或上方按鈕縮放">
          <div class="bb-stage" id="bb-stage"></div>
        </div>
        <div class="bb-reader" id="bb-reader">
          <div class="bb-reader-meta"><span class="tag testimony" id="bb-sheet-tag"></span><span class="small" id="bb-sheet-med"></span></div>
          <h3 id="bb-sheet-title" style="margin:6px 0"></h3>
          <div id="bb-sheet-body" class="bb-sheet-body"></div>
          <div class="row" style="justify-content:flex-start;margin-top:10px">
            <button type="button" id="bb-save-note">摘錄至隨身日記</button>
            <span class="small" id="bb-save-status"></span>
          </div>
        </div>
      </div>
    </div>
  `;

  const viewportEl = container.querySelector<HTMLElement>('#bb-viewport')!;
  const stageEl = container.querySelector<HTMLElement>('#bb-stage')!;
  const tagEl = container.querySelector<HTMLElement>('#bb-sheet-tag')!;
  const medEl = container.querySelector<HTMLElement>('#bb-sheet-med')!;
  const titleEl = container.querySelector<HTMLElement>('#bb-sheet-title')!;
  const bodyEl = container.querySelector<HTMLElement>('#bb-sheet-body')!;
  const saveBtn = container.querySelector<HTMLButtonElement>('#bb-save-note')!;
  const statusEl = container.querySelector<HTMLElement>('#bb-save-status')!;
  const eraBtns = [...container.querySelectorAll<HTMLButtonElement>('[data-bb-era]')];
  const zoomBtns = [...container.querySelectorAll<HTMLButtonElement>('[data-bb-zoom]')];
  const resetBtn = container.querySelector<HTMLButtonElement>('#bb-reset')!;
  const backBtn = container.querySelector<HTMLButtonElement>('#bb-back');

  const applyTransform = () => {
    stageEl.style.transform = `translate(${panX.toFixed(1)}px, ${panY.toFixed(1)}px) scale(${zoom.toFixed(2)})`;
  };

  const renderReader = () => {
    const sh = BOARD_SHEETS.find(s => s.id === selectedId) ?? BOARD_SHEETS[0]!;
    tagEl.textContent = aftermath ? `${sh.tag}・清空後` : sh.tag;
    medEl.textContent = sh.medium;
    titleEl.textContent = sh.title;
    const lines = aftermath ? sh.aftermathLines : sh.lines;
    bodyEl.innerHTML = lines.map(l => `<p style="margin:5px 0;line-height:1.65">${esc(l)}</p>`).join('');
    statusEl.textContent = '';
  };

  const renderBoard = () => {
    stageEl.classList.toggle('aftermath', aftermath);
    stageEl.innerHTML = BOARD_SHEETS.map(sh => {
      const lines = aftermath ? sh.aftermathLines : sh.lines;
      const previewHtml = lines
        .map(l => `<div class="${sh.vertical ? 'bb-vline' : 'bb-hline'}">${esc(l)}</div>`)
        .join('');
      const sel = sh.id === selectedId ? ' selected' : '';
      const torn = aftermath ? ' torn' : '';
      return `<button type="button" class="bb-sheet${sel}${torn}" data-sheet="${esc(sh.id)}"
        style="left:${sh.x}px;top:${sh.y}px;width:${sh.w}px;height:${sh.h}px;background:${sh.paper};color:${sh.ink};transform:rotate(${sh.rot}deg)">
        <span class="bb-pin" aria-hidden="true"></span>
        <div class="bb-sheet-inner${sh.vertical ? ' vert' : ''}">${previewHtml}</div>
      </button>`;
    }).join('');
    renderReader();
    applyTransform();
  };

  const onStageClick = (e: Event) => {
    if (dragMoved) return;
    const btn = (e.target as HTMLElement | null)?.closest<HTMLButtonElement>('.bb-sheet[data-sheet]');
    if (!btn) return;
    selectedId = btn.dataset.sheet ?? selectedId;
    playPaper();
    stageEl.querySelectorAll('.bb-sheet').forEach(el => el.classList.toggle('selected', el === btn));
    renderReader();
  };

  const onPointerDown = (e: PointerEvent) => {
    if (e.button !== 0 && e.pointerType === 'mouse') return;
    dragActive = true;
    dragMoved = false;
    startX = e.clientX;
    startY = e.clientY;
    startPanX = panX;
    startPanY = panY;
  };
  const onPointerMove = (e: PointerEvent) => {
    if (!dragActive) return;
    const dx = e.clientX - startX;
    const dy = e.clientY - startY;
    if (Math.hypot(dx, dy) > 4) dragMoved = true;
    panX = Math.max(-220, Math.min(220, startPanX + dx));
    panY = Math.max(-180, Math.min(180, startPanY + dy));
    applyTransform();
  };
  const onPointerUp = () => {
    dragActive = false;
    window.setTimeout(() => { dragMoved = false; }, 0);
  };
  const onWheel = (e: WheelEvent) => {
    e.preventDefault();
    zoom = Math.max(0.85, Math.min(1.9, zoom * (e.deltaY > 0 ? 0.92 : 1.09)));
    applyTransform();
  };

  stageEl.addEventListener('click', onStageClick);
  viewportEl.addEventListener('pointerdown', onPointerDown);
  window.addEventListener('pointermove', onPointerMove);
  window.addEventListener('pointerup', onPointerUp);
  viewportEl.addEventListener('wheel', onWheel, { passive: false });

  eraBtns.forEach(btn => {
    btn.onclick = () => {
      aftermath = btn.dataset.bbEra === 'june';
      eraBtns.forEach(b => b.classList.toggle('on', b === btn));
      playPaper();
      renderBoard();
    };
  });
  zoomBtns.forEach(btn => {
    btn.onclick = () => {
      zoom = Number(btn.dataset.bbZoom) || 1;
      zoomBtns.forEach(b => b.classList.toggle('on', b === btn));
      applyTransform();
    };
  });
  resetBtn.onclick = () => {
    zoom = 1.05;
    panX = 0;
    panY = 0;
    zoomBtns.forEach(b => b.classList.toggle('on', Number(b.dataset.bbZoom) === 1));
    applyTransform();
  };
  saveBtn.onclick = () => {
    const sh = BOARD_SHEETS.find(s => s.id === selectedId) ?? BOARD_SHEETS[0]!;
    const note = aftermath ? sh.aftermathExcerpt : sh.excerpt;
    opts?.onNoteSave?.(note);
    playPaper();
    statusEl.textContent = '✓ 已摘錄至隨身日記';
  };
  if (backBtn) {
    backBtn.onclick = () => opts?.onBack?.();
  }

  renderBoard();

  return () => {
    stageEl.removeEventListener('click', onStageClick);
    viewportEl.removeEventListener('pointerdown', onPointerDown);
    window.removeEventListener('pointermove', onPointerMove);
    window.removeEventListener('pointerup', onPointerUp);
    viewportEl.removeEventListener('wheel', onWheel);
    eraBtns.forEach(b => { b.onclick = null; });
    zoomBtns.forEach(b => { b.onclick = null; });
    resetBtn.onclick = null;
    saveBtn.onclick = null;
    if (backBtn) backBtn.onclick = null;
  };
}

export interface TypesettingOpts {
  dateLabel?: string;
  onSaveProof?: (summary: string) => void;
  onBack?: () => void;
}

interface GalleyGroup {
  id: 'headline' | 'dispatch' | 'caption';
  title: string;
  options: Array<{
    key: string;
    label: string;
    tone: string;
    printText: string;
    proofNote: string;
  }>;
}

const GALLEY_GROUPS: readonly GalleyGroup[] = [
  {
    id: 'headline',
    title: '一、頭版鉛字大標題（特號宋體）',
    options: [
      {
        key: 'wire',
        label: '沿用新華社通稿口徑',
        tone: '穩妥通稿',
        printText: '首都今晨交通秩序井然　各區市政部門加緊物資調運',
        proofNote: '排字房備註：版面安全通過校審，但街角讀者未必停步。',
      },
      {
        key: 'witness',
        label: '採用記者夜巡現場題目',
        tone: '現場直擊',
        printText: '昨夜十萬輛單車沿長安街西行　數千同學靜坐廣場徹夜',
        proofNote: '排字房備註：張大姐把木格鉛條換成二號黑體，墨色較濃。',
      },
      {
        key: 'civic',
        label: '刊登民生與急救車通行',
        tone: '市民關切',
        printText: '西單至天安門路段自主讓出救護通道　街坊送來開水與棉衣',
        proofNote: '排字房備註：老沈拿紅藍鉛筆在清樣旁打了個雙圈。',
      },
    ],
  },
  {
    id: 'dispatch',
    title: '二、本報夜班通訊欄（五號鉛字）',
    options: [
      {
        key: 'short',
        label: '三十字簡訊壓角處理',
        tone: '簡訊存照',
        printText: '【本報訊】昨日午後起，多所高校同學自海淀騎車入城，沿途交警維持幹線暢通，入夜後氣溫降至十二度。',
        proofNote: '版面位置：排在第四版左下角，旁接氣象預報。',
      },
      {
        key: 'dialogue',
        label: '收入胡同修車與賣菜細節',
        tone: '市井群像',
        printText: '【本報現場記】白石橋修車攤昨晚支起一盞蓄電池燈，老師傅免費給騎車路過的學生補胎。旁邊菜攤大媽往暖壺裡添了兩遍熱水。',
        proofNote: '版面位置：二版專欄〈都市夜話〉，保留普通市民口吻。',
      },
      {
        key: 'contrast',
        label: '並置兩份來源不同記錄',
        tone: '雙欄對照',
        printText: '【編者按】除晚間電台廣播摘要外，本欄另摘錄夜班攝影小唐於木樨地至新華門一線實地見聞，供讀者參看。',
        proofNote: '版面位置：留足四行鉛條留白，標註時間出處。',
      },
    ],
  },
  {
    id: 'caption',
    title: '三、35mm 底片網版配圖圖說',
    options: [
      {
        key: 'street_bikes',
        label: '配〈夜燈下的單車長隊〉',
        tone: '紀實配圖',
        printText: '圖：四月十七日深夜，木樨地路口橘黃路燈下緩行向東的二八大槓車流（本報實習攝影攝）。',
        proofNote: '製版網線：100 線鋅版半色調網點。',
      },
      {
        key: 'pku_board',
        label: '配〈三角地木板前圍觀者〉',
        tone: '校園近景',
        printText: '圖：北京大學三角地布告欄前舉著手電筒抄錄詩句的同學，遠處宿舍樓窗燈長明。',
        proofNote: '製版網線：微粒反差顯影，暗部層次清晰。',
      },
      {
        key: 'no_photo',
        label: '暫抽下圖版改留白框',
        tone: '待後補印',
        printText: '［本欄原定配圖因底片尚在暗房沖洗水漂中，今日先行文字付印，原片留存新聞室檔案櫃。］',
        proofNote: '排字房備註：空出三欄見方鉛架，待日後整理。',
      },
    ],
  },
];

/**
 * Interactive 1989 Newsroom Night-Shift Lead-Type Galley Proof Desk (首都晨報夜班排版桌).
 */
export function mountTypesettingDesk(
  container: HTMLElement,
  opts?: TypesettingOpts,
): () => void {
  const chosen: Record<GalleyGroup['id'], number> = {
    headline: 1,
    dispatch: 1,
    caption: 0,
  };
  const dateStr = opts?.dateLabel || '一九八九年 春季夜班清樣';

  container.innerHTML = `
    <div class="ts-wrap" role="region" aria-label="報社夜班鉛字排版桌">
      <div class="bb-top">
        <div>
          <h2 style="margin:0">《首都晨報》夜班鉛字排版校樣桌</h2>
          <p class="small" style="margin:3px 0 0">從左側鉛字托盤調換大標題、本報通訊與配圖圖說，右側新聞紙清樣將即時落版預覽。</p>
        </div>
        ${opts?.onBack ? '<button type="button" id="ts-back">返回對話</button>' : ''}
      </div>

      <div class="ts-grid">
        <div class="ts-galleys" id="ts-galleys">
          ${GALLEY_GROUPS.map(g => `
            <fieldset class="ts-galley">
              <legend>${esc(g.title)}</legend>
              <div class="ts-slugs">
                ${g.options.map((op, idx) => `
                  <button type="button" class="ts-slug${chosen[g.id] === idx ? ' on' : ''}" data-galley="${g.id}" data-idx="${idx}">
                    <strong>${esc(op.label)}</strong>
                    <span class="small">${esc(op.tone)}</span>
                  </button>
                `).join('')}
              </div>
            </fieldset>
          `).join('')}
        </div>

        <div class="ts-paper" id="ts-preview" aria-live="polite">
          <div class="ts-masthead">
            <span>第 4082 號・小樣校對</span>
            <strong>首 都 晨 報</strong>
            <span>${esc(dateStr)}</span>
          </div>
          <h3 class="ts-head-preview" id="ts-head-out"></h3>
          <div class="ts-cols">
            <div class="ts-photo-box" id="ts-photo-out"></div>
            <p class="ts-dispatch-out" id="ts-dispatch-out"></p>
          </div>
          <p class="ts-proof-note" id="ts-note-out"></p>
          <div class="row" style="justify-content:flex-start;margin-top:8px">
            <button type="button" id="ts-commit">簽發校樣並記入採訪筆記</button>
            <span class="small" id="ts-commit-status"></span>
          </div>
        </div>
      </div>
    </div>
  `;

  const headOut = container.querySelector<HTMLElement>('#ts-head-out')!;
  const photoOut = container.querySelector<HTMLElement>('#ts-photo-out')!;
  const dispatchOut = container.querySelector<HTMLElement>('#ts-dispatch-out')!;
  const noteOut = container.querySelector<HTMLElement>('#ts-note-out')!;
  const commitBtn = container.querySelector<HTMLButtonElement>('#ts-commit')!;
  const statusEl = container.querySelector<HTMLElement>('#ts-commit-status')!;
  const backBtn = container.querySelector<HTMLButtonElement>('#ts-back');
  const slugBtns = [...container.querySelectorAll<HTMLButtonElement>('.ts-slug[data-galley]')];

  const renderPreview = () => {
    const h = GALLEY_GROUPS[0]!.options[chosen.headline]!;
    const d = GALLEY_GROUPS[1]!.options[chosen.dispatch]!;
    const c = GALLEY_GROUPS[2]!.options[chosen.caption]!;
    headOut.textContent = h.printText;
    dispatchOut.textContent = d.printText;
    photoOut.innerHTML = `<div class="ts-halftone">${chosen.caption === 2 ? '［留白待補］' : '35mm 網版鋅版'}</div><div class="ts-cap">${esc(c.printText)}</div>`;
    noteOut.textContent = `紅筆校對記：${h.proofNote} ${d.proofNote}`;
    statusEl.textContent = '';
  };

  slugBtns.forEach(btn => {
    btn.onclick = () => {
      const gId = btn.dataset.galley as GalleyGroup['id'];
      const idx = Number(btn.dataset.idx);
      if (!gId || !Number.isFinite(idx)) return;
      chosen[gId] = idx;
      playTapeClick();
      slugBtns
        .filter(b => b.dataset.galley === gId)
        .forEach(b => b.classList.toggle('on', b === btn));
      renderPreview();
    };
  });

  commitBtn.onclick = () => {
    const h = GALLEY_GROUPS[0]!.options[chosen.headline]!;
    const c = GALLEY_GROUPS[2]!.options[chosen.caption]!;
    const summary = `夜班排版清樣（${h.tone}）：頭題擬定〈${h.printText}〉，並批註「${c.label}」。`;
    opts?.onSaveProof?.(summary);
    playPaper();
    statusEl.textContent = '✓ 清樣已簽存並記入筆記';
  };

  if (backBtn) {
    backBtn.onclick = () => opts?.onBack?.();
  }

  renderPreview();

  return () => {
    slugBtns.forEach(b => { b.onclick = null; });
    commitBtn.onclick = null;
    if (backBtn) backBtn.onclick = null;
  };
}
