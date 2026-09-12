import {test} from 'node:test';
import assert from 'node:assert/strict';
import {rank,riskFor} from '../src/editorial.js';
const now=Date.parse('2026-09-12T21:00:00Z');
const sources=[{id:'official',role:'primary',authority:1,owner:'institution'}];
const item=(title,summary='',hours=1)=>({sourceId:'official',title,summary,publishedAt:new Date(now-hours*3600000).toISOString()});
test('announcement verbs and official authority do not establish a material change',()=>{
 for(const title of ['Pakistan ministry announced consultations on national tax policy','Pakistan parliament published a speech on the federal budget','Pakistan officials agreed to explore employment cooperation','Pakistan envoy presents credentials to president','Pakistan minister holds high-level meetings on economic cooperation']) {
  const r=rank([item(title)],sources,now);assert.equal(r.advance,false,title);assert(r.score<65,title);
 }
});
test('older policy action outranks a newer official ceremony',()=>{
 const significant=rank([item('Pakistan SBP cuts policy rate by 100 basis points','',6)],sources,now);
 const ceremony=rank([item('Pakistan ministry announced ceremonial meeting about budget','',0.08)],sources,now);
 assert(significant.advance);assert(significant.score>ceremony.score);
});
test('live PBS statistical release wording counts as measured change',()=>{
 const r=rank([item('Weekly Sensitive Price Indicator (SPI) for the week ended on 10-09-2026','Weekly SPI is 364.26 with 0.23% change over the previous week.',36)],sources,now);
 assert(r.advance);assert(r.concrete);
});
test('undated and stale material cannot advance as current news',()=>{
 const o=item('Pakistan parliament passed a national tax bill');
 assert.equal(rank([{...o,publishedAt:null}],sources,now).advance,false);
 assert.equal(rank([item(o.title,'',200)],sources,now).advance,false);
});

test('shared PBS footer does not merge inflation and trade releases',async()=>{
 const {sameEvent}=await import('../src/editorial.js');
 const footer='The post appeared first on Pakistan Bureau of Statistics.';
 assert.equal(sameEvent(item('Monthly Summary on Foreign Trade Statistics for August 2026',footer),item('Monthly Inflation Report for August 2026',footer)),false);
});
test('a calendar year alone is not a measured economic change',()=>{
 assert.equal(rank([item('Monthly inflation report for August 2026')],sources,now).advance,false);
});
test('live legal and parliamentary headlines retain sensitive review classification',()=>{
 for(const title of ['KP Assembly seeks Article 6 action against Punjab CM','IHC prohibits coercive measures against legal cafes','Action ordered against staff for misbehaving with lawmakers'])assert.equal(riskFor({observations:[item(title)]}).level,'SENSITIVE');
});

test('monitor researches the highest score even when a source fails',async()=>{
 const {Newsroom}=await import('../src/worker.js');
 const worker=Object.create(Newsroom.prototype);const processed=[];
 worker.env={MONITOR_ENABLED:'true'};
 worker.service={setting:()=>({at:Date.now()}),sources:()=>[{id:'blocked',enabled:true,type:'rss',priority:100,poll:{}}],poll:async()=>{throw Error('Source HTTP 403');},list:()=>[{id:'newer',state:'Detected',created:2,selection:{score:66}},{id:'important',state:'Detected',created:1,selection:{score:95}}]};
 worker.process=async id=>processed.push(id);
 const result=await worker.tick();
 assert.deepEqual(processed,['important']);assert.match(result.error,/403/);
});
