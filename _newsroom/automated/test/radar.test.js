import {test} from 'node:test';
import assert from 'node:assert/strict';
import {harness,completeVisual} from './helpers.js';
import {sources,NOW,important,sameEvent,routine} from './fixtures/events.js';
import {evidencePacket,evidenceText,checkedFacts,evidenceConflicts} from '../src/evidence.js';
import {rank,riskFor,editorialChecks,verifyClaims,sameEvent as clustered} from '../src/editorial.js';
import {normalizeObservation,validateSource,SourceClient} from '../src/sources.js';
import {modelProvider} from '../src/provider.js';

const at=new Date(NOW-3600000).toISOString();
const fact=(value='10')=>({statement:'The editor recorded a policy rate of '+value+' percent.',excerpt:'The policy rate is '+value+' percent.',key:'policy-rate',value});
function record(id,owner,role='reporting',value='10') {
 const facts=checkedFacts([fact(value)]);
 return {id,sourceId:id,url:'https://'+id+'.example/decision',title:'A publisher headline that must never become drafting instructions',publishedAt:at,
  sourceSnapshot:{role,owner,ownership:{status:"reviewed",group:owner,reference:"https://fixture.example/ownership"}},document:{method:role==='primary'?'manual':'editor-facts',editorConfirmed:true,
   facts:role==='primary'?undefined:facts,text:role==='primary'?facts[0].excerpt:'FORBIDDEN FULL REPORTING ARTICLE TEXT',hash:'hash-'+id,retrievedAt:at}};
}

test('three outlets form one event and ownership prominence grows only once per group',async()=>{
 const s=harness();
 const [{id}]=await s.ingest('wire-fixture',[sameEvent]);
 const single=s.get(id).selection.score;
 const second={...sameEvent,url:'https://report.example/rate-cut'};
 assert.equal((await s.ingest('report-fixture',[second]))[0].id,id);
 const two=s.get(id).selection.score;
 s.sourceUpdate({...sources[1],id:'third-fixture',owner:'Third independent group',ownership:{status:'reviewed',group:'third',reference:'https://third.example/ownership'},hosts:['third.example'],url:'https://third.example/feed',discoveryPermission:{...sources[1].discoveryPermission,endpoint:'https://third.example/feed',hosts:['third.example']}});
 assert.equal((await s.ingest('third-fixture',[{...sameEvent,url:'https://third.example/rate-cut'}]))[0].id,id);
 assert.equal(s.list().length,1);
 assert(s.get(id).selection.score>two && two>single);
 s.sourceUpdate({...sources[1],id:'sister-fixture',hosts:['sister.example'],url:'https://sister.example/feed',discoveryPermission:{...sources[1].discoveryPermission,endpoint:'https://sister.example/feed',hosts:['sister.example']}});
 const score=s.get(id).selection.score;
 await s.ingest('sister-fixture',[{...sameEvent,url:'https://sister.example/rate-cut'}]);
 assert.equal(s.get(id).selection.score,score);
});

test('twenty timestamp-only refreshes retain one observation, original age and revision',async()=>{
 const s=harness();const [{id}]=await s.ingest('wire-fixture',[sameEvent]);
 const original=s.get(id);
 for(let i=1;i<=20;i++) {
  const result=await s.ingest('wire-fixture',[{...sameEvent,publishedAt:new Date(Date.parse(at)+i*1000).toISOString()}]);
  assert.deepEqual(result,[{id,duplicate:true}]);
 }
 const c=s.get(id);assert.equal(c.observations.length,1);
 assert.equal(c.revision,original.revision);assert.equal(c.observations[0].publishedAt,at);
 assert.equal(c.selection.score,original.selection.score);
});

test('high-volume independent coverage cannot rescue a non-material announcement',()=>{
 const outlets=Array.from({length:30},(_,i)=>({id:'outlet-'+i,role:'reporting',authority:1,owner:'owner-'+i}));
 const observations=outlets.map(s=>({...routine,sourceId:s.id,summary:''}));
 const result=rank(observations,outlets,NOW);assert.equal(result.advance,false);assert.equal(result.score,0);
});

test('major World conflict advances without Pakistan connection, remains sensitive',()=>{
 const o={...sameEvent,title:'Iran launches missile strikes in widening war'};
 const result=rank([{...o,sourceId:'wire-fixture'}],sources,NOW);
 assert(result.advance);assert.equal(riskFor({observations:[o]}).level,'SENSITIVE');
});

test('discovery import discards publisher article, description and injected document',async()=>{
 const o=await normalizeObservation({...sameEvent,summary:'FORBIDDEN NARRATIVE',text:'FORBIDDEN NARRATIVE',document:{text:'FORBIDDEN NARRATIVE'}},sources[1],NOW);
 assert.equal(o.summary,'');assert.equal(o.document,undefined);assert.equal(o.text,undefined);
 assert.throws(()=>evidencePacket({observations:[o]}),/Independent evidence/);
});

test('legacy full reporting document cannot become evidence or pass claim provenance',()=>{
 const o=record('wire','owner');o.document={method:'manual',text:fact().excerpt,editorConfirmed:true};
 assert.equal(evidenceText(o),'');assert.throws(()=>evidencePacket({observations:[o]}),/Independent evidence/);
 const result=verifyClaims([{id:'c1',text:fact().excerpt,key:'rate',value:'10',evidence:[{observationId:o.id,quote:fact().excerpt}]}],[o],[{id:o.id,role:'reporting',owner:'owner'}]);
 assert.equal(result.ok,false);
});

test('one reporting owner cannot satisfy independent research; two can',()=>{
 const a=record('one','same'),b=record('two','same');
 assert.throws(()=>evidencePacket({observations:[a,b]}),/two independently owned/);
 b.sourceSnapshot.owner='independent';b.sourceSnapshot.ownership.group='independent';const packet=evidencePacket({id:'event',observations:[a,b]});
 assert.equal(packet.evidenceRecords.length,2);
 assert(!JSON.stringify(packet).includes('FORBIDDEN'));
});

test('primary evidence is first, reporting conflicts and traceable provenance are retained',()=>{
 const a=record('one','reporter','reporting','11'),b=record('bank','bank','primary','10');
 const packet=evidencePacket({id:'event',observations:[a,b]});
 assert.equal(packet.evidenceRecords[0].source.role,'primary');
 assert.equal(packet.evidenceRecords.length,2);
 for(const e of packet.evidenceRecords){assert(e.observationId);assert(e.documentHash);assert(e.url);assert(e.excerpt);assert(e.id.startsWith(e.observationId+':'));}
 assert(packet.policy.includes('preserve conflicts'));
});

test('reporting evidence limits reject malformed records and full-article excerpts',()=>{
 assert.throws(()=>checkedFacts('article'),/factual records/);
 assert.throws(()=>checkedFacts([{...fact(),excerpt:'word '.repeat(26)}]),/25 words/);
 assert.throws(()=>checkedFacts(Array.from({length:6},()=>({...fact(),excerpt:'word '.repeat(20).trim()}))),/100 excerpt words/);
 assert.throws(()=>checkedFacts([{...fact(),key:''}]),/key\/value/);
});

test('reporting evidence API stores structured excerpts, ignoring supplied full article',async()=>{
 const s=harness();const [{id}]=await s.ingest('wire-fixture',[sameEvent]);let c=s.get(id);
 await assert.rejects(s.evidence(id,c.revision,c.observations[0].id,{text:'article '.repeat(100),editorConfirmed:true,note:'Checked independently against the original source.'}),/factual records/);
 c=await s.evidence(id,c.revision,c.observations[0].id,{facts:[fact()],text:'FORBIDDEN FULL ARTICLE',editorConfirmed:true,note:'Checked independently against the original source.'});
 assert(!JSON.stringify(c).includes('FORBIDDEN'));assert.equal(c.observations[0].document.method,'editor-facts');
});

test('fake adapter transport receives evidence packet, never discovery narrative or headline',async()=>{
 let payload;
 const provider=modelProvider({DRAFT_PROVIDER:'openai-compatible',MODEL_API_KEY:'fixture-only',MODEL_ENDPOINT:'https://model.example/v1/chat/completions',MODEL_ALLOWED_HOSTS:'model.example',MODEL_NAME:'fixture'},async(_url,options)=>{
  payload=JSON.parse(options.body);return Response.json({choices:[{message:{content:'{"headline":"fixture"}'}}]});
 });
 await provider({id:'event',observations:[record('bank','bank','primary'),record('wire','wire')],selection:{materialChange:'FORBIDDEN RADAR HEADLINE'}});
 const packet=JSON.parse(payload.messages[1].content);
 assert.equal(packet.evidenceRecords.length,2);assert(!JSON.stringify(packet).includes('FORBIDDEN'));
 assert(!JSON.stringify(packet).includes('publisher headline'));assert.equal(packet.observations[0].id,'bank');
});

test('conflicting factual records cannot disappear behind a confident model assertion',async()=>{
 const s=harness();const [{id}]=await s.ingest('sbp-fixture',[important]);let c=await s.process(id);
 c.observations.push(record('first','first','reporting','10'),record('second','second','reporting','11'));
 assert.equal(evidenceConflicts(c).length,1);assert.equal(riskFor(c).level,'SENSITIVE');
 const checks=editorialChecks(c,s.sources(),[],NOW);
 assert.equal(checks.checks.find(x=>x.name==='Evidence conflicts represented').pass,false);
});

test('copied source headline and source-like body block readiness',async()=>{
 const s=harness();const [{id}]=await s.ingest('sbp-fixture',[important]);let c=await s.process(id);c=await completeVisual(s,c);
 assert.equal(c.state,'Ready for Review');
 c.draft.headline=c.observations[0].title;
 c.draft.paragraphs[0].text=c.observations[0].document.text;
 const result=editorialChecks(c,s.sources(),[],NOW);
 assert.equal(result.checks.find(x=>x.name==='Original headline').pass,false);
 assert.equal(result.checks.find(x=>x.name==='Originality heuristic').pass,false);
});

test('RSS publication and a checked box are not permission for automated reporting access',async()=>{
 const s={...sources[1],discoveryPermission:undefined};
 assert.throws(()=>validateSource(s),/documented permission/);
 let requests=0;const client=new SourceClient(async()=>{requests++;throw Error('must not fetch');});
 await assert.rejects(client.poll(s,{},NOW),/documented permission/);assert.equal(requests,0);
 assert.doesNotThrow(()=>validateSource({...s,enabled:false}));
 assert.doesNotThrow(()=>validateSource(sources[1]));
});

test('common institution and rate aliases cluster differently worded mainstream headlines',()=>{
 assert(clustered({title:'SBP cuts interest rate by 100 bps to 10%',publishedAt:at},
  {title:'Pakistan State Bank cuts policy rate to 10 percent by 100 basis points',publishedAt:at}));
 assert(clustered({title:'Pakistan PM steps down after coalition collapses',publishedAt:at},
  {title:'Prime minister resigns after Pakistan coalition collapses',publishedAt:at}));
 assert(!clustered({title:'IMF approves $7 billion programme for Pakistan',publishedAt:at},
  {title:'Pakistan Supreme Court overturns disputed election result',publishedAt:at}));
});

test('monitoring uses radar, leaving higher-priority official sources for research',async()=>{
 const {Newsroom}=await import('../src/worker.js');
 const worker=Object.create(Newsroom.prototype),polled=[];
 worker.env={MONITOR_ENABLED:'true'};
 worker.service={setting:()=>({at:Date.now()}),sources:()=>[
  {id:'official',role:'primary',enabled:true,type:'rss',priority:100,poll:{}},
  {id:'reference',role:'reporting',purpose:'evidence',enabled:true,type:'rss',priority:90,poll:{}},
  {id:'radar',role:'reporting',purpose:'radar',enabled:true,type:'rss',priority:70,poll:{}}
 ],poll:async id=>polled.push(id),list:()=>[]};
 await worker.tick();assert.deepEqual(polled,['radar']);
});
