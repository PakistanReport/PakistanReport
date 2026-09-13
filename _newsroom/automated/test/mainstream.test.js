import {test} from 'node:test';
import assert from 'node:assert/strict';
import {rank,riskFor} from '../src/editorial.js';
const now=Date.parse('2026-09-13T12:00:00Z');
const sources=[{hosts:['wire.example'],id:'wire',role:'reporting',category:'World',authority:.85,owner:'wire'},{hosts:['pbs.example'],id:'pbs',role:'primary',category:'Economy',authority:1,owner:'PBS'}];
const observation=(title,summary='',sourceId='wire')=>({id:'event',url:'https://'+sourceId+'.example/event',title,summary,sourceId,publishedAt:'2026-09-13T06:00:00Z'});
const passes=[
 'Pakistan prime minister resigns after losing parliamentary majority',
 'Opposition wins national election and ends coalition majority',
 'Supreme Court overturns disputed election result',
 'Parliament passes constitutional rights bill',
 'Cabinet approves national budget tax changes',
 'IMF approves $7 billion programme for Pakistan',
 'State Bank cuts policy rate by 100 basis points',
 'Semiconductor company acquires rival in $30 billion merger',
 'Government bans semiconductor exports under national security policy',
 'Technology company launches breakthrough chip for nationwide networks',
 'Iran launches missile strikes in widening war',
 'Warring governments signed ceasefire ending war',
 'Earthquake hits region, thousands displaced and emergency declared',
 'Inflation rises to 30 percent, highest since 1970',
];
for(const title of passes)test('advance: '+title,()=>{const r=rank([observation(title)],sources,now);assert(r.advance,JSON.stringify(r));assert(r.materialChange);assert.equal(r.materialObservationId,'event');assert(r.score>=65);});
const fails=[
 'Weekly Sensitive Price Indicator (SPI) for the week ended on 10-09-2026',
 'Monthly inflation statistics published for September 2026',
 'Officials hold meeting about IMF programme',
 'Ministers sign MoU to explore technology cooperation',
 'Ambassador presents credentials in Iran',
 'President congratulates election winner',
 'Ministry publishes speech on national budget',
 'Government plans to cut tax next year',
 'Routine appointment of district administrator announced',
 'Government releases administrative notice',
 'Minister reiterates policy in follow-up briefing',
 'Company launches publicity campaign',
 'Inflation rises by 0.1 percent this month',
 'IMF may approve programme next week',
 'Officials discuss Iran war at routine meeting',
 'IMF releases statement about programme',
 'Court orders routine hearing on election case',
 'IMF approves meeting agenda',
];
for(const title of fails)test('reject: '+title,()=>{const r=rank([observation(title,'','pbs')],sources,now);assert.equal(r.advance,false,JSON.stringify(r));assert(r.score<65);});
test('routine SPI cannot be rescued by authoritative duplicate reports or index level',()=>{
 const o=observation(fails[0],'Weekly SPI is 364.26 with 0.23% change over the previous week.','pbs');
 const r=rank([o,{...o,sourceId:'wire'}],sources,now);assert.equal(r.score,0);assert.equal(r.materialChange,null);
});
test('substantive enacted result is not vetoed by mention of a meeting',()=>{
 assert(rank([observation('Cabinet approved national tax bill at meeting')],sources,now).advance);
});
test('World conflict requires no Pakistan keyword or primary source',()=>{
 const o=observation('Iran launches missile strikes in widening war');
 assert(rank([o],sources,now).advance);assert.equal(riskFor({observations:[o]}).level,'SENSITIVE');
});
test('unrelated observations cannot pool intent and impact into a development',()=>{
 assert.equal(rank([observation('Company launches publicity campaign'),observation('A billion dollars discussed at technology meeting')],sources,now).advance,false);
});

test('stored legacy SPI score and approval are invalidated once under new policy',async()=>{
 const {Service}=await import('../src/service.js');const {storage}=await import('./helpers.js');
 const db=storage();const s=new Service(db,{sources,now:()=>now});
 const [{id}]=await s.ingest('pbs',[observation(fails[0],'Weekly SPI is 364.26 with 0.23% change over the previous week.','pbs')]);
 const c=s.get(id);c.selection={advance:true,score:100};c.state='Approved';c.approval={revision:c.revision};s.save(c);
 const updated=new Service(db,{sources,now:()=>now}).get(id);
 assert.equal(updated.state,'Rejected');assert.equal(updated.selection.score,0);assert.equal(updated.approval,undefined);
 assert.equal(new Service(db,{sources,now:()=>now}).get(id).revision,updated.revision);
});
test('national scope alone does not make a routine statistical change exceptional',()=>{
 assert.equal(rank([observation('Nationwide weekly SPI rises by 0.23 percent')],sources,now).advance,false);
});
test('migration retains editorial rejection and leaves exported history immutable',async()=>{
 const {Service}=await import('../src/service.js');const {storage}=await import('./helpers.js');
 const db=storage();const s=new Service(db,{sources,now:()=>now});
 const [{id}]=await s.ingest('wire',[observation(passes[0])]);
 let c=s.get(id);c.selection={advance:true,score:90};c.state='Rejected';c.rejectedBy='editor';s.save(c);
 c=new Service(db,{sources,now:()=>now}).get(id);assert.equal(c.state,'Rejected');assert.equal(c.rejectedBy,'editor');
 c.selection={advance:true,score:100};c.state='Approved';c.export={hash:'immutable-history'};s.save(c);
 const before=JSON.stringify(s.get(id));new Service(db,{sources,now:()=>now});assert.equal(JSON.stringify(s.get(id)),before);
});
