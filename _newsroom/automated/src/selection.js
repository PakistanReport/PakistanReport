// Conservative deterministic research triage, not verification or publication approval.
const ACTION = /\b(rises?|rose|falls?|fell|reaches?|contracts?|shrinks?|surges?|cuts?|hike|raises?|raised|passes|passed|enacts?|enacted|approves?|approved|orders?|ordered|rules?|ruled|overturns?|strikes down|blocks?|bans?|resigns?|resigned|ousted|wins?|won|defeats?|collapses?|collapsed|defaults?|defaulted|disburses?|disbursed|acquires?|acquired|launches?|launched|halts?|halted|invades?|invaded|strikes|killed|hits?|hit|declares?|declared|signed|agreed|takes effect|enters into force|mandatory)\b/i;
const ROUTINE = /\b(routine|adjournment|hearing date|mou|memorandum of understanding|ceremonial|courtesy|credentials|congratulat\w*|goodwill|retire\w*|routine appointment|administrative notice|reshuffle|publicity|consultations?|speech|meeting|meetings|cooperation|intentions?|plans?|proposes?|pledges?|urges?|explore|follow-up|reiterates?|unchanged)\b/i;
const UNCERTAIN = /\b(rumou?r|unconfirmed|speculation|may|might|could|plans to|expected to|seeks to)\b/i;
const STATS = /\b(spi|sensitive price indicator|weekly|monthly|statistics|statistical release|inflation|gdp|unemployment|exports|reserves)\b/i;
const EXCEPTIONAL = /\b(record (high|low)|highest since|lowest since|first (contraction|decline)|recession|double-digit)\b/i;
const EVENTS = [
 ['Political or electoral result', /\b(prime minister|president|government|parliament|assembly|election|coalition|opposition|no-confidence)\b/i, /\b(wins?|won|defeats?|resigns?|resigned|ousted|collapses?|collapsed|no-confidence|majority|dissolv\w*|annuls?)\b/i],
 ['Consequential ruling or legislation', /\b(court|supreme court|ihc|parliament|assembly|cabinet)\b/i, /\b(bill|law|election|constitutional|constitution|rights|tax|ban|budget|policy|disputed|tariff)\b/i],
 ['IMF or sovereign financing decision', /\b(imf)\b/i, /\b(programme|program|loan|tranche|bailout|funding|billion)\b/i],
 ['Macroeconomic or public policy action', /\b(policy rate|central bank|state bank|sbp|federal tax|fuel prices?|petrol|electricity tariff|sovereign debt|national budget|vaccination certificate)\b/i, /./],
 ['Major business or technology change', /\b(merger|acquisition|chip|semiconductor|technology|bank|company|corporation|antitrust)\b/i, /\b(billion|bankruptcy|nationwide|export ban|mass layoffs|breakthrough|monopoly|systemic|national security policy)\b/i],
 ['Major conflict or security development', /\b(iran|war|conflict|ceasefire|invasion|airstrike|missile|terrorist|bombing)\b/i, /\b(ceasefire|invasion|airstrike|missile|killed|strikes|attacks?|war|peace agreement)\b/i],
 ['Major disaster or public emergency', /\b(earthquake|floods?|disaster|tsunami|epidemic|outbreak|wildfire)\b/i, /\b(killed|dead|displaced|emergency|millions|thousands|nationwide)\b/i],
];
function assess(o) {
 const title = o.title || '';
 const summary = o.summary || '';
 const combined = title + ' ' + summary;
 // A vague press-release headline needs a complete substantive sentence, not
 // isolated keywords pooled from other observations or background paragraphs.
 const sentences = [title, ...summary.split(/(?<=[.!?])\s+/)];
 let material = null;
 for (const sentence of sentences) {
  if (UNCERTAIN.test(sentence) || !ACTION.test(sentence)) continue;
  const event = EVENTS.find(([, domain, impact]) => domain.test(sentence) && impact.test(sentence));
  const measured = STATS.test(sentence) && EXCEPTIONAL.test(sentence) && /\d/.test(sentence)
    && /\b(rises?|rose|falls?|fell|hits?|reaches?|contracts?|shrinks?|surges?)\b/i.test(sentence);
  if (event || measured) { material = {sentence: sentence.slice(0,600), reason: event?.[0] || 'Exceptional economic result'}; break; }
 }
 const routine = ROUTINE.test(title);
 // Routine framing does not veto an explicitly enacted major outcome in title.
 if (routine && !(material?.sentence === title && /\b(passed|enacted|approved|signed|takes effect)\b/i.test(title))) material = null;
 const statistical = STATS.test(combined) && !/\b(policy rate|imf|federal tax|sovereign debt)\b/i.test(combined);
 return {material, routine, statistical};
}
export function rank(observations, sources, now=Date.now()) {
 const evaluated = observations.map(o=>({o,...assess(o)}));
 const current = evaluated.filter(({o})=>{const age=now-Date.parse(o.publishedAt);return Number.isFinite(age)&&age>=0&&age<=168*3600000;});
 const chosen = current.find(x=>x.material);
 const factors=[]; const add=(name,points)=>factors.push({name,points});
 if(chosen) {
  add('Concrete mainstream development',45);
  add(chosen.material.reason,20);
  const authority=Math.max(0,...current.map(({o})=>sources.find(s=>s.id===o.sourceId)?.authority || 0));
  add('Source authority (verification support only)',Math.round(authority*5));
  const owners=new Set(current.filter(x=>x.material).map(({o})=>sources.find(s=>s.id===o.sourceId)?.owner).filter(Boolean));
  if(owners.size>1)add('Additional source ownership (not verified corroboration)',Math.min(15,(owners.size-1)*5));
  add('Timeliness',now-Date.parse(chosen.o.publishedAt)<=24*3600000?5:0);
 } else {
  add('No demonstrated standalone mainstream development',0);
  if(evaluated.some(x=>x.statistical))add('Routine figures need a significant result, not release metadata',0);
  if(evaluated.some(x=>x.routine))add('Routine PR / ceremonial announcement',-20);
  if(!current.length)add('No current dated evidence',-20);
 }
 const score=Math.max(0,Math.min(100,factors.reduce((n,f)=>n+f.points,0)));
 return {policy:'mainstream-v1',concrete:Boolean(chosen),mainstream:Boolean(chosen),materialChange:chosen?.material.sentence || null,materialObservationId:chosen?.o.id || null,score,threshold:65,advance:Boolean(chosen)&&score>=65,factors};
}
