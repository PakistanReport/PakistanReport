import {knownGroup} from './ownership.js';

// Desired coverage, NOT permission or invented feed endpoints. Homepages and
// RSS directories below are audit references; manual placeholders cannot poll.
const entries = [
 ['dawn','Dawn',1,'https://www.dawn.com/','https://www.dawn.com/feeds/home','rss'],
 ['geo','Geo News',1,'https://www.geo.tv/','https://www.geo.tv/rss','rss-directory'],
 ['tribune','Express Tribune',1,'https://tribune.com.pk/','https://tribune.com.pk/rss','rss-directory'],
 ['ary','ARY News',1,'https://arynews.tv/',null,'unestablished'],
 ['the-news','The News International',1,'https://www.thenews.com.pk/','https://www.thenews.com.pk/rss','rss-directory'],
 ['dunya','Dunya News',1,'https://dunyanews.tv/',null,'unestablished'],
 ['samaa','Samaa',1,'https://www.samaa.tv/',null,'unestablished'],
 ['aaj','Aaj News',1,'https://english.aaj.tv/',null,'unestablished'],
 ['news24','24 News HD',1,'https://www.24newshd.tv/',null,'unestablished'],
 ['hum','Hum News',1,'https://humenglish.com/',null,'unestablished'],
 ['business-recorder','Business Recorder',2,'https://www.brecorder.com/',null,'unestablished'],
 ['propakistani','ProPakistani',2,'https://propakistani.pk/',null,'unestablished'],
 ['pakistan-today','Pakistan Today',2,'https://www.pakistantoday.com.pk/',null,'unestablished'],
 ['nation','The Nation',2,'https://www.nation.com.pk/','https://www.nation.com.pk/rss','rss-directory'],
 ['daily-times','Daily Times',3,'https://dailytimes.com.pk/',null,'unestablished'],
 ['pakistan-observer','Pakistan Observer',3,'https://pakobserver.net/',null,'unestablished'],
 ['bol','BOL News',3,'https://www.bolnews.com/',null,'unestablished'],
 ['gnn','GNN',3,'https://gnnhd.tv/',null,'unestablished'],
 ['public-news','Public News',3,'https://publicnews.com/',null,'unestablished'],
 ['abb-takk','Abb Takk',3,'https://abbtakk.tv/',null,'unestablished'],
 ['daily-pakistan','Daily Pakistan',3,'https://dailypakistan.com.pk/',null,'rss-advertised'],
 ['jang','Jang',3,'https://jang.com.pk/','https://jang.com.pk/rss','rss-directory'],
 ['express','Express News / Daily Express',3,'https://www.express.pk/',null,'unestablished'],
 ['reuters','Reuters',1,'https://www.reuters.com/world/asia-pacific/',null,'manual'],
 ['bbc','BBC',1,'https://www.bbc.com/news',null,'unestablished'],
 ['cnn','CNN',1,'https://www.cnn.com/',null,'unestablished'],
 ['app','Associated Press of Pakistan',3,'https://www.app.com.pk/',null,'unestablished'],
];
const extraReasons = {
 dawn:'Written permission for this newsroom use remains required.',
 samaa:'Prior web audit returned 403; no bypass attempted.',
 'daily-times':'Prior web audit timed out; connector reliability is unknown.',
 reuters:'Automated rights not established; retain manual-only status.',
 bbc:'Business-use permission and exact feed not established.',
 cnn:'Prior feed/terms retrieval unsuccessful; access scope unestablished.',
 'business-recorder':'Desirable economy/markets/companies/energy/banking gap; needs an offered feed and permission.',
 propakistani:'Desirable technology/telecom/digital-economy gap; needs an offered feed and permission.',
 app:'Supporting reference only; APP copy is not automatically primary evidence or freely reusable.',
};
export const DESIRED_RADAR = entries.map(([id,name,priorityTier,url,reference,mechanism])=>{
 const world=['reuters','bbc','cnn'].includes(id), supporting=id==='app';
 const group=knownGroup({id,url});
 const specialist=id==='business-recorder'||id==='propakistani';
 const disabledReason=(extraReasons[id]||'Automated newsroom-use permission is not established.')+
   ' Exact endpoint, restrictions and runtime retrieval must be reviewed before enabling.';
 return {
  id,name,role:'reporting',purpose:supporting?'evidence':'radar',
  desiredEditorialRole:supporting?'supporting-reference':world?'world-general-news':specialist?'specialist':priorityTier===3?'secondary-discovery':'general-news',
  priorityTier,priority:[0,80,70,50][priorityTier],authority:0.85,
  category:world?'World':id==='business-recorder'?'Business':id==='propakistani'?'Technology':'Pakistan',
  coverage:world?['World']:id==='business-recorder'?['Economy','Markets','Companies','Energy','Banking']:id==='propakistani'?['Technology','Telecom','Digital economy','Business']:['Pakistan','Politics','Economy','Business'],
  language:['jang','express','daily-pakistan'].includes(id)?'ur':'en',
  type:'manual',url,hosts:[new URL(url).hostname],intervalMinutes:120,
  owner:group?.group||'Unreviewed ownership',
  ownership:group?{status:'conservative',group:group.group,reference:group.reference,reviewedAt:'2026-09-13T00:00:00Z'}:{status:'unknown',group:null,reference:null},
  discovery:{mechanism,reference:reference||url,endpoint:mechanism==='rss'?reference:null},
  discoveryPermission:{status:'unreviewed',basis:null,reference:null,reviewedAt:null,endpoint:null,hosts:[]},
  enabled:false,restrictionsReviewed:false,disabledReason,restrictionNote:disabledReason,
 };
});
