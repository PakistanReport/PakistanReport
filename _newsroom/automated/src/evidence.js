import {assert} from './common.js';
// Discovery metadata is never factual drafting evidence. Third-party narrative
// cannot enter the packet through summary, text, or a legacy document field.
export function evidenceText(o, source=o.sourceSnapshot) {
 if(source?.role==='primary') return o.document?.text || '';
 if(o.document?.method!=='editor-facts' || !o.document.editorConfirmed) return '';
 return (o.document.facts||[]).map(f=>f.excerpt).join('\n');
}
export function checkedFacts(facts) {
 assert(Array.isArray(facts)&&facts.length>0&&facts.length<=12,'Supply 1–12 independently assembled factual records');
 assert(facts.reduce((n,f)=>n+(typeof f?.excerpt==='string'?f.excerpt.split(/\s+/).length:1000),0)<=100,'Reporting evidence is limited to 100 excerpt words per source; do not paste an article');
 return facts.map((f,i)=>{
  assert(f && typeof f.statement==='string'&&f.statement.length>=15&&f.statement.length<=400,'Fact statement must be 15–400 characters');
  assert(typeof f.excerpt==='string'&&f.excerpt.length>=15&&f.excerpt.length<=300,'Evidence excerpt must be 15–300 characters');
  assert(typeof f.key==='string'&&f.key.length>0&&f.key.length<=100&&typeof f.value==='string'&&f.value.length>0&&f.value.length<=200,'Fact comparison key/value required');
  assert(f.excerpt.split(/\s+/).length<=25,'Each reporting excerpt is limited to 25 words');
  return {id:'f'+(i+1),statement:f.statement,excerpt:f.excerpt,key:f.key,value:f.value};
 });
}
export function evidencePacket(candidate) {
 const observations=candidate.observations||[];
 const evidenceRecords=[];
 for(const o of observations){
  const source=o.sourceSnapshot;
  const corpus=evidenceText(o,source);
  if(!corpus)continue;
  const facts=o.document.facts || corpus.split(/(?<=[.!?])\s+|\n+/).filter(s=>s.length>=15&&s.length<=600).slice(0,40).map((excerpt,i)=>({id:'p'+i,excerpt,statement:null,key:null,value:null}));
  for(const f of facts)evidenceRecords.push({id:o.id+':'+f.id,observationId:o.id,sourceId:o.sourceId,url:o.url,source,documentHash:o.document.hash||null,retrievedAt:o.document.retrievedAt,publishedAt:o.publishedAt,statement:f.statement,excerpt:f.excerpt,key:f.key,value:f.value,status:source.role==='primary'?'primary-excerpt-awaiting-claim-verification':'editor-assembled-reporting-fact',attributionRequired:true,untrusted:true});
 }
 evidenceRecords.sort((a,b)=>Number(b.source.role==='primary')-Number(a.source.role==='primary'));
 const owners=new Set(evidenceRecords.map(e=>e.source.owner).filter(Boolean));
 assert(evidenceRecords.length>0,'Independent evidence record required; discovery headlines/articles are not draft evidence',409);
 assert(evidenceRecords.some(e=>e.source.role==='primary')||owners.size>=2,'Without primary evidence require two independently owned reporting sources with editor-assembled facts',409);
 return {candidateId:candidate.id,observations:observations.map(o=>({id:o.id,sourceId:o.sourceId,url:o.url})),evidenceRecords,policy:'Draft original copy from factual evidence; prefer primary records; preserve conflicts with attribution; do not reproduce source narrative or infer missing facts.'};
}

// Explicit comparison keys are editor supplied; this does not infer semantic
// conflicts from prose or pretend that absence of a flag establishes agreement.
export function evidenceConflicts(candidate) {
 const groups = new Map();
 for (const o of candidate.observations || []) {
  if (!evidenceText(o)) continue;
  for (const f of o.document.facts || []) {
   if (!f.key || !f.value) continue;
   const records = groups.get(f.key) || [];
   records.push({...f, observationId:o.id});
   groups.set(f.key, records);
  }
 }
 return [...groups].filter(([,records])=>new Set(records.map(r=>r.value)).size>1)
  .map(([key,records])=>({key,records}));
}
