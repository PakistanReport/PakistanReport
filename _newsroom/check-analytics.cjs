// Offline bootstrap regression checks. Not a Jekyll or live browser test.
const fs = require('fs');
const vm = require('vm');
const assert = require('assert/strict');
const path = require('path');
const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, '_includes/analytics.html'), 'utf8');
function setup(id = 'G-LOCALTEST', origin = 'https://pakistanreport.pakistanreportnews.workers.dev', consent = false) {
  const appended = [], listeners = {};
  const window = {location:{origin,reload:()=>{}},pakistanReportAnalyticsConsent:consent,
    addEventListener:(name,fn)=>{listeners[name]=fn;}};
  const document = {head:{appendChild:s=>appended.push(s)},createElement:()=>({})};
  const code = source.match(/<script>([\s\S]*?)<\/script>/)[1]
    .replace('{{ site.analytics.measurement_id | jsonify }}', JSON.stringify(id))
    .replace('{{ site.url | jsonify }}', JSON.stringify('https://pakistanreport.pakistanreportnews.workers.dev'));
  const context = vm.createContext({window,document,Date,encodeURIComponent});
  vm.runInContext(code,context);
  return {window, appended, context, code, choose:granted=>listeners['pakistan-report:analytics-consent']({detail:{granted}})};
}
let a=setup();assert.equal(a.appended.length,0);a.choose(false);assert.equal(a.appended.length,0);
a.choose(true);a.choose(true);assert.equal(a.appended.length,1);
assert.equal(a.window.dataLayer.filter(x=>x[0]==='config').length,1);
assert.equal(a.window.dataLayer.find(x=>x[0]==='config')[2].allow_google_signals,false);
a.choose(false);assert.equal(a.window['ga-disable-G-LOCALTEST'],true);
vm.runInContext(a.code,a.context);assert.equal(a.appended.length,1);
assert.equal(setup('G-LOCALTEST',undefined,true).appended.length,1);
assert.equal(setup('G-LOCALTEST','https://preview.example',true).appended.length,0);
assert.equal(setup('INVALID',undefined,true).appended.length,0);
assert.equal(setup('',undefined,true).appended.length,0);
for(const file of ['_layouts/default.html','_layouts/article.html']) {
 assert.equal(fs.readFileSync(path.join(root,file),'utf8').split('{% include analytics.html %}').length-1,1);
}
assert.ok(source.includes("jekyll.environment == 'production' and site.analytics.enabled == true"));
console.log('PASS: offline consent/loading guards, invalid ID, wrong origin, duplicate prevention, withdrawal disable flag, single config, layout wiring. Liquid render and Google network tests pending.');
