import { CH, EVENTS, orderForViewpoint, ROUTES, viewpointOfChapter, WORLD_FLAGS } from '../data';
import { getChapterMeta, VIEWPOINT_LABELS } from '../data/routeMetas';
import { loadLedger, type ChapterRecord, type SaveState, type WorldTimelineLedger } from '../save/save';
import type { Chapter, ViewpointId } from '../types';

const esc = (s: string) => s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));

interface CharacterArcRule {
  name: string;
  resolve: (f: Set<string>, rel: Record<string, number>) => string;
}

const CHARACTER_ARCS: Record<ViewpointId, CharacterArcRule[]> = {
  student: [
    {
      name: '老周（室友）',
      resolve: (f, rel) =>
        f.has('c5_zhou_farewell') || f.has('ch4:end:farewell_zhou')
          ? '五月底整理好書箱準備回河北，卻因六月初火車停開而留在三樓宿舍；最後陪著你確認大家平安，並約好秋天開學再見。'
          : f.has('ch0:end:letter') && (rel.zhou ?? 0) >= 2
            ? '與你建立深厚信任，從四月帶信給東城姐姐到五、六月校園裡始終互相照應。'
            : (rel.zhou ?? 0) >= 1
              ? '曾與你在長安街、宿舍間並肩同行，這個春天一直守在宿舍樓裡留意大家的安危。'
              : '始終留在三樓宿舍守著收音機與熱水壺，在各自安頓中走過這場春天。',
    },
    {
      name: '林小梅（中文系同學）',
      resolve: (f, rel) =>
        f.has('c5_persuaded_lin') || f.has('ch4:end:persuaded_lin')
          ? '五月三十日夜裡聽進了你的勸說，推著車回到西校門；六月初平安待在親戚家裡。'
          : f.has('ch2:end:broadcast') || f.has('ch3:end:with_lin') || (rel.lin ?? 0) >= 1
            ? '五月在廣播帳篷與長安街上奔波不歇，六月初平安轉往親戚與同學家屬區暫住。'
            : (rel.lin ?? 0) <= -1
              ? '四月夜裡那場分歧後你們各自保持距離，六月初得知她已在海淀平安安頓。'
              : '在中文系隊伍裡來來去去，六月初也已與同班同學一同平安待在家屬區。',
    },
    {
      name: '王師傅（工人）',
      resolve: (f, rel) =>
        f.has('c6_remembered_names') && (rel.wang ?? 0) >= 2
          ? '從四月下夜班的街角、五月綠豆湯三輪車與無軌電車路障，一直守到六月三日夜胡同口攔住想往南騎的學生。'
          : (rel.wang ?? 0) >= 1
            ? '從四月聊起物價與孩子開始，到五月送水與六月夜裡守著胡同口，始終默默護著學生。'
            : '像北京城裡無數夜班工人一樣，在六月三日深夜也守在路口提醒年輕人別往南衝。',
    },
    {
      name: '外校女生',
      resolve: (f, rel) =>
        f.has('c3_tended_stu2') || f.has('with_stu2') || (rel.stu2 ?? 0) >= 2
          ? '從四月十七日長安街北側、二十二日清晨，到五月絕食棚與三十日舊帳篷區，你們幾度重逢照應；六月四日早晨她已隨隊伍平安撤回學校。'
          : (rel.stu2 ?? 0) >= 1
            ? '曾在四月廣場北邊與五月帳篷旁短暫交談，後來在六月四日清晨平安撤回校內。'
            : '在廣場人海裡有過一面之緣；六月初傳來消息，她已跟著學校隊伍平安撤回。',
    },
    {
      name: '孫大爺（海淀報刊亭）',
      resolve: (f, rel) =>
        f.has('c3_sun_checked') || (rel.sun ?? 0) >= 1
          ? '守著海淀街口鐵皮報刊亭十幾年，從四月物價議論到五月街頭傳言，總是提醒你「聽說的多了，自己看見的才算數」。'
          : '海淀街角的報刊亭老人，每天守著兩疊早晚報紙看著來來往往的車流。',
    },
  ],
  worker: [
    {
      name: '老趙（帶班老師傅）',
      resolve: (f, rel) =>
        (rel.zhao ?? 0) >= 3 || f.has('w5:end:workshop_dawn')
          ? '整個春天始終在一車間與夜色路口照看著工段安全；六月五日清晨早早點清全班人名、互報平安，讓你感到踏實。'
          : (rel.zhao ?? 0) >= 1
            ? '四月教你顧好手邊活計、五月幫著把車棚後勤三輪車推上正軌，六月初照常守著車床。'
            : '話不多卻事事有分寸的老帶班師傅，一直替一車間守著燈與排班表。',
    },
    {
      name: '小劉（青年學徒）',
      resolve: (f, rel) =>
        f.has('wk_liu_clippings') || (rel.liu ?? 0) >= 2
          ? '那位愛抄詩和剪報的青年學徒一路跟你記著報紙與街角見聞；經歷五月下旬風波後安靜回到機床旁，六月五日早晨平安報到。'
          : '從好奇抄報到沉下心磨刀，在六月五日的車間晨霧裡照常歸隊。',
    },
    {
      name: '秀芳（妻子・紡織廠擋車工）',
      resolve: (f, rel) =>
        f.has('w0:end:family_hearth') || f.has('w4:end:courtyard_supper') || (rel.xiufang ?? 0) >= 2
          ? '下紡織廠晚班回家總留著灶上的熱麵與拍黃瓜；四月把壓箱底的大紅竹殼暖壺拎給學生，五月三十日見暖壺平安回來總算鬆了一口氣。'
          : '總是把家裡的煤球爐和開水打理得整整齊齊，是這個春夜裡最安穩的後盾。',
    },
    {
      name: '陳立（北大物理系學生）',
      resolve: (f, rel) =>
        f.has('wk_saw_chen') || f.has('wk_thermos_out') || (rel.chen ?? 0) >= 2
          ? '從四月十七日海淀問路、四月廿二日路口遞水、五月借去紅暖壺並在月底歸還，到六月三日夜裡在胡同口被你攔下後平安折返——最後托鄰居留下那張「謝謝」字條。'
          : '六月三日夜聽從你的叮囑沒有再往南騎，兩天後傳來消息說他已在校園平安安頓。',
    },
    {
      name: '院裡李大媽（大雜院鄰居）',
      resolve: (_f, rel) =>
        (rel.li_auntie ?? 0) >= 1
          ? '從拍打煤球爐聊菜價，到四月廿一與五月廿日深夜端出開水缸與熱饅頭，一路跟你守著大雜院紅門與街口門燈。'
          : '大雜院裡消息最靈通、心腸卻最熱的鄰居大媽，照例在天冷時留下一壺熱水。',
    },
    {
      name: '老張（無軌電車司機）',
      resolve: (_f, rel) =>
        (rel.driver ?? 0) >= 1
          ? '五月二十日戒嚴凌晨把雙節無軌電車橫停在西單路口後，一面給守夜街坊分熱開水、一面穩住路口秩序。'
          : '常跑長安街一線的電車老師傅，在五月無車可開的夜裡守著自己的駕駛室。',
    },
  ],
  journalist: [
    {
      name: '老沈（夜班編輯）',
      resolve: (_f, rel) =>
        (rel.shen ?? 0) >= 2
          ? '從四月中旬壓住未經核實的傳聞到六月清晨保住編輯部同人的名單與校樣，老沈用半生新聞經驗替年輕人撐起一道退路。'
          : '永遠在截稿鐘聲前提醒你分清親眼所見與聽來傳言的夜班編輯。',
    },
    {
      name: '小唐（實習攝影記者）',
      resolve: (_f, rel) =>
        (rel.tang ?? 0) >= 2
          ? '背著海鷗雙反相機與你走過長安街和立交橋，最後把還沒來得及印出的膠捲安全收進餅乾鐵盒。'
          : '始終帶著膠捲與鏡頭奔走現場的實習記者，六月初平安回到住處。',
    },
    {
      name: '張大姐（排字房老師傅）',
      resolve: (_f, rel) =>
        Math.max(rel.zhang ?? 0, rel.zhang_typesetter ?? 0) >= 1
          ? '在排字房燈下悄悄替報社保存了一套未付印的五月清樣，見證鉛字與白紙間的取捨。'
          : '夜班印刷廠裡沉默而可靠的老師傅，守著最後一道鉛字關口。',
    },
    {
      name: '方醫生（醫院聯絡人）',
      resolve: (_f, rel) =>
        (rel.fang ?? 0) >= 1
          ? '在醫院外急診通道與五月救護線間提供可核對的就診紀錄，讓筆記不至於淹沒在街頭傳言裡。'
          : '在繁忙的值班空檔仍抽空核實一線情況的醫護人員。',
    },
  ],
  resident: [
    {
      name: '外甥小軍（技校青年）',
      resolve: (f, rel) =>
        f.has('r3_brought_xiaojun_home') || (rel.xiaojun ?? 0) >= 2
          ? '原本總想騎車往熱鬧街頭去，在你的叮囑與大雜院門燈下，六月三日夜繞過路障平安回到西單四合院。'
          : '經歷七週街巷見聞後平安留在院裡，學會先顧好身邊鄰居與家中長輩。',
    },
    {
      name: '張大爺（院裡長輩）',
      resolve: (_f, rel) =>
        Math.max(rel.zhangye ?? 0, rel.grandpa_zhang ?? 0) >= 1
          ? '守在四合院屋簷下聽完一整春的廣播與街巷消息，感謝你常替他代排糧油並分享短波電台記下的實情。'
          : '四合院裡見多識廣的老街坊，與你一同在門墩旁守望著這座城的清晨與夜晚。',
    },
    {
      name: '王姐（國營糧店營業員）',
      resolve: (_f, rel) =>
        Math.max(rel.wangjie ?? 0, rel.wang_clerk ?? 0) >= 1
          ? '在五月流言四起、隊伍排到街角時替街坊穩住米麵供應，澄清了不實的停供傳言。'
          : '每天準時拉開糧店捲閘門的營業員，守著一條街的柴米油鹽。',
    },
    {
      name: '紅門院大媽（海淀親戚）',
      resolve: (_f, rel) =>
        Math.max(rel.hongmen ?? 0, rel.hongmen_auntie ?? 0) >= 1
          ? '六月三日夜在海淀胡同口與王師傅一同照應過路學生，事後走過半個城來看望大家平安。'
          : '住在海淀紅漆大門院裡的親戚，整個春天始終互相牽掛著消息。',
    },
  ],
};

export const ITEM_LABELS: Record<string, string> = {
  letter: '老周給姐姐的信',
  thermos: '食堂的熱水暖壺與饅頭',
  canteen: '老周的軍用水壺',
  glucose: '葡萄糖水壺',
  notebook: '夾著新聞簡報的物理筆記本',
  coins: '撥公用電話用的硬幣',
  lunchbox: '鋁飯盒與工牌',
  flashlight: '車間手電筒',
  red_thermos: '大紅竹殼暖水壺',
  press_pass: '首都晨報採訪證',
  film_tin: '暗房底片鐵盒',
  cassette_tape: '現場錄音磁帶',
  shortwave_notes: '短波頻率抄本',
  clinic_kit: '醫用無菌紗布包',
  ration_book: '市鎮糧油副食本',
};

export function summarizeCharactersForViewpoint(state: SaveState): { name: string; status: string }[] {
  const vp = state.viewpoint ?? viewpointOfChapter(state.chapter);
  const rules = CHARACTER_ARCS[vp] ?? CHARACTER_ARCS.student;
  const f = new Set(state.flags ?? []);
  const rel = state.rel ?? {};
  return rules.map(rule => ({
    name: rule.name,
    status: rule.resolve(f, rel),
  }));
}

function collectKeepsakes(state: SaveState): string[] {
  const keptSet = new Set<string>([...(state.keepsakes ?? []), ...(state.items ?? [])]);
  const flags = state.flags ?? [];
  if (flags.includes('has_letter')) keptSet.add('letter');
  if (flags.includes('has_thermos') || flags.includes('c5_got_thermos')) keptSet.add('thermos');
  if (flags.includes('has_water')) keptSet.add('canteen');
  if (flags.includes('c3_has_supplies')) keptSet.add('glucose');
  if (flags.includes('c3_taking_notes')) keptSet.add('notebook');
  if (flags.includes('c4_has_coins')) keptSet.add('coins');
  if (flags.includes('w0_has_lunchbox')) keptSet.add('lunchbox');
  if (flags.includes('w0_has_flashlight')) keptSet.add('flashlight');
  if (flags.includes('w1_has_thermos') || flags.includes('wk_thermos_returned')) keptSet.add('red_thermos');
  return [...keptSet].map(k => ITEM_LABELS[k] ?? k);
}

const ALL_VIEWPOINTS: ViewpointId[] = ['student', 'worker', 'journalist', 'resident'];

function mergeRouteRecords(
  state: SaveState,
  currentRecord: ChapterRecord,
  ledger?: WorldTimelineLedger
): Record<ViewpointId, Record<string, ChapterRecord>> {
  const activeVp = state.viewpoint ?? viewpointOfChapter(state.chapter);
  const out: Record<ViewpointId, Record<string, ChapterRecord>> = {
    student: { ...(ledger?.routeRecords?.student ?? {}) },
    worker: { ...(ledger?.routeRecords?.worker ?? {}) },
    journalist: { ...(ledger?.routeRecords?.journalist ?? {}) },
    resident: { ...(ledger?.routeRecords?.resident ?? {}) },
  };
  if (state.history) {
    Object.assign(out[activeVp], state.history);
  }
  if (currentRecord.ending || (currentRecord.taken?.length ?? 0) > 0) {
    out[activeVp][state.chapter] = currentRecord;
  }
  return out;
}

function renderRashomonMatrixHtml(
  chapters: Record<string, Chapter>,
  recordsByVp: Record<ViewpointId, Record<string, ChapterRecord>>,
  ledger?: WorldTimelineLedger
): string {
  // Collect distinct dates across all routes sorted chronologically.
  const dateBuckets = new Map<string, { date: string; dayKey: string }>();
  for (const vp of ALL_VIEWPOINTS) {
    for (const r of ROUTES[vp] ?? []) {
      const existing = dateBuckets.get(r.date);
      if (!existing || r.dayKey < existing.dayKey) {
        dateBuckets.set(r.date, { date: r.date, dayKey: r.dayKey });
      }
    }
  }
  const sortedDates = [...dateBuckets.values()].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));

  const rowsHtml = sortedDates.map(({ date }) => {
    const eventIds = new Set<string>();
    const cells = ALL_VIEWPOINTS.map(vp => {
      const meta = (ROUTES[vp] ?? []).find(r => r.date === date);
      if (!meta) return '<td class="rashomon-cell empty"><span class="small">—</span></td>';
      for (const eid of meta.events ?? []) eventIds.add(eid);
      const rec = recordsByVp[vp]?.[meta.id];
      const ch = chapters[meta.id];
      if (rec?.ending) {
        const endTitle = ch?.endings?.[rec.ending]?.title ?? rec.ending;
        return `<td class="rashomon-cell done">
          <div><strong>${esc(endTitle)}</strong></div>
          <div class="small">${esc(meta.title.zh)}</div>
          <button type="button" class="rashomon-jump" data-jump-vp="${vp}" data-jump-ch="${esc(meta.id)}">重溫此章</button>
        </td>`;
      }
      if (meta.playable) {
        return `<td class="rashomon-cell pending">
          <div class="small">尚未走過此日</div>
          <button type="button" class="rashomon-jump" data-jump-vp="${vp}" data-jump-ch="${esc(meta.id)}">切換體驗</button>
        </td>`;
      }
      return `<td class="rashomon-cell locked"><span class="small">待開放（${esc(meta.title.zh)}）</span></td>`;
    }).join('');

    const eventList = [...eventIds]
      .map(id => EVENTS[id])
      .filter(Boolean)
      .map(ev => {
        const tag = ev.kind === 'fiction'
          ? '<span class="tag fiction uncertain">遊戲虛構・無法確認</span>'
          : `<span class="tag ${esc(ev.confidence)}">${ev.kind === 'testimony' ? '證言' : '史實'}</span>`;
        return `<li>${tag} ${esc(ev.title.zh)}</li>`;
      })
      .join('');

    return `<tr>
      <th scope="row" class="rashomon-date">${esc(date)}</th>
      ${cells}
      <td class="rashomon-cell events"><ul class="rashomon-ev-list">${eventList || '<li class="small">無對應史料</li>'}</ul></td>
    </tr>`;
  }).join('');

  const activeCommits = Object.values(ledger?.commits ?? {}).filter(c => c.val);
  const commitsHtml = activeCommits.length
    ? `<div class="rashomon-commits"><h4>跨線交會紀錄</h4><ul>${activeCommits.map(c =>
        `<li><span class="tag documented">${esc(c.dayKey)}</span> ${esc(WORLD_FLAGS[c.id]?.description ?? c.id)}</li>`
      ).join('')}</ul></div>`
    : '';

  return `<section class="rashomon-section" aria-label="四線對照・真相拼圖">
    <h3>五、四線對照・真相拼圖</h3>
    <p class="small">同一段春天的時間軸裡，學生、工人、記者與市民各自看見一部份真相；對照四線紀錄與公開史料，彼此補充而不抹除差異。</p>
    <div class="rashomon-scroll">
      <table class="rashomon-table">
        <thead>
          <tr>
            <th>日期</th>
            <th>學生（陳立）</th>
            <th>工人（王建國）</th>
            <th>記者（顧明遠）</th>
            <th>市民（沈淑芬）</th>
            <th>公開史料對照</th>
          </tr>
        </thead>
        <tbody>${rowsHtml}</tbody>
      </table>
    </div>
    ${commitsHtml}
  </section>`;
}

/** Full retrospective chronicle modal HTML for any viewpoint, plus Date-Aligned Rashomon Matrix when >= 2 viewpoints have records. */
export function fullSpringChronicleHtml(state: SaveState, ledger?: WorldTimelineLedger): string;
export function fullSpringChronicleHtml(
  chapters: Record<string, Chapter>,
  order: string[],
  state: SaveState,
  currentRecord: ChapterRecord,
  ledger?: WorldTimelineLedger
): string;
export function fullSpringChronicleHtml(
  chaptersOrState: Record<string, Chapter> | SaveState,
  orderOrLedger?: string[] | WorldTimelineLedger,
  maybeState?: SaveState,
  maybeCurrentRecord?: ChapterRecord,
  maybeLedger?: WorldTimelineLedger
): string {
  const isSimpleSignature = 'chapter' in chaptersOrState && 'flags' in chaptersOrState && typeof (chaptersOrState as SaveState).chapter === 'string';

  const state: SaveState = isSimpleSignature ? (chaptersOrState as SaveState) : maybeState!;
  const vp = state.viewpoint ?? viewpointOfChapter(state.chapter);
  const chapters: Record<string, Chapter> = isSimpleSignature ? CH : (chaptersOrState as Record<string, Chapter>);
  const order: string[] = isSimpleSignature ? orderForViewpoint(vp) : (orderOrLedger as string[]);
  const currentRecord: ChapterRecord = isSimpleSignature
    ? { ending: state.ending, taken: state.taken ?? [] }
    : (maybeCurrentRecord ?? { ending: state.ending, taken: state.taken ?? [] });
  let ledger: WorldTimelineLedger | undefined = isSimpleSignature
    ? (orderOrLedger as WorldTimelineLedger | undefined)
    : maybeLedger;

  if (!ledger) {
    try {
      ledger = loadLedger();
    } catch {
      ledger = undefined;
    }
  }

  const vpLabel = VIEWPOINT_LABELS[vp]?.short ?? '學生視角';
  const countWord = order.length === 6 ? '六' : order.length === 8 ? '八' : String(order.length);

  const rows = order.map((id, i) => {
    const ch = chapters[id];
    const meta = getChapterMeta(id);
    const rec = id === state.chapter ? currentRecord : state.history?.[id];
    const endTitle = rec?.ending && ch?.endings?.[rec.ending] ? ch.endings[rec.ending].title : '尚未記錄結局';
    const endText = rec?.ending && ch?.endings?.[rec.ending] ? ch.endings[rec.ending].text : '';
    return `<div class="chron-item">
      <div class="chron-head"><strong>${esc(ch?.title ?? meta.title)}</strong><span class="tag documented">第 ${i + 1} 章・${esc(endTitle)}</span></div>
      ${endText ? `<p>${esc(endText)}</p>` : ''}
      ${ch?.epilogue ? `<p class="small">${esc(ch.epilogue)}</p>` : ''}
    </div>`;
  }).join('');

  const chars = summarizeCharactersForViewpoint(state)
    .map(c => `<li><strong>${esc(c.name)}：</strong>${esc(c.status)}</li>`)
    .join('');

  const kept = collectKeepsakes(state);
  const diary = state.diary ?? [];
  const diaryHtml = diary.length
    ? diary.map(d => `<li>${esc(d)}</li>`).join('')
    : '<li class="small">這一個春天，你選擇保持沉默。</li>';

  const recordsByVp = mergeRouteRecords(state, currentRecord, ledger);
  const activeViewpointCount = ALL_VIEWPOINTS.filter(v =>
    Object.values(recordsByVp[v] ?? {}).some(rec => Boolean(rec?.ending) || (rec?.taken?.length ?? 0) > 0)
  ).length;

  const rashomonHtml = activeViewpointCount >= 2
    ? renderRashomonMatrixHtml(chapters, recordsByVp, ledger)
    : '';

  return `<h2>完整春日紀事（${esc(vpLabel)}・全${countWord}章總結）</h2>
    <p class="small">1989 年 4 月 17 日 — 6 月 5 日。歷史的走向已經確定；這些是你走過的路、記住的人，與留下來的日記。</p>
    <h3>一、${countWord}章去向</h3>
    <div class="chron-list">${rows}</div>
    <h3>二、人物命運與聚散</h3>
    <ul>${chars}</ul>
    <h3>三、曾帶在身上的物件</h3>
    <p>${kept.length ? kept.map(esc).join('、') : '兩手空空，只帶著記憶走過春天。'}</p>
    <h3>四、完整的春天日記（共 ${diary.length} 則）</h3>
    <ol>${diaryHtml}</ol>
    ${rashomonHtml}
    <div class="row"><button id="chron-back" type="button">返回本章結局</button><button id="chron-darkroom" type="button">暗房底片</button><button id="chron-book" type="button">翻閱連環畫冊</button><button id="chron-export" type="button">匯出個人紀念冊</button><button id="chron-src" type="button">查看全部史料</button></div>`;
}
