import {test} from 'node:test';
import assert from 'node:assert/strict';
import {SOURCES} from '../src/registry.js';
import {ownershipGroup} from '../src/ownership.js';
import {SourceClient,validateSource} from '../src/sources.js';
import {rank,sameEvent,verifyClaims} from '../src/editorial.js';
import {evidencePacket} from '../src/evidence.js';
import {Service} from '../src/service.js';
import {harness,storage} from './helpers.js';
import {NOW,sources as fixtures} from './fixtures/events.js';
import {probeSources} from '../scripts/live-sources.js';

// Synthetic headlines only. These are not current news or permission assertions.
const at=new Date(NOW-3600000).toISOString();
const headlines=[
 'Supreme Court strikes down national election law in constitutional ruling',
 'Pakistan SC overturns national election law',
 'Top court declares national election law unconstitutional',
 'Supreme Court annuls national election law after constitutional challenge',
 'National election law struck down by Pakistan Supreme Court',
];
const ids=['dawn','geo','tribune','ary','business-recorder'];
const syntheticSources=SOURCES.map(s=>({...s,url:`https://${s.id}.example/`,hosts:[`${s.id}.example`]}));
const observation=(title,id='dawn',path='ruling')=>({title:'SIMULATED: '+title,url:`https://${id}.example/${path}`,publishedAt:at,summary:''});

test('desired registry represents all priority tiers, World and supporting references',()=>{
 const tier1=['dawn','geo','tribune','ary','the-news','dunya','samaa','aaj','news24','hum'];
 const tier2=['business-recorder','propakistani','pakistan-today','nation'];
 const tier3=['daily-times','pakistan-observer','bol','gnn','public-news','abb-takk','daily-pakistan'];
 for(const [tier,ids] of [[1,tier1],[2,tier2],[3,tier3]]) for(const id of ids){
  const s=SOURCES.find(s=>s.id===id);assert(s,id);assert.equal(s.priorityTier,tier);
  assert.equal(s.purpose,'radar');assert(s.disabledReason);assert(s.discovery);assert(s.ownership);assert(s.discoveryPermission);
 }
 for(const id of ['reuters','bbc','cnn'])assert.equal(SOURCES.find(s=>s.id===id).category,'World');
 for(const id of ['app','pbs','sbp','fbr','finance','courts','psx'])assert.equal(SOURCES.find(s=>s.id===id).purpose,'evidence');
 assert.equal(SOURCES.length,33);assert.equal(new Set(SOURCES.map(s=>s.id)).size,33);
 for(const s of SOURCES){assert.equal(s.enabled,false);assert.doesNotThrow(()=>validateSource(s));}
 assert(SOURCES.find(s=>s.id==='business-recorder').coverage.includes('Energy'));
 assert(SOURCES.find(s=>s.id==='propakistani').coverage.includes('Telecom'));
});

test('five differently worded Supreme Court headlines become one advancing event',async()=>{
 const s=harness({sources:syntheticSources});const found=[];
 for(let i=0;i<ids.length;i++)found.push((await s.ingest(ids[i],[observation(headlines[i],ids[i])]))[0].id);
 assert.equal(new Set(found).size,1);assert.equal(s.list().length,1);
 const c=s.get(found[0]);assert.equal(c.observations.length,5);assert(c.selection.advance);assert(c.selection.materialChange);
 assert.equal(c.risk.level,'SENSITIVE');assert.equal(c.state,'Detected');assert(!c.draft);
});

test('sister groups stay grouped even when stored owner labels or custom IDs differ',()=>{
 for(const ids of [['geo','the-news','jang'],['tribune','express'],['aaj','business-recorder']]) {
  const sources=ids.map(id=>SOURCES.find(s=>s.id===id));
  assert.equal(new Set(sources.map(ownershipGroup)).size,1);
  assert.equal(new Set(sources.map((s,i)=>ownershipGroup({...s,id:'custom-'+i,owner:'invented-'+i,ownership:{status:'reviewed',group:'invented-'+i,reference:s.url}}))).size,1);
 }
 const s=SOURCES.filter(s=>['geo','the-news','jang'].includes(s.id));
 const observations=s.map(s=>({...observation(headlines[0],s.id),sourceId:s.id}));
 assert.equal(rank(observations,s,NOW).score,rank(observations.slice(0,1),s,NOW).score);
});

test('unknown owners earn no prominence or reporting-only evidence credit',()=>{
 const sources=[{id:'one',role:'reporting',authority:.9,owner:'Unknown one'},{id:'two',role:'reporting',authority:.9,owner:'Unknown two'}];
 assert.equal(ownershipGroup(sources[0]),null);
 const observations=sources.map(s=>({...observation(headlines[0],s.id),id:s.id,sourceId:s.id,sourceSnapshot:s,
  document:{method:'editor-facts',editorConfirmed:true,facts:[{id:'f1',statement:'The policy rate is 10 percent.',excerpt:'The policy rate is 10 percent.',key:'rate',value:'10'}]}}));
 assert.equal(rank(observations,sources,NOW).factors.some(f=>f.name.startsWith('Additional')),false);
 assert.throws(()=>evidencePacket({observations}),/two independently owned/);
 const claims=[{id:'c1',text:'The policy rate is 10 percent.',key:'rate',value:'10',evidence:observations.map(o=>({observationId:o.id,quote:'The policy rate is 10 percent.'}))}];
 assert.equal(verifyClaims(claims,observations,sources).ok,false);
});

test('five outlets cannot rescue a routine government meeting',async()=>{
 const s=harness({sources:syntheticSources});
 for(const id of ids)await s.ingest(id,[observation('Government holds routine meeting to discuss economic cooperation',id)]);
 assert.equal(s.list().length,1);assert.equal(s.list()[0].state,'Rejected');assert.equal(s.list()[0].selection.score,0);
});

for(const title of [
 'IMF approves $7 billion programme for Pakistan',
 'Semiconductor company acquires rival in $30 billion merger',
 'Iran launches missile strikes in widening war',
 'Inflation rises to 30 percent, highest since 1970',
])test('material development remains eligible: '+title,()=>{
 const s=SOURCES.find(s=>s.id==='geo');assert(rank([{...observation(title),sourceId:s.id}],[s],NOW).advance);
});

test('routine SPI remains rejected with maximum possible ownership prominence',()=>{
 const outlets=Array.from({length:20},(_,i)=>({...fixtures[1],id:'s'+i,ownership:{status:'reviewed',group:'group'+i,reference:'https://fixture.example/review'}}));
 const result=rank(outlets.map(s=>({...observation('Weekly Sensitive Price Indicator (SPI) for the week ended on 10-09-2026'),sourceId:s.id})),outlets,NOW);
 assert.equal(result.score,0);assert.equal(result.advance,false);
 const major=rank(outlets.map(s=>({...observation(headlines[0]),sourceId:s.id})),outlets,NOW);
 assert.equal(major.factors.find(f=>f.name.startsWith('Additional')).points,15);
});

test('distinct case IDs, dates, legal subjects, courts and political actions do not merge',()=>{
 for(const [a,b] of [
  ['Supreme Court overturns tax law in case 123/2026','Supreme Court overturns tax law in case 456/2026'],
  ['Weekly SPI release for 10-09-2026','Weekly SPI release for 03-09-2026'],
  ['Supreme Court overturns national tax law','Supreme Court overturns national election law'],
  ['Islamabad High Court overturns national tax law','Lahore High Court overturns national tax law'],
  ['Pakistan prime minister resigns after confidence vote','Pakistan prime minister wins confidence vote'],
 ])assert.equal(sameEvent(observation(a),observation(b)),false,a+' / '+b);
 assert(sameEvent(observation('Iran missile attack killed 12 people'),observation('Iran missile attack killed 15 people')));
 assert(sameEvent(observation('Weekly SPI release for 10-09-2026'),observation('Weekly SPI release for 2026-09-10')));
 assert.equal(sameEvent({title:headlines[0]},{title:headlines[0]}),false);
});

test('a broad bridge headline cannot transitively combine distinct legal events',async()=>{
 const s=harness({sources:syntheticSources});
 await s.ingest('dawn',[observation('Supreme Court overturns national election law')]);
 await s.ingest('geo',[observation('Supreme Court overturns national election law in constitutional tax appeal','geo')]);
 await s.ingest('tribune',[observation('Supreme Court overturns national tax law in constitutional appeal','tribune')]);
 assert.equal(s.list().length,2);
});

test('all disabled catalog sources and an unapproved feed make zero network requests',async()=>{
 let requests=0;const client=new SourceClient(async()=>{requests++;throw Error('Unexpected network');});
 for(const s of SOURCES)await assert.rejects(client.poll(s));
 await assert.rejects(client.poll({...fixtures[1],discoveryPermission:undefined}),/permission/);
 assert.equal(requests,0);
});

test('permission cannot be reused for another endpoint or added host',()=>{
 assert.throws(()=>validateSource({...fixtures[1],url:'https://wire.example/other-feed'}),/exact endpoint/);
 assert.throws(()=>validateSource({...fixtures[1],hosts:['wire.example','extra.example']}),/every allowed host/);
});

test('live probe never supplies its own permission and continues after a failed source',async()=>{
 let calls=0;
 const result=await probeSources([...SOURCES,{...fixtures[1],discoveryPermission:undefined},fixtures[0],fixtures[1]],{poll:async source=>{calls++;if(source.role==='primary')throw Error('Fixture failure');return {observations:[]};}});
 assert.equal(calls,2);assert.equal(result.filter(r=>r.result==='disabled').length,33);
 assert.equal(result.at(-1).result,'parsed');assert.equal(result.at(-2).reason,'Fixture failure');
});

test('registry expansion preserves local source settings, editorial rejection and protected history',async()=>{
 const db=storage();let s=new Service(db,{sources:syntheticSources,now:()=>NOW});
 let [{id}]=await s.ingest('dawn',[observation(headlines[0])]);
 let c=s.get(id);c.state='Rejected';c.rejectedBy='editor';s.save(c);
 const rejected=JSON.stringify(s.get(id));
 const old=s.source('dawn');delete old.poll;old.priority=33;s.sourceUpdate(old);
 s=new Service(db,{sources:SOURCES,now:()=>NOW});assert.equal(JSON.stringify(s.get(id)),rejected);assert.equal(s.source('dawn').priority,33);
 c=s.get(id);c.state='Approved';c.export={hash:'protected'};c.deliveryLocked=true;s.save(c);
 const protectedRecord=JSON.stringify(c);
 s=new Service(db,{sources:SOURCES,now:()=>NOW});assert.equal(JSON.stringify(s.get(id)),protectedRecord);
});

test('Geo and The News cannot provide two-source corroboration for a reporting claim',()=>{
 const sources=['geo','the-news'].map(id=>SOURCES.find(s=>s.id===id));
 const quote='The policy rate is 10 percent.';
 const observations=sources.map(s=>({id:s.id,sourceId:s.id,url:s.url,sourceSnapshot:s,
  document:{method:'editor-facts',editorConfirmed:true,facts:[{id:'f1',statement:quote,excerpt:quote,key:'rate',value:'10'}]}}));
 const claims=[{id:'c1',text:quote,key:'rate',value:'10',evidence:observations.map(o=>({observationId:o.id,quote}))}];
 assert.throws(()=>evidencePacket({observations}),/two independently owned/);
 const verification=verifyClaims(claims,observations,sources);
 assert.equal(verification.ok,false);assert.equal(verification.claims[0].sourceGroups,1);
});
