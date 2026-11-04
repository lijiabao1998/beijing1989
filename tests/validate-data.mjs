// Data integrity: every event has sources/confidence, every dialogue link resolves, every character is fictional.
import { readFileSync, readdirSync } from 'node:fs';
const fail = m => { console.error('FAIL', m); process.exitCode = 1; };
const KINDS = ['historical', 'testimony', 'fiction'], CONF = ['documented', 'testimony', 'uncertain'];
const events = {};
for (const f of readdirSync('data/events').filter(f => f.startsWith('1989-'))) {
  const e = JSON.parse(readFileSync('data/events/' + f, 'utf8')); events[e.id] = e;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(e.date)) fail(f + ' date');
  if (!KINDS.includes(e.kind)) fail(f + ' kind'); if (!CONF.includes(e.confidence)) fail(f + ' confidence');
  if (e.kind !== 'fiction' && !(e.sources?.length > 0)) fail(f + ' historical event needs sources');
  for (const s of e.sources) if (!/^https:\/\//.test(s.url)) fail(f + ' source url');
}
const ch = JSON.parse(readFileSync('data/dialogue/ch0-0417.json', 'utf8'));
for (const [id, c] of Object.entries(ch.characters)) if (c.fictional !== true) fail('character not fictional: ' + id);
const nodes = ch.nodes;
if (!nodes[ch.start]) fail('start');
for (const h of ch.hotspots) if (!nodes[h.start]) fail('hotspot ' + h.id);
for (const [id, n] of Object.entries(nodes)) {
  if (!ch.characters[n.speaker]) fail('speaker ' + id);
  if (n.event && !events[n.event]) fail('event ref ' + id);
  for (const c of n.choices) { if (c.next && !nodes[c.next]) fail('next ' + id); if (c.end && !ch.endings[c.end]) fail('end ' + id); }
}
const banned = /score|分數|正確答案|kill|擊殺/i;
if (banned.test(JSON.stringify(nodes))) fail('scoring/combat language in dialogue');
console.log(process.exitCode ? 'data invalid' : `data ok: ${Object.keys(events).length} events, ${Object.keys(nodes).length} nodes`);
