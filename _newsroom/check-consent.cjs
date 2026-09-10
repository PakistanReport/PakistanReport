const fs=require('fs'),vm=require('vm'),assert=require('assert/strict'),path=require('path');
const root=path.resolve(__dirname,'..');
const ui=fs.readFileSync(path.join(root,'assets/js/analytics-consent.js'),'utf8');
const bootstrap=fs.readFileSync(path.join(root,'_includes/analytics.html'),'utf8').match(/<script>([\s\S]*?)<\/script>/)[1]
.replace('{{ site.analytics.measurement_id | jsonify }}','"G-8J4QNEXRW4"')
.replace('{{ site.url | jsonify }}','"https://pakistanreport.pakistanreportnews.workers.dev"');
const key='pakistan-report.analytics-choice.v1',lifetime=180*86400000;
function setup(saved,broken=false){
 let now=1800000000000,reloads=0,focus=null;const storage={},handlers={},nodes={},appended=[],writes=[],timers=new Map();let timerId=0;
 if(saved!==undefined)storage[key]=JSON.stringify(saved(now));
 for(const id of ['pr-analytics-notice','pr-analytics-status','pr-analytics-allow','pr-analytics-decline','prefs'])nodes[id]={hidden:true,textContent:'',listeners:{},addEventListener(n,f){this.listeners[n]=f;},focus(){focus=id;}};
 const document={visibilityState:'visible',getElementById:id=>nodes[id],querySelectorAll:()=>[nodes.prefs],addEventListener:(n,f)=>{handlers[n]=f;},createElement:()=>({}),head:{appendChild:s=>appended.push(s)}};
 Object.defineProperty(document,'cookie',{get:()=> '_ga=123; _ga_8J4QNEXRW4=456; unrelated=keep',set:s=>writes.push(s)});
 const window={location:{origin:'https://pakistanreport.pakistanreportnews.workers.dev',hostname:'pakistanreport.pakistanreportnews.workers.dev',pathname:'/politics/example/',reload:()=>reloads++},
 localStorage:{getItem:k=>{if(broken)throw Error();return storage[k]??null;},setItem:(k,v)=>{if(broken)throw Error();storage[k]=v;},removeItem:k=>{delete storage[k];}},
 addEventListener:(n,f)=>{(handlers[n]??=[]).push(f);},dispatchEvent:e=>{for(const fn of handlers[e.type]||[])fn(e);}};
 class Clock extends Date{static now(){return now;}}
 const ctx=vm.createContext({window,document,Date:Clock,CustomEvent:class{constructor(type,opts){this.type=type;this.detail=opts.detail;}},setTimeout:(fn,ms)=>{timers.set(++timerId,{fn,ms});return timerId;},clearTimeout:id=>timers.delete(id),encodeURIComponent});
 vm.runInContext(bootstrap,ctx);vm.runInContext(ui,ctx);
 return {window,nodes,storage,appended,writes,ctx,get reloads(){return reloads;},get focus(){return focus;},click:id=>nodes[id].listeners.click(),advance:ms=>{now+=ms;for(const t of [...timers.values()])t.fn();},storageEvent:()=>window.dispatchEvent({type:'storage',key}),rerun:()=>vm.runInContext(ui,ctx)};
}
let a=setup();assert.equal(a.appended.length,0);assert.equal(a.nodes['pr-analytics-notice'].hidden,false);
a.click('pr-analytics-decline');assert.equal(a.appended.length,0);assert.equal(JSON.parse(a.storage[key]).granted,false);
a.click('prefs');assert.equal(a.focus,'pr-analytics-allow');assert.equal(a.nodes['pr-analytics-notice'].hidden,false);
a.click('pr-analytics-allow');assert.equal(a.appended.length,1);a.click('pr-analytics-allow');a.rerun();assert.equal(a.appended.length,1);
a.click('pr-analytics-decline');assert.equal(a.window['ga-disable-G-8J4QNEXRW4'],true);assert.equal(a.reloads,1);assert.ok(a.writes.some(s=>s.startsWith('_ga=;')));assert.ok(a.writes.every(s=>!s.startsWith('unrelated=')));
assert.equal(setup(n=>({granted:false,expiresAt:n+lifetime})).appended.length,0);
assert.equal(setup(n=>({granted:true,expiresAt:n+lifetime})).appended.length,1);
assert.equal(setup(n=>({granted:true,expiresAt:n-1})).appended.length,0);
assert.equal(setup(n=>({granted:'true',expiresAt:n+lifetime})).appended.length,0);
assert.equal(setup(n=>({granted:true,expiresAt:n+lifetime+1})).appended.length,0);
assert.equal(setup(undefined,true).appended.length,0);
a=setup(n=>({granted:true,expiresAt:n+100}));a.advance(101);assert.equal(a.window['ga-disable-G-8J4QNEXRW4'],true);assert.equal(a.reloads,1);assert.equal(a.storage[key],undefined);
a=setup(n=>({granted:true,expiresAt:n+lifetime}));a.storage[key]=JSON.stringify({granted:false,expiresAt:1800000000000+lifetime});a.storageEvent();assert.equal(a.reloads,1);
assert.ok(!bootstrap.includes("gtag('consent'"));
console.log('PASS: fresh/declined/saved/expired/malformed choices; 180-day expiry; blocked storage; equal-action wiring; footer focus; repeat/duplicate grant; withdrawal disable/reload and targeted cookie deletion attempts; cross-tab withdrawal; Consent Mode absent. Browser rendering, cookie deletion semantics and Google collection not tested.');
