(function(){'use strict';
/* ===== Plotline: data, catalog, geometry helpers, project state ===== */
const $ = id => document.getElementById(id);
function esc(s){return String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function num(v,d,lo,hi){v=Number(v);if(!isFinite(v))v=d;if(lo!=null&&v<lo)v=lo;if(hi!=null&&v>hi)v=hi;return v;}
function uid(){return Math.random().toString(36).slice(2,9)+Math.random().toString(36).slice(2,4);}
function hash(str){let h=2166136261;for(let i=0;i<str.length;i++){h^=str.charCodeAt(i);h=Math.imul(h,16777619);}return h>>>0;}
function rng(seed){let a=seed>>>0;return function(){a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}
function round2(n){return Math.round(n*100)/100;}
const USD=new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'});
const USD0=new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:0});
function money(n){return USD.format(n);}
function todayISO(){const d=new Date();return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');}
function fmtDate(iso){const m=/^(\d{4})-(\d{2})-(\d{2})$/.exec(iso||'');if(!m)return iso||'';const d=new Date(+m[1],+m[2]-1,+m[3]);return d.toLocaleDateString('en-US',{year:'numeric',month:'long',day:'numeric'});}
function fmtHour(h){let hh=Math.floor(h),mm=Math.round((h-hh)*60);if(mm===60){hh++;mm=0;}const ap=hh>=12&&hh<24?'PM':'AM';let h12=hh%12;if(h12===0)h12=12;return h12+':'+String(mm).padStart(2,'0')+' '+ap;}

/* ---- polygon helpers (points are [x, z] in feet) ---- */
function polyArea(p){let a=0;for(let i=0;i<p.length;i++){const j=(i+1)%p.length;a+=p[i][0]*p[j][1]-p[j][0]*p[i][1];}return Math.abs(a)/2;}
function polyPerim(p){let L=0;for(let i=0;i<p.length;i++){const j=(i+1)%p.length;L+=Math.hypot(p[j][0]-p[i][0],p[j][1]-p[i][1]);}return L;}
function polyLen(p){let L=0;for(let i=1;i<p.length;i++)L+=Math.hypot(p[i][0]-p[i-1][0],p[i][1]-p[i-1][1]);return L;}
function inPoly(x,z,p){let c=false;for(let i=0,j=p.length-1;i<p.length;j=i++){const xi=p[i][0],zi=p[i][1],xj=p[j][0],zj=p[j][1];if(((zi>z)!==(zj>z))&&(x<(xj-xi)*(z-zi)/(zj-zi)+xi))c=!c;}return c;}
function centroid(p){let a=0,cx=0,cz=0;for(let i=0;i<p.length;i++){const j=(i+1)%p.length;const f=p[i][0]*p[j][1]-p[j][0]*p[i][1];a+=f;cx+=(p[i][0]+p[j][0])*f;cz+=(p[i][1]+p[j][1])*f;}if(Math.abs(a)<1e-6){let sx=0,sz=0;p.forEach(q=>{sx+=q[0];sz+=q[1];});return[sx/p.length,sz/p.length];}return[cx/(3*a),cz/(3*a)];}
function lineMid(p){const total=polyLen(p);let acc=0;for(let i=1;i<p.length;i++){const L=Math.hypot(p[i][0]-p[i-1][0],p[i][1]-p[i-1][1]);if(acc+L>=total/2){const t=L?(total/2-acc)/L:0;return[p[i-1][0]+(p[i][0]-p[i-1][0])*t,p[i-1][1]+(p[i][1]-p[i-1][1])*t];}acc+=L;}return p[0];}

/* ---- catalog ----
   kind: point (placed one by one), area (drawn shape, priced per sq ft), line (drawn path, priced per linear ft).
   price = starter installed cost per unit; the designer edits these in the Prices tab. */
const GROUPS=[
  {id:'trees',name:'Trees'},
  {id:'plants',name:'Plants'},
  {id:'features',name:'Features'},
  {id:'surfaces',name:'Surfaces'},
  {id:'edges',name:'Fences & walls'}
];
const CATALOG=[
  {id:'maple',name:'Japanese maple',group:'trees',kind:'point',unit:'ea',price:340,h:10,sp:8,style:'ornamental',color:'#8C2F3B',color2:'#B2453F'},
  {id:'shade',name:'Shade tree',group:'trees',kind:'point',unit:'ea',price:420,h:30,sp:22,style:'round',color:'#4F8A3C',color2:'#6BA24A'},
  {id:'conifer',name:'Evergreen (fir / spruce)',group:'trees',kind:'point',unit:'ea',price:260,h:26,sp:11,style:'conifer',color:'#2B5B3C'},
  {id:'arb',name:'Columnar evergreen',group:'trees',kind:'point',unit:'ea',price:95,h:12,sp:3.5,style:'column',color:'#2F6B3F'},
  {id:'bloom',name:'Flowering tree',group:'trees',kind:'point',unit:'ea',price:310,h:16,sp:13,style:'round',color:'#E7A6BC',color2:'#F3C4D3',trunk:'#5B4636'},

  {id:'rhodo',name:'Rhododendron',group:'plants',kind:'point',unit:'ea',price:65,h:4.5,sp:4.5,style:'mound',color:'#2D5F3B',flower:'#D95C8A'},
  {id:'hydr',name:'Hydrangea',group:'plants',kind:'point',unit:'ea',price:48,h:4,sp:4.5,style:'mound',color:'#3B7A44',flower:'#8EA6E8'},
  {id:'box',name:'Boxwood (clipped)',group:'plants',kind:'point',unit:'ea',price:38,h:3,sp:3,style:'clipped',color:'#2E5E37'},
  {id:'grass',name:'Ornamental grass',group:'plants',kind:'point',unit:'ea',price:24,h:3.5,sp:3,style:'grass',color:'#C8B26B'},
  {id:'fern',name:'Sword fern',group:'plants',kind:'point',unit:'ea',price:22,h:3,sp:4,style:'fern',color:'#3F7D3C'},
  {id:'lav',name:'Lavender',group:'plants',kind:'point',unit:'ea',price:18,h:2,sp:2.5,style:'mound',color:'#6F7F63',flower:'#8B6FC0'},
  {id:'peren',name:'Perennial (coneflower)',group:'plants',kind:'point',unit:'ea',price:14,h:2.5,sp:2,style:'mound',color:'#4C8B45',flower:'#D77FA1'},

  {id:'boulder',name:'Boulder',group:'features',kind:'point',unit:'ea',price:180,h:2.5,sp:3.5,style:'rock',color:'#8A8A84'},
  {id:'pot',name:'Planter pot',group:'features',kind:'point',unit:'ea',price:95,h:3,sp:2.5,style:'pot',color:'#B3673F'},
  {id:'bench',name:'Garden bench',group:'features',kind:'point',unit:'ea',price:420,h:3,w:5,d:1.8,style:'bench',color:'#8B6B4A'},
  {id:'firepit',name:'Fire pit',group:'features',kind:'point',unit:'ea',price:650,h:1.2,sp:4,style:'firepit',color:'#7A7772'},
  {id:'light',name:'Path light',group:'features',kind:'point',unit:'ea',price:85,h:2.5,sp:0.8,style:'light',color:'#2E3234'},
  {id:'raised',name:'Raised bed 4 x 8',group:'features',kind:'point',unit:'ea',price:320,h:1.3,w:8,d:4,style:'raised',color:'#9A7249'},
  {id:'pergola',name:'Pergola 10 x 10',group:'features',kind:'point',unit:'ea',price:4800,h:9,w:10,d:10,style:'pergola',color:'#8A6A48'},
  {id:'shed',name:'Garden shed 10 x 8',group:'features',kind:'point',unit:'ea',price:3900,h:9,w:10,d:8,style:'shed',color:'#8F9A8C'},

  {id:'lawn',name:'Lawn (sod)',group:'surfaces',kind:'area',unit:'sf',price:2.1,h:0.06,color:'#6BA04A',tex:'lawn'},
  {id:'bed',name:'Planting bed + bark',group:'surfaces',kind:'area',unit:'sf',price:1.6,h:0.16,color:'#5A3B2A',tex:'mulch'},
  {id:'cover',name:'Groundcover planting',group:'surfaces',kind:'area',unit:'sf',price:6.5,h:0.14,color:'#4E8B4B',tex:'cover'},
  {id:'gravel',name:'Gravel / river rock',group:'surfaces',kind:'area',unit:'sf',price:2.7,h:0.12,color:'#B3AB9D',tex:'gravel'},
  {id:'pavers',name:'Paver patio',group:'surfaces',kind:'area',unit:'sf',price:19,h:0.2,color:'#B8A28A',tex:'pavers'},
  {id:'concrete',name:'Concrete slab / walk',group:'surfaces',kind:'area',unit:'sf',price:11,h:0.2,color:'#C4C4BE',tex:'concrete'},
  {id:'deck',name:'Wood deck',group:'surfaces',kind:'area',unit:'sf',price:42,h:1.2,color:'#9B6C44',tex:'deck'},
  {id:'drive',name:'Driveway (asphalt)',group:'surfaces',kind:'area',unit:'sf',price:8.5,h:0.15,color:'#4A4C4F',tex:'asphalt'},
  {id:'pond',name:'Pond / water feature',group:'surfaces',kind:'area',unit:'sf',price:38,h:0.1,color:'#3E7FA8',water:true},
  {id:'house',name:'Existing house',group:'surfaces',kind:'area',unit:'sf',price:0,h:18,color:'#DAD3C6',building:true,excluded:true},

  {id:'fence6',name:'Wood fence, 6 ft',group:'edges',kind:'line',unit:'lf',price:38,h:6,t:0.25,color:'#A57C55'},
  {id:'fence4',name:'Picket fence, 4 ft',group:'edges',kind:'line',unit:'lf',price:28,h:4,t:0.2,color:'#EDEAE2'},
  {id:'wall',name:'Retaining wall (block)',group:'edges',kind:'line',unit:'lf',price:62,h:2.5,t:1.2,color:'#8E897F'},
  {id:'edging',name:'Steel / stone edging',group:'edges',kind:'line',unit:'lf',price:9,h:0.35,t:0.15,color:'#454B4E'},
  {id:'hedge',name:'Hedge row',group:'edges',kind:'line',unit:'lf',price:32,h:5,t:2.2,color:'#2D5E37'}
];
const CAT={};CATALOG.forEach(c=>{CAT[c.id]=c;});
const UNIT_LONG={ea:'each',sf:'sq ft',lf:'lin ft'};
const KIND_LABEL={point:'Placed item',area:'Surface',line:'Fence / wall / edging'};
const DEFAULT_TERMS='A deposit is due at signing and the balance is due on completion. This proposal is valid for the number of days shown above. Changes to the scope need written approval and may change the price. Plant species and sizes may be substituted with equivalents based on availability.';

/* ---- project state ---- */
function blankState(name){
  return{v:1,id:uid(),updated:Date.now(),
    meta:{name:name||'Untitled project',client:'',address:'',company:'',contact:'',date:todayISO(),valid:30,scope:'',terms:DEFAULT_TERMS,markup:20,tax:0},
    look:1,lot:{w:60,d:40,lat:45},sun:{month:6,hour:16},snap:1,prices:{},custom:[],objects:[]};
}
function sampleState(){
  const s=blankState('Sample backyard');
  s.meta.client='Sample client';s.meta.address='Backyard redesign (example site)';
  const A=(cat,pts,x)=>s.objects.push(Object.assign({id:uid(),cat,pts,label:'',price:null,note:'',height:null},x||{}));
  const P=(cat,x,z,x2)=>s.objects.push(Object.assign({id:uid(),cat,x,z,rot:0,scale:1,count:1,label:'',price:null,note:''},x2||{}));
  A('house',[[-26,-20],[10,-20],[10,-8],[-26,-8]],{label:'Existing house'});
  A('lawn',[[-30,4],[-14,6],[0,4],[10,2],[30,2],[30,14],[10,13],[-10,14],[-30,12]]);
  A('bed',[[-30,12],[-10,14],[10,13],[30,14],[30,20],[-30,20]],{label:'South border'});
  A('bed',[[12,-8],[30,-8],[30,0],[20,0],[12,-3]],{label:'East bed'});
  A('pavers',[[-22,-8],[-6,-8],[-6,2],[-22,2]],{label:'Patio'});
  A('fence6',[[-30,-8],[-30,20],[30,20],[30,-8]]);
  P('pergola',-14,-3);
  P('bench',-14,-6.6);
  P('firepit',-2,7.5);
  P('shade',-22,9,{scale:0.7});
  P('maple',22,-4);
  P('bloom',10,16.5);
  P('arb',-22,18.5);P('arb',-18,18.8);P('arb',-14,19);
  P('conifer',-27,15.5,{scale:0.75});
  P('shed',23,15,{note:'Pad-mounted shed, slab by others.'});
  P('hydr',-6,16.5,{count:5});
  P('rhodo',1,17,{count:3});
  P('grass',16,-4,{count:9});
  P('fern',27,-3,{count:7});
  P('lav',-26,-3,{count:9});
  P('boulder',14,6);
  P('raised',4,-5);
  P('light',-5,3.5);P('light',-23,3.5);
  return s;
}
function normObj(o,seen){
  if(!o||typeof o!=='object')return null;const c=CAT[o.cat];if(!c)return null;
  let id=(typeof o.id==='string'&&o.id)?o.id.slice(0,24):uid();if(seen.has(id))id=uid();seen.add(id);
  const r={id,cat:c.id,label:String(o.label||'').slice(0,60),note:String(o.note||'').slice(0,400),price:(o.price===null||o.price===undefined||o.price==='')?null:num(o.price,0,0,1e7)};
  if(c.kind==='point'){r.x=num(o.x,0,-500,500);r.z=num(o.z,0,-500,500);r.rot=num(o.rot,0,-720,720);r.scale=num(o.scale,1,0.3,4);r.count=c.group==='plants'?Math.round(num(o.count,1,1,999)):1;}
  else{
    const need=c.kind==='area'?3:2;
    const pts=Array.isArray(o.pts)?o.pts.map(p=>Array.isArray(p)?[num(p[0],0,-500,500),num(p[1],0,-500,500)]:null).filter(Boolean):[];
    if(pts.length<need)return null;r.pts=pts.slice(0,200);
    r.height=(o.height===null||o.height===undefined)?null:num(o.height,c.h,0.02,60);
  }
  return r;
}
function normalizeState(raw){
  const s=blankState();if(!raw||typeof raw!=='object')return s;
  if(typeof raw.id==='string'&&raw.id)s.id=raw.id.slice(0,24);
  s.updated=num(raw.updated,Date.now());
  const m=raw.meta||{};
  ['name','client','address','company','contact','scope','terms'].forEach(k=>{if(typeof m[k]==='string')s.meta[k]=m[k].slice(0,k==='terms'||k==='scope'?2000:120);});
  if(!s.meta.name.trim())s.meta.name='Untitled project';
  if(typeof m.date==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(m.date))s.meta.date=m.date;
  s.meta.valid=Math.round(num(m.valid,30,1,365));s.meta.markup=num(m.markup,20,0,300);s.meta.tax=num(m.tax,0,0,30);
  const l=raw.lot||{};s.lot.w=num(l.w,60,10,400);s.lot.d=num(l.d,40,10,400);s.lot.lat=num(l.lat,45,0,70);
  const su=raw.sun||{};s.sun.month=Math.round(num(su.month,6,1,12));s.sun.hour=num(su.hour,16,5,21);
  s.look=[0,1,2].includes(Number(raw.look))?Number(raw.look):1;
  s.snap=[0,0.5,1,2].includes(Number(raw.snap))?Number(raw.snap):1;
  if(raw.prices&&typeof raw.prices==='object')for(const k in raw.prices){if(CAT[k]&&!CAT[k].excluded){const v=Number(raw.prices[k]);if(isFinite(v)&&v>=0)s.prices[k]=v;}}
  if(Array.isArray(raw.custom))s.custom=raw.custom.slice(0,40).map(c=>({id:(typeof c.id==='string'&&c.id)?c.id.slice(0,24):uid(),name:String(c.name||'').slice(0,80),qty:num(c.qty,1,0,1e6),unit:String(c.unit||'').slice(0,10),price:num(c.price,0,0,1e7)}));
  if(Array.isArray(raw.objects)){const seen=new Set();s.objects=raw.objects.slice(0,400).map(o=>normObj(o,seen)).filter(Boolean);}
  return s;
}
function unitCostOf(S,c){const v=S.prices[c.id];return v!=null?v:c.price;}
function qtyOfObj(o){const c=CAT[o.cat];if(c.kind==='point')return o.count||1;if(c.kind==='area')return polyArea(o.pts);return polyLen(o.pts);}

/* ---- estimate: unit prices are your installed cost; markup turns them into the client price ---- */
function estimate(S){
  const mk=1+S.meta.markup/100;const map=new Map();
  S.objects.forEach(o=>{
    const c=CAT[o.cat];if(c.excluded)return;
    const uc=o.price!=null?o.price:unitCostOf(S,c);const key=o.cat+'|'+uc;
    let r=map.get(key);if(!r){r={cat:c,unitCost:uc,qty:0,custom:o.price!=null};map.set(key,r);}
    r.qty+=qtyOfObj(o);
  });
  const groups=GROUPS.map(g=>({g,rows:[]}));let costSum=0,lineSum=0;
  const order=CATALOG.map(c=>c.id);
  Array.from(map.values()).sort((a,b)=>order.indexOf(a.cat.id)-order.indexOf(b.cat.id)||a.unitCost-b.unitCost).forEach(r=>{
    const c=r.cat;
    r.qty=c.kind==='area'?Math.round(r.qty):c.kind==='line'?Math.round(r.qty*10)/10:r.qty;
    if(r.qty<=0)return;
    r.clientUnit=r.unitCost*mk;r.total=round2(r.qty*r.clientUnit);r.cost=r.qty*r.unitCost;
    costSum+=r.cost;lineSum+=r.total;
    groups.find(g=>g.g.id===c.group).rows.push(r);
  });
  const custom=S.custom.filter(c=>c.name.trim()||c.price>0).map(c=>({name:c.name.trim()||'Additional item',qty:c.qty,unit:c.unit,price:c.price,total:round2(c.qty*c.price)}));
  const customSum=custom.reduce((a,c)=>a+c.total,0);
  const subtotal=round2(lineSum+customSum);const tax=round2(subtotal*S.meta.tax/100);
  return{groups:groups.filter(g=>g.rows.length),custom,costSum:round2(costSum),lineSum:round2(lineSum),customSum:round2(customSum),markupAmt:round2(lineSum-costSum),subtotal,tax,total:round2(subtotal+tax)};
}
/* ===== Plotline: materials, textures and mesh helpers (units are feet, y is up) ===== */
let Q=1;                                   /* look: 0 sketch, 1 standard, 2 realistic */
let envI=0.6;                              /* environment light strength (realistic only) */
const LOOKS=[
  {name:'Sketch',desc:'White massing with ink outlines. Quick and clean for early layouts.'},
  {name:'Standard',desc:'Colored low-poly models. The everyday working view.'},
  {name:'Realistic',desc:'Textured surfaces, detailed plants, grass, sky and soft light. Heavier on older devices.'}
];
const INK=0x2B2A27;
function lin(hex){const c=new THREE.Color(hex);if(Q===2)c.convertSRGBToLinear();return c;}
function clay(hex){return '#'+new THREE.Color('#ECE8DF').lerp(new THREE.Color(hex),0.26).getHexString();}
function shade(hex,f){const c=new THREE.Color(hex);c.r=Math.min(1,c.r*f);c.g=Math.min(1,c.g*f);c.b=Math.min(1,c.b*f);return '#'+c.getHexString();}
function jit(hex,R){return shade(hex,0.86+R()*0.3);}

/* ---- materials (cached per look) ---- */
const _mat={};
function M(hex,opt){
  const k=Q+'|'+hex+(opt?JSON.stringify(opt):'');
  if(_mat[k])return _mat[k];
  const o=Object.assign({roughness:Q===2?.84:.92,metalness:0,flatShading:Q!==2},opt||{});
  const tx=o.tx;delete o.tx;
  let col=hex;
  if(Q===0){col=clay(hex);if(o.emissive)o.emissiveIntensity=0;}
  o.color=lin(col);
  if(o.emissive)o.emissive=lin(o.emissive);
  if(Q===2&&tx){const t=surfTex(tx);o.map=t;o.bumpMap=t;o.bumpScale=tx==='leaf'?1.6:1.1;}
  const m=new THREE.MeshStandardMaterial(o);
  if(Q===2)m.envMapIntensity=envI;
  return(_mat[k]=m);
}
function setEnvI(v){envI=v;Object.keys(_mat).forEach(k=>{if(k[0]==='2')_mat[k].envMapIntensity=v;});Object.keys(_tm).forEach(k=>{if(k[0]==='2')_tm[k].envMapIntensity=v;});_envList.forEach(m=>{m.envMapIntensity=v;});}

/* ---- shared helpers ---- */
const EDGE=new THREE.LineBasicMaterial({color:INK});
const HULL=new THREE.MeshBasicMaterial({color:INK,side:THREE.BackSide});
function addEdges(m,geo,ang){const e=new THREE.LineSegments(new THREE.EdgesGeometry(geo,ang),EDGE);e.raycast=function(){};m.add(e);return e;}
function mesh(g,geo,mt,x,y,z){
  const m=new THREE.Mesh(geo,mt);m.position.set(x||0,y||0,z||0);m.castShadow=true;m.receiveShadow=true;g.add(m);
  if(Q===0&&geo.type!=='IcosahedronGeometry'&&geo.type!=='SphereGeometry')addEdges(m,geo,32);
  return m;
}
function tag(o,id){o.traverse(n=>{n.userData.objId=id;});return o;}
/* box whose UVs are in feet, so a texture with repeat 1/tile keeps its scale on any size */
function boxFt(w,h,d){
  const g=new THREE.BoxGeometry(w,h,d),uv=g.attributes.uv,sc=[[d,h],[d,h],[w,d],[w,d],[w,h],[w,h]];
  for(let f=0;f<6;f++)for(let v=0;v<4;v++){const i=f*4+v;uv.setXY(i,uv.getX(i)*sc[f][0],uv.getY(i)*sc[f][1]);}
  return g;
}

/* ---- lumpy shared geometry for foliage and rocks (realistic) ---- */
const _blobs=[],_rocks=[];
function blobGeo(i){
  i=((i%6)+6)%6;if(_blobs[i])return _blobs[i];
  const g=new THREE.IcosahedronGeometry(1,3),p=g.attributes.position,R=rng(9000+i*131),a=R()*6,b=R()*6,c=R()*6;
  for(let j=0;j<p.count;j++){const x=p.getX(j),y=p.getY(j),z=p.getZ(j);
    const d=1+0.13*Math.sin(x*4.2+a)*Math.cos(y*3.6+b)+0.09*Math.sin(z*5.1+c+x*2)+0.05*Math.sin((x+y+z)*9+a);
    p.setXYZ(j,x*d,y*d,z*d);}
  p.needsUpdate=true;g.userData.shared=true;return(_blobs[i]=g);
}
function rockGeo(i){
  i=((i%4)+4)%4;if(_rocks[i])return _rocks[i];
  const g=new THREE.IcosahedronGeometry(1,1),p=g.attributes.position,R=rng(4100+i*53),a=R()*6,b=R()*6;
  for(let j=0;j<p.count;j++){const x=p.getX(j),y=p.getY(j),z=p.getZ(j);
    const d=1+0.26*Math.sin(x*3.1+a)*Math.cos(z*2.7+b)+0.14*Math.sin(y*4.3+a*b);
    p.setXYZ(j,x*d,y*d*0.9,z*d);}
  p.needsUpdate=true;g.userData.shared=true;return(_rocks[i]=g);
}
function ell(g,rx,ry,rz,x,y,z,hex,detail){
  let m;
  if(Q===2)m=mesh(g,blobGeo(Math.round(Math.abs(x*13+y*7+z*5+rx*3))),M(hex,{tx:'leaf'}),x,y,z);
  else m=mesh(g,new THREE.IcosahedronGeometry(1,detail==null?1:detail),M(hex),x,y,z);
  m.scale.set(rx,ry,rz);
  if(Q===0){const h=new THREE.Mesh(m.geometry,HULL);h.position.copy(m.position);h.scale.set(rx+0.1,ry+0.1,rz+0.1);g.add(h);}
  return m;
}

/* ---- detail textures used by the realistic look (grayscale, tinted by the material color) ---- */
const _st={};
function surfTex(kind){
  if(_st[kind])return _st[kind];
  const N=256,c=document.createElement('canvas');c.width=c.height=N;const g=c.getContext('2d'),R=rng(hash('st'+kind));
  const gr=v=>{v=Math.max(0,Math.min(255,v|0));return 'rgb('+v+','+v+','+v+')';};
  const fill=v=>{g.fillStyle=gr(v);g.fillRect(0,0,N,N);};
  if(kind==='leaf'){
    fill(215);
    for(let i=0;i<650;i++){g.fillStyle=gr(150+R()*105);g.save();g.translate(R()*N,R()*N);g.rotate(R()*6.28);g.beginPath();g.ellipse(0,0,5+R()*9,2.2+R()*2.6,0,0,6.2832);g.fill();g.restore();}
    for(let i=0;i<220;i++){g.fillStyle='rgba(60,60,60,.45)';g.beginPath();g.arc(R()*N,R()*N,1+R()*2,0,6.2832);g.fill();}
  }else if(kind==='bark'){
    fill(175);
    for(let i=0;i<240;i++){const x=R()*N;g.strokeStyle=gr(70+R()*120);g.lineWidth=1+R()*2.4;g.beginPath();g.moveTo(x,0);for(let y=0;y<=N;y+=32)g.lineTo(x+(R()-.5)*5,y);g.stroke();}
  }else if(kind==='wood'){
    fill(218);
    for(let i=0;i<110;i++){const y=R()*N;g.strokeStyle='rgba('+(120+R()*80|0)+','+(100+R()*60|0)+',70,.35)';g.lineWidth=.6+R()*1.4;g.beginPath();g.moveTo(0,y);for(let x=0;x<=N;x+=32)g.lineTo(x,y+(R()-.5)*3);g.stroke();}
  }else if(kind==='stone'){
    fill(190);
    for(let i=0;i<1300;i++){g.fillStyle=gr(110+R()*130);g.beginPath();g.arc(R()*N,R()*N,.6+R()*1.8,0,6.2832);g.fill();}
  }else if(kind==='siding'){
    fill(236);
    for(let y=0;y<N;y+=16){g.fillStyle=gr(150);g.fillRect(0,y,N,2);g.fillStyle=gr(252);g.fillRect(0,y+2,N,1);}
  }else if(kind==='shingle'){
    fill(110);
    for(let r=0;r<N/24;r++){for(let x=-32;x<N;x+=32){const o=(r%2)*16;g.fillStyle=gr(80+R()*70);g.fillRect(x+o,r*24,31,23);}}
  }else if(kind==='board'){
    fill(215);
    for(let x=0;x<N;x+=32){g.fillStyle=gr(110);g.fillRect(x,0,2,N);for(let i=0;i<6;i++){g.fillStyle='rgba(120,90,60,.22)';g.fillRect(x+3+R()*24,0,1,N);}}
  }else if(kind==='picket'){
    g.clearRect(0,0,N,N);
    for(let i=0;i<4;i++){const x=i*64+7;g.fillStyle=gr(228);g.beginPath();g.moveTo(x,N);g.lineTo(x,40);g.lineTo(x+25,12);g.lineTo(x+50,40);g.lineTo(x+50,N);g.closePath();g.fill();g.fillStyle='rgba(90,70,40,.18)';g.fillRect(x+12,40,1.5,N);g.fillRect(x+34,40,1.5,N);}
  }else if(kind==='block'){
    fill(170);
    for(let r=0;r<N/32;r++){g.fillStyle=gr(95);g.fillRect(0,r*32,N,3);for(let x=(r%2)*32;x<N+64;x+=64){g.fillRect(x,r*32,3,32);}}
    for(let i=0;i<500;i++){g.fillStyle=gr(120+R()*110);g.fillRect(R()*N,R()*N,2,2);}
  }
  const t=new THREE.CanvasTexture(c);t.wrapS=t.wrapT=THREE.RepeatWrapping;t.anisotropy=8;t.encoding=THREE.sRGBEncoding;
  const rep={leaf:[2,2],bark:[1,2],siding:[.25,.25],shingle:[.33,.33],board:[.25,.25],picket:[.5,.25],block:[.25,.25]}[kind]||[1,1];
  t.repeat.set(rep[0],rep[1]);return(_st[kind]=t);
}

/* ---- ground surface textures (one tile covers `ft` feet) ---- */
const TEXFT={lawn:8,mulch:4,cover:4,gravel:3,pavers:4,concrete:4,deck:4,asphalt:4};
function texCanvas(kind,base,SZ,blot){
  const c=document.createElement('canvas');c.width=c.height=SZ;const g=c.getContext('2d'),u=SZ/256,R=rng(hash(kind));
  g.fillStyle=base;g.fillRect(0,0,SZ,SZ);
  const speck=(n,cols,r0,r1)=>{n=Math.round(n*u*u);for(let i=0;i<n;i++){g.fillStyle=cols[(R()*cols.length)|0];g.beginPath();g.arc(R()*SZ,R()*SZ,(r0+R()*(r1-r0))*u,0,6.2832);g.fill();}};
  if(blot){for(let i=0;i<26;i++){const x=R()*SZ,y=R()*SZ,r=(50+R()*90)*u,gg=g.createRadialGradient(x,y,0,x,y,r),w=R()>.5;gg.addColorStop(0,w?'rgba(255,255,230,.07)':'rgba(0,20,0,.08)');gg.addColorStop(1,'rgba(0,0,0,0)');g.fillStyle=gg;g.fillRect(x-r,y-r,r*2,r*2);}}
  if(kind==='lawn'){
    const n=Math.round(1400*u*u*(blot?1.6:1));
    for(let i=0;i<n;i++){const x=R()*SZ,y=R()*SZ,a=-1.57+(R()-0.5)*1.2,l=(4+R()*8)*u;g.strokeStyle=R()>0.5?'rgba(255,255,255,'+(blot?0.07:0.10)+')':'rgba(0,40,0,'+(blot?0.10:0.14)+')';g.lineWidth=1.2*u;g.beginPath();g.moveTo(x,y);g.lineTo(x+Math.cos(a)*l,y+Math.sin(a)*l);g.stroke();}
  }else if(kind==='mulch'){speck(1800,['#6B4631','#4A2E1F','#7A5239','#3B241A'],1,3);}
  else if(kind==='cover'){speck(700,['#5FA05A','#3F7A3E','#76B36A','#356B38'],2,5);}
  else if(kind==='gravel'){speck(2200,['#CFC8BA','#968E80','#E2DCCE','#7F786B','#B9B1A2'],1,2.6);}
  else if(kind==='asphalt'){speck(2600,['#5A5C60','#3A3C3F','#6B6D71','#2F3133'],0.5,1.3);}
  else if(kind==='concrete'){speck(800,['#B2B2AB','#D3D3CD','#A4A49D'],0.6,1.4);g.strokeStyle='rgba(70,70,66,0.55)';g.lineWidth=3*u;g.beginPath();g.moveTo(0,u);g.lineTo(SZ,u);g.moveTo(u,0);g.lineTo(u,SZ);g.stroke();}
  else if(kind==='pavers'){
    const bh=32*u,bw=64*u;
    for(let row=0;row<SZ/bh;row++){const off=(row%2)*bw/2;for(let col=-1;col<SZ/bw+1;col++){const x=col*bw+off,y=row*bh;g.fillStyle=R()>0.5?'rgba(255,255,255,'+(R()*0.14)+')':'rgba(60,30,10,'+(R()*0.14)+')';g.fillRect(x,y,bw,bh);g.strokeStyle='rgba(70,56,44,0.6)';g.lineWidth=2*u;g.strokeRect(x+u,y+u,bw-2*u,bh-2*u);}}
  }else if(kind==='deck'){
    const bh=SZ/8;
    for(let row=0;row<8;row++){const y=row*bh;g.fillStyle=R()>0.5?'rgba(255,230,190,'+(R()*0.16)+')':'rgba(40,18,0,'+(R()*0.16)+')';g.fillRect(0,y,SZ,bh);
      for(let k=0;k<7;k++){g.strokeStyle='rgba(60,30,10,0.18)';g.lineWidth=u;const yy=y+R()*bh;g.beginPath();g.moveTo(0,yy);g.lineTo(SZ,yy);g.stroke();}
      g.fillStyle='rgba(40,20,5,0.55)';g.fillRect(0,y,SZ,2*u);const bx=R()*SZ;g.fillRect(bx,y,2*u,bh);}
  }
  return c;
}
const _tex={};
function getTex(kind,base){
  const k=Q+kind+base;if(_tex[k])return _tex[k];
  const t=new THREE.CanvasTexture(texCanvas(kind,base,Q===2?512:256,Q===2));
  t.wrapS=t.wrapT=THREE.RepeatWrapping;t.anisotropy=8;if(Q===2)t.encoding=THREE.sRGBEncoding;
  const ft=TEXFT[kind]||4;t.repeat.set(1/ft,1/ft);return(_tex[k]=t);
}
const _tm={};
function texMat(c){
  const k=Q+c.id;if(_tm[k])return _tm[k];
  const t=getTex(c.tex,c.color),o={color:lin('#ffffff'),map:t,roughness:.95,metalness:0};
  if(Q===2){o.bumpMap=t;o.bumpScale=c.tex==='lawn'?0.3:0.9;}
  const m=new THREE.MeshStandardMaterial(o);if(Q===2){m.envMapIntensity=envI;groundPatch(m,c.gp||c.tex);}
  return(_tm[k]=m);
}
/* world-space color variation (hides texture tiling) plus subtle mowing stripes on lawn */
function groundPatch(m,kind){
  if(m.userData.gp)return m;m.userData.gp=kind;
  m.onBeforeCompile=function(sh){
    sh.vertexShader=sh.vertexShader.replace('#include <common>','#include <common>\nvarying vec3 vWP;').replace('#include <begin_vertex>','#include <begin_vertex>\nvWP=(modelMatrix*vec4(transformed,1.0)).xyz;');
    sh.fragmentShader=sh.fragmentShader.replace('#include <common>','#include <common>\nvarying vec3 vWP;\nfloat h2(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}\nfloat vn(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);return mix(mix(h2(i),h2(i+vec2(1.0,0.0)),f.x),mix(h2(i+vec2(0.0,1.0)),h2(i+vec2(1.0,1.0)),f.x),f.y);}\nfloat fbm(vec2 p){return vn(p)*0.55+vn(p*2.03)*0.3+vn(p*4.1)*0.15;}')
    .replace('#include <map_fragment>','#include <map_fragment>\n{float n=fbm(vWP.xz*0.1);float m2=fbm(vWP.xz*0.85+7.0);diffuseColor.rgb*=mix(0.92,1.09,n)*mix(0.96,1.04,m2);'
      +(kind==='lawn'||kind==='far'?'float st=sin(vWP.x*0.785)*0.5+0.5;diffuseColor.rgb*=1.0+'+(kind==='lawn'?'0.06':'0.0')+'*(st-0.5);diffuseColor.rgb=mix(diffuseColor.rgb,diffuseColor.rgb*vec3(1.07,1.03,0.86),smoothstep(0.55,0.8,fbm(vWP.xz*0.045+3.0))*0.3);':'')+'}');
  };
  m.customProgramCacheKey=()=>'ground'+kind;
  return m;
}

/* realistic water: rippled normals (animated with the wind clock) and edge reflectivity */
let _water=null;
function waterMat(){
  if(_water)return _water;
  const m=new THREE.MeshStandardMaterial({color:lin('#2B7A9E'),roughness:0.04,metalness:0,transparent:true,opacity:0.86});
  m.envMapIntensity=envI*1.5;_envList.push(m);
  m.onBeforeCompile=function(sh){
    sh.uniforms.uWT=WIND.t;
    sh.vertexShader=sh.vertexShader.replace('#include <common>','#include <common>\nvarying vec3 vWP;').replace('#include <begin_vertex>','#include <begin_vertex>\nvWP=(modelMatrix*vec4(transformed,1.0)).xyz;');
    sh.fragmentShader=sh.fragmentShader.replace('#include <common>','#include <common>\nvarying vec3 vWP;uniform float uWT;')
      .replace('#include <normal_fragment_maps>','#include <normal_fragment_maps>\n{vec2 p=vWP.xz;float t=uWT;vec2 g=vec2(cos(p.x*1.7+t*1.1)*0.02+cos(p.x*4.1+p.y*2.3-t*1.9)*0.025,cos(p.y*1.3-t*0.9)*0.016+cos(p.y*3.7-p.x*1.9+t*1.5)*0.022);normal=normalize(normal+(viewMatrix*vec4(g.x,0.0,g.y,0.0)).xyz);}')
      .replace('#include <dithering_fragment>','#include <dithering_fragment>\n{float fr=pow(1.0-abs(dot(normalize(vViewPosition),normal)),3.0);gl_FragColor.a=mix(0.82,0.99,fr);}');
  };
  m.customProgramCacheKey=()=>'water';
  return(_water=m);
}/* ===== Plotline: single-plant / feature builders. Each returns a Group with its base on y = 0 ===== */
function wd(c){return Q===2?M(c.color,{tx:'wood'}):M(c.color);}
const STYLES={
  round(c,R){
    if(Q===2)return treeHi(c,R);
    const g=new THREE.Group(),h=c.h,s=c.sp,th=h*0.46,hi=Q===2,tr=c.trunk||'#6B5140';
    mesh(g,new THREE.CylinderGeometry(s*0.03+0.1,s*0.045+0.16,th,hi?10:7),hi?M(tr,{tx:'bark'}):M(tr),0,th/2,0);
    if(hi){
      for(let i=0;i<4;i++){const a=i/4*6.283+R(),len=h*0.28,t=0.55,sn=Math.sin(t)*len*0.5;
        const L=mesh(g,new THREE.CylinderGeometry(0.05,0.13,len,6),M(tr,{tx:'bark'}),Math.cos(a)*sn,th*0.88+Math.cos(t)*len*0.5,Math.sin(a)*sn);
        L.rotation.order='YXZ';L.rotation.y=-a;L.rotation.z=-t;}
      for(let i=0;i<17;i++){
        const u=R()*6.283,v=Math.acos(2*R()-1),rho=Math.cbrt(R()),r=s*(0.14+R()*0.09);
        ell(g,r,r*0.86,r,Math.sin(v)*Math.cos(u)*rho*s*0.27,h*0.7+Math.cos(v)*rho*h*0.15,Math.sin(v)*Math.sin(u)*rho*s*0.27,jit(R()>0.5?c.color:(c.color2||c.color),R));}
      ell(g,s*0.2,s*0.17,s*0.2,0,h*0.88,0,c.color2||c.color);
      return g;
    }
    for(let i=0;i<5;i++){const a=i/5*6.283+R(),rr=i?s*0.17:0,r=s*(0.27+R()*0.07);ell(g,r,r*0.86,r,Math.cos(a)*rr,h*0.68+(R()-0.5)*h*0.1,Math.sin(a)*rr,R()>0.5?c.color:(c.color2||c.color));}
    ell(g,s*0.26,s*0.22,s*0.26,0,h*0.86,0,c.color2||c.color);
    return g;
  },
  ornamental(c,R){
    if(Q===2)return ornHi(c,R);
    const g=new THREE.Group(),h=c.h,s=c.sp,th=h*0.38,hi=Q===2;
    mesh(g,new THREE.CylinderGeometry(0.1,0.22,th,hi?9:6),hi?M('#4E3B30',{tx:'bark'}):M('#4E3B30'),0,th/2,0);
    if(hi){
      for(let i=0;i<13;i++){const a=R()*6.283,rr=Math.sqrt(R())*s*0.3,r=s*(0.11+R()*0.07),lay=(i%3)*h*0.09;
        ell(g,r,r*0.62,r,Math.cos(a)*rr,h*0.62+lay+(R()-0.5)*0.4,Math.sin(a)*rr,jit(R()>0.5?c.color:c.color2,R));}
      return g;
    }
    for(let i=0;i<4;i++){const a=i/4*6.283+R(),rr=i?s*0.2:0,r=s*(0.28+R()*0.06);ell(g,r,r*0.6,r,Math.cos(a)*rr,h*0.68+(R()-0.5)*0.5,Math.sin(a)*rr,R()>0.5?c.color:c.color2);}
    return g;
  },
  conifer(c,R){
    if(Q===2)return coniferHi(c,R);
    const g=new THREE.Group(),h=c.h,s=c.sp,hi=Q===2,n=hi?9:5;
    mesh(g,new THREE.CylinderGeometry(0.18,0.3,h*0.18,hi?9:6),hi?M('#5A4636',{tx:'bark'}):M('#5A4636'),0,h*0.09,0);
    for(let i=0;i<n;i++){
      const ch=h*(hi?0.24:0.34),rad=s/2*(1-i*(hi?0.095:0.17)),y=h*0.12+i*h*(hi?0.093:0.16)+ch/2;
      const m=mesh(g,new THREE.ConeGeometry(rad,ch,hi?16:9),hi?M(i%2?shade(c.color,1.1):c.color,{tx:'leaf'}):M(i%2?shade(c.color,1.12):c.color),0,y,0);
      if(hi){m.rotation.y=R()*6;m.scale.set(0.93+R()*0.14,1,0.93+R()*0.14);}
    }
    return g;
  },
  column(c,R){
    if(Q===2)return columnHi(c,R);
    const g=new THREE.Group(),h=c.h,s=c.sp;
    mesh(g,new THREE.CylinderGeometry(0.1,0.14,0.8,5),Q===2?M('#5A4636',{tx:'bark'}):M('#5A4636'),0,0.4,0);
    if(Q===2){for(let i=0;i<5;i++){const t=i/4,r=s/2*(0.95-t*0.42);ell(g,r,h*0.13,r,(R()-.5)*0.2,1.5+t*(h-3.4),(R()-.5)*0.2,jit(c.color,R));}return g;}
    ell(g,s/2,h*0.46,s/2,0,h*0.5+0.3,0,c.color,2);
    return g;
  },
  mound(c,R){
    if(Q===2)return moundHi(c,R);
    const g=new THREE.Group(),h=c.h,s=c.sp,hi=Q===2;
    for(let i=0;i<(hi?9:5);i++){const a=i/(hi?9:5)*6.283+R(),rr=i?s*0.17:0;ell(g,s*0.3,h*0.34,s*0.3,Math.cos(a)*rr,h*0.4+(R()-0.5)*h*0.1,Math.sin(a)*rr,R()>0.4?c.color:shade(c.color,1.15));}
    if(c.flower){const fm=M(c.flower,{flatShading:false,roughness:.7});for(let i=0;i<(hi?30:14);i++){const th=R()*1.2,ph=R()*6.283,rx=s*0.42,ry=h*0.52;const m=mesh(g,new THREE.SphereGeometry(Math.max(0.12,s*0.05),6,5),hi&&R()>0.5?M(shade(c.flower,0.85+R()*0.3),{flatShading:false,roughness:.7}):fm,Math.sin(th)*Math.cos(ph)*rx,h*0.42+Math.cos(th)*ry,Math.sin(th)*Math.sin(ph)*rx);m.castShadow=false;}}
    return g;
  },
  clipped(c,R){
    if(Q===2)return clippedHi(c,R);
    const g=new THREE.Group();ell(g,c.sp/2,c.h/2,c.sp/2,0,c.h/2,0,c.color,2);
    if(Q===2)ell(g,c.sp*0.4,c.h*0.3,c.sp*0.4,0,c.h*0.62,0,jit(c.color,R));
    return g;
  },
  grass(c,R){
    if(Q===2)return grassHi(c,R);
    const g=new THREE.Group(),h=c.h,s=c.sp,hi=Q===2;
    for(let i=0;i<(hi?46:18);i++){const a=R()*6.283,t=0.15+R()*0.5,L=h*(0.7+R()*0.3);const geo=new THREE.ConeGeometry(0.07+R()*0.04,L,4);geo.translate(0,L/2,0);const m=mesh(g,geo,M(hi?jit(c.color,R):(R()>0.5?c.color:shade(c.color,0.85))),Math.cos(a)*s*0.08,0,Math.sin(a)*s*0.08);m.rotation.x=Math.sin(a)*t;m.rotation.z=-Math.cos(a)*t;m.castShadow=false;}
    return g;
  },
  fern(c,R){
    if(Q===2)return fernHi(c,R);
    const g=new THREE.Group(),s=c.sp,hi=Q===2;
    for(let i=0;i<(hi?20:11);i++){const a=i/(hi?20:11)*6.283+R()*0.4,t=0.85+R()*0.4,L=s*0.55*(0.8+R()*0.4);const geo=new THREE.ConeGeometry(0.22,L,4);geo.translate(0,L/2,0);const m=mesh(g,geo,M(R()>0.5?c.color:shade(c.color,1.2)),Math.cos(a)*0.15,0.05,Math.sin(a)*0.15);m.scale.z=0.35;m.rotation.order='YXZ';m.rotation.y=-a;m.rotation.x=t;m.castShadow=false;}
    return g;
  },
  rock(c,R){
    const g=new THREE.Group(),s=c.sp,h=c.h;
    if(Q===2){
      const mt=M(c.color,{tx:'stone',flatShading:true});
      const a=mesh(g,rockGeo((R()*4)|0),mt,0,h*0.38,0);a.scale.set(s/2,h*0.55,s*0.4);a.rotation.y=R()*6;
      const b=mesh(g,rockGeo((R()*4)|0),M(shade(c.color,0.9),{tx:'stone',flatShading:true}),s*0.42,s*0.12,s*0.2);b.scale.set(s*0.2,s*0.14,s*0.18);b.rotation.y=R()*6;
      return g;
    }
    const a=mesh(g,new THREE.DodecahedronGeometry(s/2,0),M(c.color),0,h*0.4,0);a.scale.set(1,h/s,0.8+R()*0.3);a.rotation.y=R()*6;
    const b=mesh(g,new THREE.DodecahedronGeometry(s*0.22,0),M(shade(c.color,0.9)),s*0.42,s*0.12,s*0.2);b.rotation.y=R()*6;
    return g;
  },
  pot(c,R){
    const g=new THREE.Group(),s=c.sp,h=c.h;
    if(Q===2){
      const pts=[[0,0],[s*0.3,0],[s*0.36,h*0.04],[s*0.5,h*0.5],[s*0.52,h*0.52],[s*0.52,h*0.56],[s*0.47,h*0.56],[s*0.46,h*0.5],[0,h*0.5]].map(p=>new THREE.Vector2(p[0],p[1]));
      mesh(g,new THREE.LatheGeometry(pts,28),M(c.color,{flatShading:false,side:THREE.DoubleSide,tx:'stone'}),0,0,0);
      ell(g,s*0.42,s*0.3,s*0.42,0,h*0.56+s*0.14,0,'#3F7D3C');ell(g,s*0.26,s*0.2,s*0.26,s*0.08,h*0.56+s*0.32,0,'#4C8B45');
      for(let i=0;i<4;i++)mesh(g,new THREE.SphereGeometry(s*0.07,8,6),M(shade('#D95C8A',0.85+R()*0.3),{flatShading:false}),(R()-.5)*s*0.5,h*0.56+s*(0.34+R()*0.16),(R()-.5)*s*0.5);
      return g;
    }
    mesh(g,new THREE.CylinderGeometry(s/2,s*0.35,h*0.55,12),M(c.color,{flatShading:false}),0,h*0.275,0);
    ell(g,s*0.42,s*0.32,s*0.42,0,h*0.55+s*0.18,0,'#3F7D3C');
    ell(g,s*0.12,s*0.12,s*0.12,s*0.1,h*0.55+s*0.4,0,'#D95C8A');
    return g;
  },
  bench(c,R){
    const g=new THREE.Group(),w=c.w,d=c.d,h=c.h,mt=wd(c);
    if(Q===2){
      for(let i=0;i<5;i++)mesh(g,new THREE.BoxGeometry(w,0.1,d*0.13),mt,0,h*0.5,-d*0.3+i*d*0.17);
      for(let i=0;i<3;i++)mesh(g,new THREE.BoxGeometry(w,0.2,0.07),mt,0,h*0.5+0.4+i*0.3,-d*0.36);
      [-1,1].forEach(k=>{mesh(g,new THREE.BoxGeometry(0.16,h*0.5,d*0.75),M('#3E3A36'),k*w*0.45,h*0.25,0);mesh(g,new THREE.BoxGeometry(0.16,0.07,d*0.75),M('#3E3A36'),k*w*0.45,h*0.5+0.55,0);});
      return g;
    }
    mesh(g,new THREE.BoxGeometry(w,0.2,d*0.75),mt,0,h*0.5,0.1);
    mesh(g,new THREE.BoxGeometry(w,0.9,0.16),mt,0,h*0.5+0.55,-d*0.32);
    [-1,1].forEach(k=>mesh(g,new THREE.BoxGeometry(0.25,h*0.5,d*0.7),M('#4A3A2C'),k*w*0.42,h*0.25,0.1));
    return g;
  },
  firepit(c,R){
    const g=new THREE.Group(),s=c.sp,h=c.h,hi=Q===2;
    if(hi){
      for(let i=0;i<16;i++){const a=i/16*6.283,m=mesh(g,new THREE.BoxGeometry(0.62,h,0.34),M(c.color,{tx:'stone'}),Math.cos(a)*s*0.48,h/2,Math.sin(a)*s*0.48);m.rotation.y=-a+Math.PI/2;}
      mesh(g,new THREE.CylinderGeometry(s*0.36,s*0.36,0.05,16),M('#1E1B19'),0,h*0.8,0);
    }else{
      mesh(g,new THREE.CylinderGeometry(s/2,s/2*0.95,h,14),M(c.color),0,h/2,0);
      mesh(g,new THREE.CylinderGeometry(s*0.34,s*0.34,0.05,14),M('#1E1B19'),0,h+0.02,0);
    }
    const fm=new THREE.MeshStandardMaterial({color:lin('#FF9A3A'),emissive:lin('#FF6A00'),emissiveIntensity:Q===0?0.2:0.9,roughness:1});
    fm.userData.own=true;
    [[0,0,0.65,1.3],[0.3,0.15,0.4,0.9],[-0.25,-0.1,0.35,0.8]].forEach(f=>{const m=mesh(g,new THREE.ConeGeometry(f[2]*0.85,f[3],6),fm,f[0],h+f[3]/2,f[1]);m.castShadow=false;m.userData.ownMat=true;});
    return g;
  },
  light(c,R){
    const g=new THREE.Group();
    mesh(g,new THREE.CylinderGeometry(0.06,0.08,2.1,Q===2?10:6),M(c.color),0,1.05,0);
    const bm=M('#FFE2A8',{emissive:'#FFC866',emissiveIntensity:0.6});
    mesh(g,new THREE.BoxGeometry(0.4,0.4,0.4),bm,0,2.25,0);
    if(Q===2){GLOW.bulb=bm;const pl=new THREE.PointLight(lin('#FFB868'),0,30,2);pl.position.set(0,2.2,0);pl.visible=false;g.add(pl);}
    mesh(g,new THREE.ConeGeometry(0.34,0.25,4),M(c.color),0,2.58,0).rotation.y=Math.PI/4;
    return g;
  },
  raised(c,R){
    const g=new THREE.Group(),w=c.w,d=c.d,h=c.h,mt=wd(c),hi=Q===2;
    if(hi){
      for(let r=0;r<3;r++){const y=h*(r+0.5)/3;[-1,1].forEach(k=>{mesh(g,new THREE.BoxGeometry(w,h/3-0.03,0.16),mt,0,y,k*(d/2-0.08));mesh(g,new THREE.BoxGeometry(0.16,h/3-0.03,d-0.32),mt,k*(w/2-0.08),y,0);});}
      mesh(g,new THREE.BoxGeometry(w-0.32,h*0.86,d-0.32),M('#4A3326',{tx:'stone'}),0,h*0.43,0);
      for(let i=0;i<9;i++)ell(g,0.32,0.26,0.32,(R()-.5)*(w-1),h*0.9+0.1,(R()-.5)*(d-1),jit('#4C8B45',R));
      return g;
    }
    [-1,1].forEach(k=>{mesh(g,new THREE.BoxGeometry(w,h,0.16),mt,0,h/2,k*(d/2-0.08));mesh(g,new THREE.BoxGeometry(0.16,h,d-0.32),mt,k*(w/2-0.08),h/2,0);});
    mesh(g,new THREE.BoxGeometry(w-0.32,h*0.82,d-0.32),M('#4A3326'),0,h*0.41,0);
    return g;
  },
  pergola(c,R){
    const g=new THREE.Group(),w=c.w,d=c.d,h=c.h,mt=wd(c),hi=Q===2,nr=hi?13:8;
    [-1,1].forEach(a=>[-1,1].forEach(b=>mesh(g,new THREE.BoxGeometry(0.5,h,0.5),mt,a*(w/2-0.4),h/2,b*(d/2-0.4))));
    [-1,1].forEach(b=>mesh(g,new THREE.BoxGeometry(w+1.4,0.55,0.4),mt,0,h-0.3,b*(d/2-0.4)));
    for(let i=0;i<nr;i++){const x=-w/2-0.2+(w+0.4)*i/(nr-1);mesh(g,new THREE.BoxGeometry(0.3,0.4,d+1.4),mt,x,h+0.12,0);}
    if(hi){
      for(let i=0;i<5;i++)mesh(g,new THREE.BoxGeometry(w+1,0.14,0.22),mt,0,h+0.38,-d/2+0.4+i*(d-0.8)/4);
      [-1,1].forEach(a=>[-1,1].forEach(b=>mesh(g,new THREE.BoxGeometry(0.75,0.12,0.75),M('#3A332D'),a*(w/2-0.4),0.06,b*(d/2-0.4))));
      for(let i=0;i<11;i++)ell(g,0.6+R()*0.5,0.3,0.6+R()*0.5,(R()-.5)*(w+0.6),h+0.18,(R()-.5)*(d+0.4),jit('#4F8A3C',R));
    }
    return g;
  },
  shed(c,R){
    const g=new THREE.Group(),w=c.w,d=c.d,h=c.h,wh=h*0.72,rh=h-wh,hi=Q===2;
    mesh(g,new THREE.BoxGeometry(w,wh,d),hi?M(c.color,{tx:'board'}):M(c.color),0,wh/2,0);
    const rg=new THREE.ConeGeometry(1,1,4,1);rg.rotateY(Math.PI/4);
    const roof=mesh(g,rg,hi?M('#58504A',{tx:'shingle'}):M('#58504A'),0,wh+rh/2,0);roof.scale.set((w/2+0.6)*Math.SQRT2,rh,(d/2+0.6)*Math.SQRT2);
    if(hi){
      mesh(g,new THREE.BoxGeometry(2.7,wh*0.9,0.1),M('#E9E5DC'),0,wh*0.45,d/2+0.02);
      mesh(g,new THREE.BoxGeometry(2.4,wh*0.82,0.12),M('#4B3A2E',{tx:'wood'}),0,wh*0.41,d/2+0.08);
      mesh(g,new THREE.SphereGeometry(0.09,8,6),M('#B9B2A6',{metalness:.7,roughness:.3,flatShading:false}),0.85,wh*0.4,d/2+0.18);
      mesh(g,new THREE.BoxGeometry(2.1,1.7,0.1),M('#E9E5DC'),-w/2+0.02,wh*0.58,-1.2).rotation.y=Math.PI/2;
      mesh(g,new THREE.BoxGeometry(1.8,1.4,0.12),M('#9DB7C7',{metalness:.4,roughness:.08,flatShading:false}),-w/2-0.04,wh*0.58,-1.2).rotation.y=Math.PI/2;
      [-1,1].forEach(a=>[-1,1].forEach(b=>mesh(g,new THREE.BoxGeometry(0.26,wh,0.26),M('#E9E5DC'),a*(w/2),wh/2,b*(d/2))));
    }else mesh(g,new THREE.BoxGeometry(2.4,wh*0.82,0.12),M('#4B3A2E'),0,wh*0.41,d/2+0.04);
    return g;
  }
};
/* ===== Plotline: object builders (points, areas, lines) and labels ===== */
let _ao=null,_aoGeo=null;
function aoParts(){
  if(_ao)return _ao;
  const c=document.createElement('canvas');c.width=c.height=128;const g=c.getContext('2d'),gr=g.createRadialGradient(64,64,6,64,64,62);
  gr.addColorStop(0,'rgba(0,0,0,.5)');gr.addColorStop(.55,'rgba(0,0,0,.22)');gr.addColorStop(1,'rgba(0,0,0,0)');g.fillStyle=gr;g.fillRect(0,0,128,128);
  const tx=new THREE.CanvasTexture(c);
  _aoGeo=new THREE.PlaneGeometry(1,1).rotateX(-Math.PI/2);_aoGeo.userData.shared=true;
  return(_ao=new THREE.MeshBasicMaterial({map:tx,transparent:true,depthWrite:false,toneMapped:false}));
}
function footR(o){
  const c=CAT[o.cat];let r=c.w?Math.hypot(c.w,c.d)/2:c.sp/2;
  if(c.group==='plants'&&(o.count||1)>1){const n=Math.min(o.count,30);r=c.sp*0.85*0.9*Math.sqrt(n-1)+c.sp/2;}
  return r*(o.scale||1);
}
function buildPoint(o,elev){
  const c=CAT[o.cat],g=new THREE.Group(),inner=new THREE.Group(),R=rng(hash(o.id));
  if(c.group==='plants'&&(o.count||1)>1){
    const n=Math.min(o.count,30),sp=c.sp*0.85;
    for(let i=0;i<n;i++){const u=STYLES[c.style](c,R),r=sp*0.9*Math.sqrt(i),a=i*2.39996;u.position.set(Math.cos(a)*r,0,Math.sin(a)*r);u.rotation.y=R()*6.28;u.scale.setScalar(0.88+R()*0.24);inner.add(u);}
  }else inner.add(STYLES[c.style](c,R));
  inner.scale.setScalar(o.scale||1);g.add(inner);
  if(Q===2&&c.style!=='light'){
    const am=aoParts(),ao=new THREE.Mesh(_aoGeo,am),r=footR(o)*1.2;
    ao.scale.set(r*2,1,r*2);ao.position.y=0.22;ao.renderOrder=2;ao.castShadow=false;ao.receiveShadow=false;g.add(ao);
  }
  g.position.set(o.x,elev||0,o.z);g.rotation.y=-(o.rot||0)*Math.PI/180;
  return tag(g,o.id);
}

/* ---- areas ---- */
let _tuft=null,_tuft2=null;
function tuftGeo(){
  if(Q===2){if(_tuft2)return _tuft2;const g=bladeGeo(rng(77),{n:8,rad:0.1,hmin:0.34,hmax:0.72,lean:0.5,wid:0.07,base:'#ffffff',tip:'#ffffff',mono:true});g.userData.shared=true;return(_tuft2=g);}
  if(_tuft)return _tuft;
  const pos=[],nor=[],R=rng(77);
  for(let i=0;i<5;i++){const a=i/5*6.283+R()*.5,ca=Math.cos(a),sa=Math.sin(a),L=0.35+R()*0.25,lean=0.1+R()*0.12,w=0.05,bx=-sa*w,bz=ca*w,ox=ca*0.05,oz=sa*0.05;
    pos.push(ox+bx,0,oz+bz,ox-bx,0,oz-bz,ox+ca*lean,L,oz+sa*lean);nor.push(0,1,0,0,1,0,0,1,0);}
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));g.setAttribute('normal',new THREE.Float32BufferAttribute(nor,3));g.userData.shared=true;
  return(_tuft=g);
}
let _peb=null;
function blockedAt(x,z,i0){
  for(let j=i0+1;j<S.objects.length;j++){const q=S.objects[j],cq=CAT[q.cat];if(cq.kind==='area'&&inPoly(x,z,q.pts))return true;}
  for(let j=0;j<=i0&&j<S.objects.length;j++){const q=S.objects[j],cq=CAT[q.cat];if(cq.building&&inPoly(x,z,q.pts))return true;}
  return false;
}
function scatterArea(o,c,h){
  const kind=c.tex==='lawn'?'tuft':c.tex==='cover'?'clump':c.tex==='gravel'?'pebble':null;if(!kind)return null;
  const area=polyArea(o.pts),n=Math.min(Math.round(area*(kind==='tuft'?3.4:kind==='clump'?1.1:1.5)),kind==='tuft'?(Q===2?(FX.mode==='full'?12000:6000):9000):3500);if(n<1)return null;
  let geo,mat;
  if(kind==='tuft'){geo=tuftGeo();mat=Q===2?bladeMat():M('#ffffff',{side:THREE.DoubleSide,roughness:1,flatShading:false});}
  else if(kind==='clump'){geo=blobGeo(2);mat=M('#ffffff',{tx:'leaf'});}
  else{geo=_peb||(_peb=new THREE.DodecahedronGeometry(1,0));geo.userData.shared=true;mat=M('#ffffff',{flatShading:true,tx:'stone'});}
  const im=new THREE.InstancedMesh(geo,mat,n),R=rng(hash(o.id+'s')),i0=S.objects.indexOf(o);
  let x0=1e9,x1=-1e9,z0=1e9,z1=-1e9;o.pts.forEach(p=>{x0=Math.min(x0,p[0]);x1=Math.max(x1,p[0]);z0=Math.min(z0,p[1]);z1=Math.max(z1,p[1]);});
  const m4=new THREE.Matrix4(),q=new THREE.Quaternion(),up=new THREE.Vector3(0,1,0),sc=new THREE.Vector3(),pos=new THREE.Vector3(),col=new THREE.Color();
  let cnt=0;
  for(let t=0;t<n*6&&cnt<n;t++){
    const x=x0+R()*(x1-x0),z=z0+R()*(z1-z0);
    if(!inPoly(x,z,o.pts)||blockedAt(x,z,i0))continue;
    q.setFromAxisAngle(up,R()*6.283);
    if(kind==='tuft'){const s=0.7+R()*0.7;sc.set(s,s*(0.8+R()*0.6),s);pos.set(x,h,z);col.set(c.color).convertSRGBToLinear().multiplyScalar(0.65+R()*0.6);}
    else if(kind==='clump'){const s=0.35+R()*0.3;sc.set(s,s*0.55,s);pos.set(x,h+s*0.2,z);col.set(c.color).convertSRGBToLinear().multiplyScalar(0.7+R()*0.6);}
    else{const s=0.1+R()*0.14;sc.set(s,s*0.6,s);pos.set(x,h,z);col.set(c.color).convertSRGBToLinear().multiplyScalar(0.6+R()*0.6);}
    m4.compose(pos,q,sc);im.setMatrixAt(cnt,m4);im.setColorAt(cnt,col);cnt++;
  }
  im.count=cnt;im.instanceMatrix.needsUpdate=true;if(im.instanceColor)im.instanceColor.needsUpdate=true;
  im.castShadow=false;im.receiveShadow=true;im.frustumCulled=false;im.raycast=function(){};
  return im;
}
function isRect(p){
  if(p.length!==4)return false;
  for(let i=0;i<4;i++){const a=p[i],b=p[(i+1)%4];if(Math.abs(a[0]-b[0])>0.01&&Math.abs(a[1]-b[1])>0.01)return false;}
  return true;
}
function buildHouse(o,c,h){
  const g=new THREE.Group(),rect=isRect(o.pts),wh=rect?h*0.64:h,sh=new THREE.Shape();
  o.pts.forEach((p,i)=>{if(i)sh.lineTo(p[0],-p[1]);else sh.moveTo(p[0],-p[1]);});
  const wg=new THREE.ExtrudeGeometry(sh,{depth:wh,bevelEnabled:false,curveSegments:1});wg.rotateX(-Math.PI/2);
  const walls=new THREE.Mesh(wg,[M('#6E6A65'),M(c.color,{tx:'siding'})]);walls.castShadow=true;walls.receiveShadow=true;g.add(walls);
  const xs=o.pts.map(p=>p[0]),zs=o.pts.map(p=>p[1]),x0=Math.min(...xs),x1=Math.max(...xs),z0=Math.min(...zs),z1=Math.max(...zs),dx=x1-x0,dz=z1-z0;
  if(rect){
    const ov=1.2,rh=h-wh,W=Math.min(dx,dz)+ov*2,L=Math.max(dx,dz)+ov*2,tri=new THREE.Shape();
    tri.moveTo(-W/2,0);tri.lineTo(W/2,0);tri.lineTo(0,rh);tri.closePath();
    const rg=new THREE.ExtrudeGeometry(tri,{depth:L,bevelEnabled:false});rg.translate(0,0,-L/2);if(dx>=dz)rg.rotateY(Math.PI/2);
    const roof=new THREE.Mesh(rg,[M(c.color,{tx:'siding'}),M('#5E5750',{tx:'shingle'})]);roof.position.set((x0+x1)/2,wh,(z0+z1)/2);roof.castShadow=true;roof.receiveShadow=true;g.add(roof);
    const ch=mesh(g,new THREE.BoxGeometry(2.2,rh+2.4,2.2),M('#8A5A48',{tx:'block'}),(x0+x1)/2+(dx>=dz?dx*0.25:0),wh+(rh+2.4)/2-0.2,(z0+z1)/2+(dx>=dz?0:dz*0.25));ch.castShadow=true;
  }
  const A=polyArea(o.pts),glass=M('#9DB7C7',{metalness:.4,roughness:.08,flatShading:false,emissive:'#FFB45C',emissiveIntensity:0}),trim=M('#EEEAE2');GLOW.win=glass;
  let best=-1,bl=0;
  for(let i=0;i<o.pts.length;i++){const a=o.pts[i],b=o.pts[(i+1)%o.pts.length],L=Math.hypot(b[0]-a[0],b[1]-a[1]);if(L>bl){bl=L;best=i;}}
  for(let i=0;i<o.pts.length;i++){
    const a=o.pts[i],b=o.pts[(i+1)%o.pts.length],L=Math.hypot(b[0]-a[0],b[1]-a[1]);if(L<8)continue;
    const ux=(b[0]-a[0])/L,uz=(b[1]-a[1])/L;let nx=uz,nz=-ux;const mx=(a[0]+b[0])/2,mz=(a[1]+b[1])/2;
    if(inPoly(mx+nx*0.5,mz+nz*0.5,o.pts)){nx=-nx;nz=-nz;}
    const rot=-Math.atan2(uz,ux),nw=Math.max(1,Math.floor((L-3)/7)),wy=wh*0.55;
    for(let k=0;k<nw;k++){
      const t=(k+0.5)/nw,px=a[0]+ux*L*t,pz=a[1]+uz*L*t;
      if(i===best&&k===Math.floor(nw/2)){
        const d=mesh(g,new THREE.BoxGeometry(3.2,min7(wh),0.3),M('#3E5C58'),px+nx*0.12,min7(wh)/2,pz+nz*0.12);d.rotation.y=rot;continue;
      }
      const f=mesh(g,new THREE.BoxGeometry(3.4,4.4,0.22),trim,px+nx*0.1,wy,pz+nz*0.1);f.rotation.y=rot;
      const gl=mesh(g,new THREE.BoxGeometry(2.8,3.8,0.28),glass,px+nx*0.14,wy,pz+nz*0.14);gl.rotation.y=rot;gl.castShadow=false;
    }
  }
  void A;
  g.traverse(n=>{if(n.isMesh&&n.geometry&&n.geometry.type==='BoxGeometry'&&n!==walls)n.castShadow=false;});
  return tag(g,o.id);
}
function min7(wh){return Math.min(7,wh*0.85);}
function buildArea(o){
  const c=CAT[o.cat],h=Math.max(o.height!=null?o.height:c.h,0.02);
  if(c.building&&Q===2)return buildHouse(o,c,h);
  const sh=new THREE.Shape();
  o.pts.forEach((p,i)=>{if(i)sh.lineTo(p[0],-p[1]);else sh.moveTo(p[0],-p[1]);});
  const geo=new THREE.ExtrudeGeometry(sh,{depth:h,bevelEnabled:false,curveSegments:1});geo.rotateX(-Math.PI/2);
  let mats;
  if(c.building)mats=[M('#6E6A65'),M(c.color)];
  else if(c.water)mats=[Q===2?waterMat():M('#3E7FA8',{flatShading:false,roughness:0.15,metalness:0.1,transparent:true,opacity:0.85}),M('#2D6485',{flatShading:false})];
  else mats=[(c.tex&&Q>0)?texMat(c):M(c.color,{flatShading:false}),M(shade(c.color,0.78),{flatShading:false})];
  const m=new THREE.Mesh(geo,mats);m.castShadow=h>0.4;m.receiveShadow=true;
  if(Q===0)addEdges(m,geo,30);
  let out=m;
  if(Q===2){const sc=scatterArea(o,c,h);if(sc){out=new THREE.Group();out.add(m);out.add(sc);}}
  return tag(out,o.id);
}

/* ---- lines (fences, walls, edging, hedges) ---- */
function buildLine(o){
  const c=CAT[o.cat],h=o.height!=null?o.height:c.h,t=c.t,g=new THREE.Group(),hi=Q===2,R=rng(hash(o.id));
  let mt=M(c.color);
  if(hi){
    if(c.id==='fence6')mt=M(c.color,{tx:'board'});
    else if(c.id==='fence4')mt=M(c.color,{tx:'picket',alphaTest:0.5,side:THREE.DoubleSide});
    else if(c.id==='wall')mt=M(c.color,{tx:'block'});
    else if(c.id==='edging')mt=M(c.color,{metalness:0.55,roughness:0.45});
  }
  const post=hi?M(c.id==='wall'?shade(c.color,1.1):'#7C5C3E',c.id==='wall'?{tx:'stone'}:{tx:'wood'}):mt;
  for(let i=1;i<o.pts.length;i++){
    const a=o.pts[i-1],b=o.pts[i],dx=b[0]-a[0],dz=b[1]-a[1],L=Math.hypot(dx,dz);if(L<0.01)continue;
    const rot=-Math.atan2(dz,dx);
    if(hi&&c.id==='hedge'){
      hedgeHi(g,a,b,t,h,R,c.color);
      continue;
    }
    const geo=hi?boxFt(L,h,t):new THREE.BoxGeometry(L,h,t);
    const m=mesh(g,geo,mt,(a[0]+b[0])/2,h/2,(a[1]+b[1])/2);m.rotation.y=rot;
    if(hi&&(c.id==='fence6'||c.id==='wall')){
      const cap=mesh(g,new THREE.BoxGeometry(L,c.id==='wall'?0.14:0.16,t+0.16),post,(a[0]+b[0])/2,h+0.07,(a[1]+b[1])/2);cap.rotation.y=rot;
    }
    if(hi&&c.id==='fence4'){
      [0.28,0.7].forEach(f=>{const r=mesh(g,new THREE.BoxGeometry(L,0.16,0.1),post,(a[0]+b[0])/2+Math.sin(-rot)*0.08,h*f,(a[1]+b[1])/2+Math.cos(-rot)*0.08);r.rotation.y=rot;});
    }
    if(hi&&(c.id==='fence6'||c.id==='fence4')){
      const n=Math.ceil(L/7);
      for(let k=1;k<n;k++){const u=k/n;mesh(g,new THREE.BoxGeometry(t+0.15,h+0.2,t+0.15),post,a[0]+dx*u,(h+0.2)/2,a[1]+dz*u);}
    }
  }
  o.pts.forEach(p=>{
    if(hi&&c.id==='hedge')return;
    if(hi&&(c.id==='fence6'||c.id==='fence4')){mesh(g,new THREE.BoxGeometry(t+0.2,h+0.3,t+0.2),post,p[0],(h+0.3)/2,p[1]);mesh(g,new THREE.BoxGeometry(t+0.38,0.12,t+0.38),post,p[0],h+0.34,p[1]);}
    else mesh(g,hi?boxFt(t,h,t):new THREE.BoxGeometry(t,h,t),mt,p[0],h/2,p[1]);
  });
  g.traverse(n=>{if(n.isMesh&&n.castShadow)n.castShadow=h>0.5;});
  return tag(g,o.id);
}

/* ---- text labels drawn on the plan ---- */
function labelSprite(text){
  const fs=34,H=56,c=document.createElement('canvas'),g=c.getContext('2d');
  g.font='600 '+fs+'px "Instrument Sans",system-ui,sans-serif';
  const w=Math.ceil(g.measureText(text).width)+30;c.width=w;c.height=H;
  g.font='600 '+fs+'px "Instrument Sans",system-ui,sans-serif';
  g.fillStyle='rgba(255,255,255,0.9)';g.beginPath();
  if(g.roundRect)g.roundRect(1,1,w-2,H-2,12);else g.rect(1,1,w-2,H-2);
  g.fill();g.strokeStyle='rgba(27,42,32,0.45)';g.lineWidth=2;g.stroke();
  g.fillStyle='#1B2A20';g.textBaseline='middle';g.fillText(text,15,H/2+2);
  const tx=new THREE.CanvasTexture(c);tx.minFilter=THREE.LinearFilter;tx.generateMipmaps=false;if(Q===2)tx.encoding=THREE.sRGBEncoding;
  const sp=new THREE.Sprite(new THREE.SpriteMaterial({map:tx,depthTest:false,depthWrite:false,transparent:true,toneMapped:false}));
  const LH=1.4;sp.scale.set(w/H*LH,LH,1);sp.renderOrder=900;sp.userData.ownMat=true;
  return sp;
}
/* ===== Plotline: realistic foliage (leaf-card canopies, grass blades, wind sway) ===== */
const WIND={t:{value:0},amp:{value:1}};
function windPatch(m){
  if(m.userData.wind)return m;m.userData.wind=true;
  const prev=m.onBeforeCompile;
  m.onBeforeCompile=function(sh,r){
    if(prev)prev.call(this,sh,r);
    sh.uniforms.uWT=WIND.t;sh.uniforms.uWA=WIND.amp;
    sh.vertexShader=sh.vertexShader.replace('#include <common>','#include <common>\nuniform float uWT;uniform float uWA;attribute float aW;')
      .replace('#include <begin_vertex>','#include <begin_vertex>\n{\n#ifdef USE_INSTANCING\nvec3 wo=vec3(instanceMatrix[3][0],instanceMatrix[3][1],instanceMatrix[3][2]);\n#else\nvec3 wo=vec3(modelMatrix[3][0],modelMatrix[3][1],modelMatrix[3][2]);\n#endif\n'
        +'float ph=dot(wo.xz,vec2(0.37,0.29))+position.x*0.5+position.z*0.45;float g=sin(uWT*1.6+ph)*0.6+sin(uWT*2.7+ph*1.7)*0.4;float g2=cos(uWT*1.3+ph*0.8);\n'
        +'transformed.x+=g*aW*0.22*uWA;transformed.z+=g2*aW*0.15*uWA;transformed.y-=abs(g)*aW*0.04*uWA;\n}');
  };
  return m;
}
const _envList=[];

/* ---- alpha-cut card textures: 2 x 2 variants per sheet, grayscale so vertex colors tint them ---- */
const _ct={};
function cardTex(kind){
  if(_ct[kind])return _ct[kind];
  const N=512,c=document.createElement('canvas');c.width=c.height=N;const g=c.getContext('2d'),R=rng(hash('card'+kind));
  const gr=v=>{v=Math.max(0,Math.min(255,v|0));return 'rgb('+v+','+v+','+v+')';};
  const leaf=(len,wid,sh)=>{
    g.beginPath();g.moveTo(0,0);g.bezierCurveTo(len*.22,-wid,len*.68,-wid*.85,len,0);g.bezierCurveTo(len*.68,wid*.85,len*.22,wid,0,0);g.closePath();
    g.fillStyle=gr(sh);g.fill();g.strokeStyle=gr(sh-60);g.lineWidth=1.1;g.stroke();
    g.strokeStyle=gr(sh-38);g.lineWidth=1;g.beginPath();g.moveTo(0,0);g.lineTo(len*.94,0);g.stroke();
    for(let k=1;k<4;k++){const x=len*k*.22;g.beginPath();g.moveTo(x,0);g.lineTo(x+len*.14,-wid*.55);g.moveTo(x,0);g.lineTo(x+len*.14,wid*.55);g.stroke();}
  };
  for(let cell=0;cell<4;cell++){
    const ox=(cell%2)*256,oy=(cell>>1)*256;
    g.save();g.beginPath();g.rect(ox,oy,256,256);g.clip();g.translate(ox+128,oy+246);
    const bend=(R()-.5)*26;
    if(kind==='leaf'){
      g.strokeStyle=gr(78);g.lineWidth=3.2;g.beginPath();g.moveTo(0,0);g.quadraticCurveTo(bend,-120,bend*1.6,-228);g.stroke();
      const nL=15;
      for(let i=0;i<nL;i++){
        const t=(i+1)/(nL+1),px=bend*1.6*t*t+bend*0.2*t,py=-228*t,side=i%2?1:-1,ang=-1.57+side*(0.7+R()*0.55),len=(40+R()*26)*(1-t*0.35),wid=(15+R()*9)*(1-t*0.25);
        g.save();g.translate(px,py);g.rotate(ang);leaf(len,wid,205+R()*50-(1-t)*22);g.restore();
      }
      g.save();g.translate(bend*1.6,-228);g.rotate(-1.57+(R()-.5)*.5);leaf(46,17,250);g.restore();
    }else if(kind==='spray'){
      const stem=(x0,y0,x1,y1,w)=>{g.strokeStyle=gr(86);g.lineWidth=w;g.beginPath();g.moveTo(x0,y0);g.lineTo(x1,y1);g.stroke();};
      stem(0,0,bend*.5,-236,3.4);
      const needles=(x0,y0,dx,dy,len,n)=>{
        for(let i=0;i<n;i++){const t=i/n,x=x0+dx*t,y=y0+dy*t,L=len*(1-t*0.55)*(0.8+R()*0.4);
          for(let s=-1;s<=1;s+=2){g.strokeStyle=gr(200+R()*55);g.lineWidth=2.1;g.beginPath();g.moveTo(x,y);g.lineTo(x+s*L*0.86,y-L*0.52+L*0.15);g.stroke();}}
      };
      needles(0,0,bend*.5,-236,40,44);
      for(let i=0;i<7;i++){
        const t=0.12+i*0.115,x=bend*.5*t,y=-236*t,side=i%2?1:-1,bl=84*(1-t*0.8)+14;
        const ex=x+side*bl*0.9,ey=y-bl*0.45;stem(x,y,ex,ey,2.2);needles(x,y,ex-x,ey-y,26*(1-t*0.5),18);
      }
    }else if(kind==='frond'){
      g.strokeStyle=gr(96);g.lineWidth=3;g.beginPath();g.moveTo(0,0);g.quadraticCurveTo(bend,-120,bend*1.4,-236);g.stroke();
      for(let i=0;i<17;i++){
        const t=(i+1)/19,px=bend*1.4*t*t+bend*0.3*t,py=-236*t,len=(58*(1-t*0.82)+10);
        for(let s=-1;s<=1;s+=2){g.save();g.translate(px,py);g.rotate(s>0?-0.35:Math.PI+0.35);g.scale(1,1);leaf(len,len*0.2,205+R()*50);g.restore();}
      }
    }else{ /* bloom: clusters of five-petal flowers */
      for(let i=0;i<9;i++){
        const x=(R()-.5)*190,y=-30-R()*190,r=15+R()*14;
        g.save();g.translate(x,y);g.rotate(R()*6.28);
        for(let p=0;p<5;p++){g.rotate(1.2566);g.fillStyle=gr(222+R()*33);g.strokeStyle=gr(170);g.lineWidth=1;g.beginPath();g.ellipse(r*.62,0,r*.62,r*.42,0,0,6.2832);g.fill();g.stroke();}
        g.fillStyle=gr(95);g.beginPath();g.arc(0,0,r*.2,0,6.2832);g.fill();g.restore();
      }
      for(let i=0;i<10;i++){g.fillStyle=gr(110+R()*60);g.save();g.translate((R()-.5)*200,-20-R()*210);g.rotate(R()*6.28);g.beginPath();g.ellipse(0,0,18,7,0,0,6.2832);g.fill();g.restore();}
    }
    g.restore();
  }
  const t=new THREE.CanvasTexture(c);t.encoding=THREE.sRGBEncoding;t.anisotropy=8;t.wrapS=t.wrapT=THREE.ClampToEdgeWrapping;
  return(_ct[kind]=t);
}
const _lm={};
function leafMat(kind){
  const k=Q+kind;if(_lm[k])return _lm[k];
  const m=new THREE.MeshStandardMaterial({map:cardTex(kind),alphaTest:0.42,side:THREE.DoubleSide,vertexColors:true,roughness:0.8,metalness:0,color:0xffffff});
  m.envMapIntensity=envI;_envList.push(m);
  windPatch(m);
  const w=m.onBeforeCompile;
  m.onBeforeCompile=function(sh,r){
    w.call(this,sh,r);
    /* keep the bent, outward-facing normals on both faces so the canopy shades like a solid mass */
    sh.fragmentShader=sh.fragmentShader.replace('#include <normal_fragment_begin>',THREE.ShaderChunk.normal_fragment_begin.replace('normal = normal * faceDirection;',''));
  };
  m.customProgramCacheKey=()=>'leafcard';
  return(_lm[k]=m);
}
const _bm={};
function bladeMat(){
  if(_bm[Q])return _bm[Q];
  const m=new THREE.MeshStandardMaterial({vertexColors:true,side:THREE.DoubleSide,roughness:0.88,metalness:0,color:0xffffff});
  m.envMapIntensity=envI;_envList.push(m);windPatch(m);m.customProgramCacheKey=()=>'blade';
  return(_bm[Q]=m);
}

/* ---- card accumulator: every card of one plant goes into one geometry (one draw call) ---- */
function cardSet(){
  const pos=[],nor=[],uv=[],col=[],aw=[],idx=[];let n=0;
  return{
    count(){return n;},
    add(p,t,b,w,h,nrm,cell,c,wd){
      const hx=w/2,i=n*4,cx=cell&1,cy=cell>>1,u0=cx*0.5,v0=(1-cy)*0.5;
      const cs=[[-hx,0],[hx,0],[hx,h],[-hx,h]],us=[[u0,v0],[u0+.5,v0],[u0+.5,v0+.5],[u0,v0+.5]];
      for(let k=0;k<4;k++){
        const a=cs[k][0],bb=cs[k][1];
        pos.push(p[0]+t[0]*a+b[0]*bb,p[1]+t[1]*a+b[1]*bb,p[2]+t[2]*a+b[2]*bb);
        nor.push(nrm[0],nrm[1],nrm[2]);uv.push(us[k][0],us[k][1]);col.push(c[0],c[1],c[2]);aw.push(k>1?wd:wd*0.3);
      }
      idx.push(i,i+1,i+2,i,i+2,i+3);n++;
    },
    build(){
      const g=new THREE.BufferGeometry();
      g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));g.setAttribute('normal',new THREE.Float32BufferAttribute(nor,3));
      g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setAttribute('color',new THREE.Float32BufferAttribute(col,3));
      g.setAttribute('aW',new THREE.Float32BufferAttribute(aw,1));g.setIndex(idx);g.computeBoundingSphere();return g;
    }
  };
}
const V3={
  norm(a){const l=Math.hypot(a[0],a[1],a[2])||1;return[a[0]/l,a[1]/l,a[2]/l];},
  cross(a,b){return[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];},
  dot(a,b){return a[0]*b[0]+a[1]*b[1]+a[2]*b[2];}
};
/* scatter leaf cards through an ellipsoid; normals bend outward so the mass reads as one soft volume */
function canopyCards(set,P,R){
  const c1=new THREE.Color(P.base).convertSRGBToLinear(),c2=new THREE.Color(P.alt||P.base).convertSRGBToLinear(),tmp=new THREE.Color();
  const core=P.core!=null?P.core:0.55,bend=P.bend!=null?P.bend:0.8,cells=P.cells||[0,1,2,3];
  for(let i=0;i<P.n;i++){
    const u=R()*6.2832,v=Math.acos(2*R()-1),rho=1-core*Math.pow(R(),1.7);
    const dx=Math.sin(v)*Math.cos(u),dy=Math.cos(v),dz=Math.sin(v)*Math.sin(u);
    const p=[P.cx+dx*P.rx*rho,P.cy+dy*P.ry*rho,P.cz+dz*P.rz*rho];
    const on=V3.norm([dx/P.rx,dy/P.ry,dz/P.rz]);
    const b=V3.norm([on[0]*0.65+(R()-.5)*1.1,on[1]*0.65+0.3+(R()-.5)*1.1,on[2]*0.65+(R()-.5)*1.1]);
    const t=V3.norm(V3.cross(b,[R()-.5,R()-.5,R()-.5]));
    let cn=V3.cross(t,b);if(V3.dot(cn,on)<0)cn=[-cn[0],-cn[1],-cn[2]];
    const nrm=V3.norm([cn[0]*(1-bend)+on[0]*bend,cn[1]*(1-bend)+on[1]*bend,cn[2]*(1-bend)+on[2]*bend]);
    const h01=dy*0.5+0.5,lit=1.5*(0.58+0.42*rho*rho)*(0.84+0.3*h01)*(0.82+R()*0.36);
    tmp.copy(c1).lerp(c2,R()).multiplyScalar(lit);
    const s=P.size*(0.72+R()*0.56);
    set.add([p[0]-b[0]*s*0.3,p[1]-b[1]*s*0.3,p[2]-b[2]*s*0.3],t,b,s,s*1.1,nrm,cells[(R()*cells.length)|0],[tmp.r,tmp.g,tmp.b],0.45+0.55*rho);
  }
}
function cardsN(rx,ry,rz,size,mult,mx){
  const surf=4*Math.PI*((rx*ry+ry*rz+rx*rz)/3)*0.9;
  return Math.max(30,Math.min(mx||520,Math.round(surf*(mult||1.1)/(size*size*0.55))));
}
function cardMesh(g,set,kind,shadow){
  const m=new THREE.Mesh(set.build(),leafMat(kind));m.castShadow=shadow!==false;m.receiveShadow=true;m.userData.shared=false;g.add(m);return m;
}
/* a tapered limb between two points */
function limb(g,p0,p1,r0,r1,mat){
  const dx=p1[0]-p0[0],dy=p1[1]-p0[1],dz=p1[2]-p0[2],L=Math.hypot(dx,dy,dz);
  const geo=new THREE.CylinderGeometry(r1,r0,L,7,1);geo.translate(0,L/2,0);
  const m=new THREE.Mesh(geo,mat);m.position.set(p0[0],p0[1],p0[2]);
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),new THREE.Vector3(dx/L,dy/L,dz/L));
  m.castShadow=true;m.receiveShadow=true;g.add(m);return m;
}

/* ---- grass blades: curved, tapered, with wind weight rising to the tip ---- */
function bladeGeo(R,P){
  const pos=[],nor=[],col=[],aw=[],idx=[];let n=0;
  const cb=new THREE.Color(P.base).convertSRGBToLinear(),ct=new THREE.Color(P.tip||P.base).convertSRGBToLinear(),tmp=new THREE.Color();
  for(let i=0;i<P.n;i++){
    const a=R()*6.2832,r=Math.sqrt(R())*P.rad,rx=Math.cos(a)*r,rz=Math.sin(a)*r;
    const L=P.hmin+R()*(P.hmax-P.hmin),ang=a+(R()-.5)*1.4,lean=P.lean*(0.35+R()*0.9),w=P.wid*(0.7+R()*0.6);
    const cx=Math.cos(ang),cz=Math.sin(ang),px=-cz,pz=cx,jit=0.85+R()*0.3,fade=P.straw?R():0;
    const rows=[[0,w],[0.5,w*0.8],[1,0]];
    const base=n;
    rows.forEach((rw,j)=>{
      const t=rw[0],y=L*t,off=lean*L*t*t,ww=rw[1];
      const X=rx+cx*off,Z=rz+cz*off;
      tmp.copy(cb).lerp(ct,t).multiplyScalar(jit);
      if(P.mono){const m=0.5+0.5*t;tmp.setRGB(m*jit,m*jit,m*jit);}
      else if(fade>0.82&&t>0.4)tmp.lerp(new THREE.Color('#C8B070').convertSRGBToLinear(),0.55);
      const nx=-cx*lean*t*0.7,nz=-cz*lean*t*0.7,nl=Math.hypot(nx,1,nz);
      if(j<2){
        [-1,1].forEach(s=>{pos.push(X+px*ww*0.5*s,y,Z+pz*ww*0.5*s);nor.push(nx/nl,1/nl,nz/nl);col.push(tmp.r,tmp.g,tmp.b);aw.push(t*t);});
      }else{pos.push(X,y,Z);nor.push(nx/nl,1/nl,nz/nl);col.push(tmp.r,tmp.g,tmp.b);aw.push(t*t);}
    });
    idx.push(base,base+1,base+2,base+1,base+3,base+2,base+2,base+3,base+4);n+=5;
  }
  const g=new THREE.BufferGeometry();
  g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));g.setAttribute('normal',new THREE.Float32BufferAttribute(nor,3));
  g.setAttribute('color',new THREE.Float32BufferAttribute(col,3));g.setAttribute('aW',new THREE.Float32BufferAttribute(aw,1));g.setIndex(idx);g.computeBoundingSphere();
  return g;
}
/* ===== Plotline: realistic plant builders (leaf cards, sprays, blades) ===== */
function treeHi(c,R){
  const g=new THREE.Group(),h=c.h,s=c.sp,tr=c.trunk||'#6B5140',th=h*0.5,bark=M(tr,{tx:'bark'}),r0=s*0.05+0.2,r1=s*0.028+0.08;
  mesh(g,new THREE.CylinderGeometry(r1,r0,th,12,3),bark,0,th/2,0);
  mesh(g,new THREE.ConeGeometry(r0*1.9,1.1,10),bark,0,0.5,0);
  const set=cardSet(),n=3+((R()*2)|0),size=Math.max(0.9,Math.min(2.8,h*0.07)),cy0=h*0.7,alt=c.color2||c.color;
  for(let k=0;k<=n;k++){
    const a=k/n*6.2832+R()*0.6,rr=k===n?0:s*0.24*(0.7+R()*0.5),cx=Math.cos(a)*rr,cz=Math.sin(a)*rr,cy=cy0+(k===n?h*0.1:(R()-.4)*h*0.1);
    const rx=s*(0.26+R()*0.05),ry=h*(0.16+R()*0.03),rz=rx*(0.9+R()*0.2);
    canopyCards(set,{cx,cy,cz,rx,ry,rz,n:cardsN(rx,ry,rz,size),size,base:c.color,alt},R);
    limb(g,[0,th*0.82,0],[cx*0.8,cy-ry*0.4,cz*0.8],r1*0.9,0.07,bark);
  }
  cardMesh(g,set,'leaf');
  return g;
}
function ornHi(c,R){
  const g=new THREE.Group(),h=c.h,s=c.sp,th=h*0.38,bark=M('#4E3B30',{tx:'bark'});
  mesh(g,new THREE.CylinderGeometry(0.07,0.2,th,9,2),bark,0,th/2,0);
  const set=cardSet(),fs=c.flower?cardSet():null,size=Math.max(0.5,Math.min(1.6,h*0.08)),n=2+((R()*2)|0);
  for(let k=0;k<=n;k++){
    const a=k/n*6.2832+R(),rr=k===n?0:s*0.2*(0.7+R()*0.5),cx=Math.cos(a)*rr,cz=Math.sin(a)*rr,cy=h*0.64+(R()-.4)*h*0.08;
    const rx=s*(0.24+R()*0.05),ry=h*(0.15+R()*0.03),rz=rx*(0.9+R()*0.2);
    canopyCards(set,{cx,cy,cz,rx,ry,rz,n:cardsN(rx,ry,rz,size),size,base:c.color,alt:c.color2||shade(c.color,1.2)},R);
    if(fs)canopyCards(fs,{cx,cy,cz,rx:rx*1.03,ry:ry*1.03,rz:rz*1.03,n:Math.round(cardsN(rx,ry,rz,size*0.8,0.8)*0.6),size:size*0.8,base:c.flower,alt:shade(c.flower,0.82),core:0.1,bend:0.9},R);
    limb(g,[0,th*0.85,0],[cx*0.8,cy-ry*0.4,cz*0.8],0.14,0.05,bark);
  }
  cardMesh(g,set,'leaf');if(fs)cardMesh(g,fs,'bloom',false);
  return g;
}
function moundHi(c,R){
  const g=new THREE.Group(),h=c.h,s=c.sp,set=cardSet(),size=Math.max(0.4,Math.min(1.2,h*0.28));
  ell(g,s*0.3,h*0.3,s*0.3,0,h*0.38,0,shade(c.color,0.55));
  const rx=s*0.46,ry=h*0.5,rz=s*0.46;
  canopyCards(set,{cx:0,cy:h*0.46,cz:0,rx,ry,rz,n:cardsN(rx,ry,rz,size,1.5),size,base:c.color,alt:shade(c.color,1.25),core:0.4},R);
  cardMesh(g,set,'leaf');
  if(c.flower){
    const fs=cardSet();
    canopyCards(fs,{cx:0,cy:h*0.5,cz:0,rx:rx*1.02,ry:ry,rz:rz*1.02,n:Math.round(cardsN(rx,ry,rz,size*0.8,0.9)*0.7),size:size*0.8,base:c.flower,alt:shade(c.flower,0.82),core:0.08,bend:0.9},R);
    cardMesh(g,fs,'bloom',false);
  }
  return g;
}
function clippedHi(c,R){
  const g=new THREE.Group(),sz=Math.max(0.3,Math.min(0.7,c.sp*0.1)),rx=c.sp/2,ry=c.h/2,set=cardSet();
  ell(g,rx*0.93,ry*0.93,rx*0.93,0,ry,0,shade(c.color,0.6),2);
  canopyCards(set,{cx:0,cy:ry,cz:0,rx,ry,rz:rx,n:cardsN(rx,ry,rx,sz,1.7,900),size:sz,base:c.color,alt:shade(c.color,1.2),core:0.05,bend:0.9},R);
  cardMesh(g,set,'leaf');return g;
}
function columnHi(c,R){
  const g=new THREE.Group(),h=c.h,s=c.sp,set=cardSet(),sz=Math.max(0.6,Math.min(1.6,h*0.05));
  mesh(g,new THREE.CylinderGeometry(0.08,0.12,1.2,6),M('#5A4636',{tx:'bark'}),0,0.6,0);
  ell(g,s*0.36,h*0.4,s*0.36,0,h*0.5,0,shade(c.color,0.45),2);
  const rx=s*0.5,ry=h*0.47;
  canopyCards(set,{cx:0,cy:h*0.52,cz:0,rx,ry,rz:rx,n:cardsN(rx,ry,rx,sz,1.5),size:sz,base:c.color,alt:shade(c.color,1.18),core:0.3,bend:0.7},R);
  cardMesh(g,set,'spray');return g;
}
function coniferHi(c,R){
  const g=new THREE.Group(),h=c.h,s=c.sp,bark=M('#5A4636',{tx:'bark'}),set=cardSet();
  mesh(g,new THREE.CylinderGeometry(0.16,0.3,h*0.22,9),bark,0,h*0.11,0);
  mesh(g,new THREE.ConeGeometry(s*0.27,h*0.86,12),M(shade(c.color,0.6),{tx:'leaf'}),0,h*0.12+h*0.43,0);
  const T=Math.round(7+h/4.5),c1=new THREE.Color(c.color).convertSRGBToLinear(),c2=new THREE.Color(shade(c.color,1.22)).convertSRGBToLinear(),tmp=new THREE.Color();
  for(let t=0;t<T;t++){
    const f=t/(T-1),y=h*0.1+f*h*0.88,rad=Math.max(0.6,s/2*(1-f*0.93)),cnt=Math.max(6,Math.round(8+17*(1-f))),drop=0.42-0.24*f;
    for(let k=0;k<cnt;k++){
      const a=k/cnt*6.2832+t*0.9+R()*0.35,ca=Math.cos(a),sa=Math.sin(a),cd=Math.cos(drop);
      const b=V3.norm([ca*cd,-Math.sin(drop),sa*cd]),tt=[-sa,0,ca],nrm=V3.norm([ca*0.45,0.9,sa*0.45]);
      tmp.copy(c1).lerp(c2,R()).multiplyScalar(1.5+R()*0.7);
      set.add([ca*0.1,y,sa*0.1],tt,b,rad*(0.56+R()*0.16),rad*(1.0+R()*0.2)+0.3,nrm,(R()*4)|0,[tmp.r,tmp.g,tmp.b],0.45+0.4*(1-f));
    }
  }
  cardMesh(g,set,'spray');return g;
}
function fernHi(c,R){
  const g=new THREE.Group(),s=c.sp,n=10+((R()*4)|0),len=s*0.62,set=cardSet(),c1=new THREE.Color(c.color).convertSRGBToLinear(),tmp=new THREE.Color();
  for(let k=0;k<n;k++){
    const a=k/n*6.2832+R()*0.4,tilt=0.55+R()*0.55,ca=Math.cos(a),sa=Math.sin(a);
    const b=V3.norm([Math.sin(tilt)*ca,Math.cos(tilt),Math.sin(tilt)*sa]),tt=[-sa,0,ca],nrm=V3.norm([ca*0.3,1,sa*0.3]);
    tmp.copy(c1).multiplyScalar(1.1+R()*0.5);
    set.add([ca*0.12,0.05,sa*0.12],tt,b,len*0.62,len*(0.85+R()*0.3),nrm,(R()*4)|0,[tmp.r,tmp.g,tmp.b],1);
  }
  cardMesh(g,set,'frond',false);return g;
}
function grassHi(c,R){
  const g=new THREE.Group(),s=c.sp;
  const geo=bladeGeo(R,{n:70+((s*5)|0),rad:s*0.12,hmin:c.h*0.7,hmax:c.h*1.05,lean:0.6,wid:0.12,base:shade(c.color,0.6),tip:shade(c.color,1.12),straw:true});
  const m=new THREE.Mesh(geo,bladeMat());m.castShadow=false;m.receiveShadow=true;g.add(m);return g;
}
/* hedge line: a dark core plus a skin of small leaf cards over the clipped profile */
function hedgeHi(g,a,b,t,h,R,color){
  const dx=b[0]-a[0],dz=b[1]-a[1],L=Math.hypot(dx,dz),rot=-Math.atan2(dz,dx),sz=Math.max(0.34,Math.min(0.7,t*0.22));
  const core=new THREE.Mesh(new THREE.BoxGeometry(L,h*0.92,t*0.78),M(shade(color,0.55),{tx:'leaf'}));
  core.position.set((a[0]+b[0])/2,h*0.46,(a[1]+b[1])/2);core.rotation.y=rot;core.castShadow=true;core.receiveShadow=true;g.add(core);
  const set=cardSet(),per=2*h+t,n=Math.min(7000,Math.round(L*per*1.5/(sz*sz*0.55))),c1=new THREE.Color(color).convertSRGBToLinear(),c2=new THREE.Color(shade(color,1.22)).convertSRGBToLinear(),tmp=new THREE.Color();
  const ux=dx/L,uz=dz/L,nx0=uz,nz0=-ux;
  for(let i=0;i<n;i++){
    const u=R()*L,sp=R()*per;let ox,oy,nx,ny,nz;
    if(sp<h){ox=-t/2;oy=sp;nx=-1;ny=0;nz=0;}else if(sp<h+t){ox=-t/2+(sp-h);oy=h;nx=0;ny=1;nz=0;}else{ox=t/2;oy=per-sp;nx=1;ny=0;nz=0;}
    const wx=a[0]+ux*u+nx0*ox,wz=a[1]+uz*u+nz0*ox,N=V3.norm([nx0*nx*(nx?1:0)+(ny?0:0),ny,nz0*nx*(nx?1:0)]);
    const out=nx?[nx0*nx,0,nz0*nx]:[0,1,0],bb=V3.norm([out[0]*0.6+(R()-.5)*1.2,out[1]*0.6+0.35+(R()-.5)*1.0,out[2]*0.6+(R()-.5)*1.2]);
    const tt=V3.norm(V3.cross(bb,[R()-.5,R()-.5,R()-.5]));
    const nrm=V3.norm([out[0]*0.85+bb[0]*0.15,out[1]*0.85+bb[1]*0.15,out[2]*0.85+bb[2]*0.15]);void N;
    tmp.copy(c1).lerp(c2,R()).multiplyScalar(0.95+R()*0.7);
    const s=sz*(0.75+R()*0.5);set.add([wx-bb[0]*s*0.25,oy-bb[1]*s*0.25,wz-bb[2]*s*0.25],tt,bb,s,s*1.1,nrm,(R()*4)|0,[tmp.r,tmp.g,tmp.b],0.7);
  }
  cardMesh(g,set,'leaf');
}
/* ===== Plotline: scene, camera, sun, objects, selection ===== */
const stageEl=$('stage'),cv=$('cv');
function showFatal(msg){const d=document.createElement('div');d.className='fatal';d.textContent=msg;stageEl.appendChild(d);}
if(typeof THREE==='undefined'||!THREE.OrbitControls){showFatal('The 3D engine did not load. Check your connection and reload.');throw new Error('three missing');}
let renderer;
try{renderer=new THREE.WebGLRenderer({canvas:cv,antialias:true});}
catch(err){showFatal('This browser could not start 3D graphics. Try Chrome, Edge, Safari or Firefox with hardware acceleration on.');throw err;}
renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;

/* state shared with the editor code */
let S=null;
const store={cur:null,projects:{}};
const ui={grid:true,labels:false,shadows:true,r2:{style:'ill',labels:true,shadows:true,legend:true,dims:true}};

let tool={mode:'select'};
let selId=null,view='persp',tween=null,dirty=true;
let r2dirty=true;
function invalidate(){dirty=true;r2dirty=true;}

const scene=new THREE.Scene();
const fog=new THREE.Fog(0xbfd8e8,500,1400);
scene.background=new THREE.Color(0xbfd8e8);scene.fog=fog;
const camera=new THREE.PerspectiveCamera(38,1,1,1500);
const controls=new THREE.OrbitControls(camera,cv);
controls.enableDamping=false;controls.screenSpacePanning=false;controls.minDistance=5;controls.maxDistance=450;controls.maxPolarAngle=Math.PI/2-0.03;
controls.addEventListener('change',invalidate);

const hemi=new THREE.HemisphereLight(0xdfeaf5,0x6b7a5a,0.6);scene.add(hemi);
const sun=new THREE.DirectionalLight(0xfff1d6,1);sun.castShadow=true;
sun.shadow.mapSize.set(2048,2048);sun.shadow.bias=-0.0006;sun.shadow.normalBias=0.04;
scene.add(sun);scene.add(sun.target);
const moon=new THREE.DirectionalLight(0x9DB4E0,0);moon.position.set(-80,140,60);moon.visible=false;scene.add(moon);

const lotGroup=new THREE.Group(),objectGroup=new THREE.Group(),labelGroup=new THREE.Group(),selGroup=new THREE.Group(),handleGroup=new THREE.Group(),ghostGroup=new THREE.Group(),previewGroup=new THREE.Group();
[lotGroup,objectGroup,labelGroup,selGroup,handleGroup,ghostGroup,previewGroup].forEach(g=>scene.add(g));
labelGroup.visible=false;

function disposeTree(o){o.traverse(n=>{if(n.geometry&&!n.geometry.userData.shared)n.geometry.dispose();if(n.userData&&n.userData.ownMat){[].concat(n.material).forEach(m=>{if(m.map)m.map.dispose();m.dispose();});}});}
function clearGroup(g){while(g.children.length){const c=g.children[0];g.remove(c);disposeTree(c);}}

/* distant tree line: a hazy ring on the horizon so the ground does not just end */
function treeline(){
  const R0=520,N=220,g=new THREE.BufferGeometry(),pos=[],col=[],idx=[],c=new THREE.Color();
  const hg=a=>26+14*Math.sin(a*5+1.3)+9*Math.sin(a*13+0.4)+6*Math.sin(a*31+2.1)+4*Math.sin(a*77)+3*Math.sin(a*131+1.0);
  for(let i=0;i<=N;i++){
    const a=i/N*6.2832,x=Math.cos(a)*R0,z=Math.sin(a)*R0,h=Math.max(8,hg(a));
    pos.push(x,-2,z,x,h,z);
    c.set('#34502F').convertSRGBToLinear();col.push(c.r*0.5,c.g*0.5,c.b*0.5);
    c.set('#5E7F48').convertSRGBToLinear();col.push(c.r,c.g,c.b);
    if(i<N){const k=i*2;idx.push(k,k+2,k+1,k+1,k+2,k+3);}
  }
  g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));g.setAttribute('color',new THREE.Float32BufferAttribute(col,3));g.setIndex(idx);g.computeVertexNormals();
  const m=new THREE.Mesh(g,new THREE.MeshBasicMaterial({vertexColors:true,side:THREE.DoubleSide,fog:true}));
  m.userData.ownMat=true;m.frustumCulled=false;m.raycast=function(){};return m;
}
/* ---- lot, grid, shadow bounds ---- */
let gridMesh=null;
function buildLot(){
  clearGroup(lotGroup);const w=S.lot.w,d=S.lot.d;
  let farM,lotM;
  if(Q===2){farM=texMat({id:'_far',tex:'lawn',color:'#7C9060',gp:'far'});lotM=texMat({id:'_lot',tex:'lawn',color:'#86995F'});}
  else if(Q===0){farM=M('#E9E5DB',{flatShading:false});lotM=M('#F6F3EC',{flatShading:false});}
  else{farM=M('#AEB8A4',{flatShading:false});lotM=M('#A9B895',{flatShading:false});}
  const farG=new THREE.PlaneGeometry(2000,2000).rotateX(-Math.PI/2);
  if(Q===2){const uv=farG.attributes.uv;for(let i=0;i<uv.count;i++)uv.setXY(i,uv.getX(i)*2000,uv.getY(i)*2000);}
  const far=new THREE.Mesh(farG,farM);far.position.y=-0.06;far.receiveShadow=true;lotGroup.add(far);
  const lotG=new THREE.PlaneGeometry(w,d).rotateX(-Math.PI/2);
  if(Q===2){const uv=lotG.attributes.uv;for(let i=0;i<uv.count;i++)uv.setXY(i,uv.getX(i)*w,uv.getY(i)*d);}
  const lot=new THREE.Mesh(lotG,lotM);lot.position.y=-0.01;lot.receiveShadow=true;lotGroup.add(lot);
  if(Q===2)lotGroup.add(treeline());
  const bp=[[-w/2,-d/2],[w/2,-d/2],[w/2,d/2],[-w/2,d/2],[-w/2,-d/2]].map(p=>new THREE.Vector3(p[0],0.12,p[1]));
  const blm=new THREE.LineDashedMaterial({color:lin(Q===0?INK:0xC2542D),dashSize:2.5,gapSize:1.5,toneMapped:false});if(Q===2)depthClip(blm);
  const bl=new THREE.Line(new THREE.BufferGeometry().setFromPoints(bp),blm);bl.computeLineDistances();bl.userData.ownMat=true;bl.userData.ui=true;lotGroup.add(bl);
  const gp=[];
  for(let x=-w/2;x<=w/2+0.001;x+=5)gp.push(x,0.25,-d/2,x,0.25,d/2);
  for(let z=-d/2;z<=d/2+0.001;z+=5)gp.push(-w/2,0.25,z,w/2,0.25,z);
  const gg=new THREE.BufferGeometry();gg.setAttribute('position',new THREE.Float32BufferAttribute(gp,3));
  const gm=new THREE.LineBasicMaterial({color:lin(Q===0?INK:0xffffff),transparent:true,opacity:Q===0?0.14:0.3,toneMapped:false});if(Q===2)depthClip(gm);
  gridMesh=new THREE.LineSegments(gg,gm);gridMesh.userData.ownMat=true;gridMesh.userData.ui=true;gridMesh.visible=ui.grid;lotGroup.add(gridMesh);
  const R=Math.hypot(w,d)/2+14,sc=sun.shadow.camera;sc.left=-R;sc.right=R;sc.top=R;sc.bottom=-R;sc.near=1;sc.far=420;sc.updateProjectionMatrix();sc.updateProjectionMatrix();
  invalidate();
}

/* ---- sun ---- */
const DECL=[-20.9,-13,-2.4,9.4,18.8,23.1,21.2,13.5,2.2,-9.6,-18.9,-23];
function sunVec(){
  const phi=S.lot.lat*Math.PI/180,dec=DECL[S.sun.month-1]*Math.PI/180,H=(S.sun.hour-12)*15*Math.PI/180;
  const up=Math.sin(phi)*Math.sin(dec)+Math.cos(phi)*Math.cos(dec)*Math.cos(H);
  const east=-Math.cos(dec)*Math.sin(H);
  const north=Math.sin(dec)*Math.cos(phi)-Math.cos(dec)*Math.sin(phi)*Math.cos(H);
  return{v:new THREE.Vector3(east,up,-north).normalize(),alt:Math.asin(Math.max(-1,Math.min(1,up)))*180/Math.PI};
}
/* ---- sky dome + environment (realistic look) ---- */
const SKY_VS='varying vec3 vDir;void main(){vDir=normalize(position);gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}';
const SKY_FS='uniform vec3 zen;uniform vec3 hor;uniform vec3 gnd;uniform vec3 sunCol;uniform vec3 sunDir;uniform vec3 cLit;uniform vec3 cShade;uniform float glow;uniform float disc;uniform float cover;uniform float uTime;varying vec3 vDir;'
+'float h21(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}'
+'float vn(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);return mix(mix(h21(i),h21(i+vec2(1.0,0.0)),f.x),mix(h21(i+vec2(0.0,1.0)),h21(i+vec2(1.0,1.0)),f.x),f.y);}'
+'float fbm(vec2 p){float a=0.5,s=0.0;for(int i=0;i<5;i++){s+=a*vn(p);p=p*2.07+vec2(17.3,9.1);a*=0.5;}return s;}'
+'void main(){vec3 d=normalize(vDir);float h=d.y;'
+'vec3 sky=mix(hor,zen,pow(clamp(h,0.0,1.0),0.42));sky=mix(sky,hor*1.04,exp(-max(h,0.0)*13.0)*0.55);'
+'vec3 col=h>=0.0?sky:mix(hor,gnd,smoothstep(0.0,0.2,-h));'
+'float s=max(dot(d,sunDir),0.0);col+=sunCol*(pow(s,1200.0)*disc*60.0+pow(s,40.0)*0.5*glow+pow(s,7.0)*0.2*glow);'
+'if(h>0.01&&cover>0.001){vec2 uv=d.xz/(h+0.16)*1.1+vec2(uTime*0.006,uTime*0.002);float n=fbm(uv*1.4);float c=smoothstep(1.0-cover,1.0-cover+0.3,n);float dens=smoothstep(1.0-cover,1.0,n);'
+'float fade=smoothstep(0.01,0.16,h);vec3 cc=mix(cLit,cShade,dens*0.85);cc+=sunCol*0.35*pow(s,9.0)*(1.0-dens*0.7);col=mix(col,cc,c*fade*0.9);}'
+'gl_FragColor=linearToOutputTexel(vec4(col,1.0));}';
function skyMaterial(u){return new THREE.ShaderMaterial({uniforms:u,vertexShader:SKY_VS,fragmentShader:SKY_FS,side:THREE.BackSide,depthWrite:false,depthTest:false,fog:false});}
function skyUniforms(d,cv){return{zen:{value:new THREE.Color()},hor:{value:new THREE.Color()},gnd:{value:new THREE.Color()},sunCol:{value:new THREE.Color()},sunDir:{value:new THREE.Vector3(0,1,0)},cLit:{value:new THREE.Color()},cShade:{value:new THREE.Color()},glow:{value:1},disc:{value:d},cover:{value:cv},uTime:{value:0}};}
const skyU=skyUniforms(1,0.5);
const skyMesh=new THREE.Mesh(new THREE.SphereGeometry(1000,32,16),skyMaterial(skyU));
skyMesh.renderOrder=-10;skyMesh.frustumCulled=false;skyMesh.visible=false;scene.add(skyMesh);
let _env=null,_envRT=null,_envScene=null,_pmrem=null,envDirty=false,_envT=0;
const envU=skyUniforms(0,0);
function getEnv(){
  if(_env)return _env;
  _envScene=new THREE.Scene();_envScene.add(new THREE.Mesh(new THREE.SphereGeometry(50,32,16),skyMaterial(envU)));
  _pmrem=new THREE.PMREMGenerator(renderer);
  envU.zen.value.copy(lin('#5B93D6'));envU.hor.value.copy(lin('#DDEBF5'));envU.gnd.value.copy(lin('#7A8A66'));
  return updateEnv();
}
function updateEnv(){
  if(!_pmrem){return getEnv();}
  const rt=_pmrem.fromScene(_envScene,0);if(_envRT)_envRT.dispose();_envRT=rt;_env=rt.texture;
  if(Q===2)scene.environment=_env;envDirty=false;_envT=performance.now();return _env;
}
function placeSky(){skyMesh.position.copy(camera.position);}
function applyRenderMode(){
  const hi=Q===2;_fw.skip=16;_fw.s=[];
  FX.active=fxWanted();if(!FX.active)POST.free();
  renderer.outputEncoding=hi?THREE.sRGBEncoding:THREE.LinearEncoding;
  renderer.toneMapping=(hi&&!FX.active)?THREE.ACESFilmicToneMapping:THREE.NoToneMapping;
  renderer.toneMappingExposure=1.0;
  scene.environment=hi?getEnv():null;
  skyMesh.visible=hi;
  scene.fog=Q===0?null:fog;
  const ms=hi?4096:2048;
  if(sun.shadow.mapSize.x!==ms){sun.shadow.mapSize.set(ms,ms);if(sun.shadow.map){sun.shadow.map.dispose();sun.shadow.map=null;}}
  sun.shadow.bias=hi?-0.0004:-0.0006;sun.shadow.normalBias=hi?0.03:0.04;
}
const GLOW={bulb:null,win:null};
function clamp01(x){return Math.max(0,Math.min(1,x));}
function applySun(){
  const sv=sunVec(),alt=sv.alt,day=alt>0,k=Math.max(0,Math.sin(alt*Math.PI/180));
  sun.position.copy(sv.v).multiplyScalar(160);sun.target.position.set(0,0,0);sun.target.updateMatrixWorld();
  const twi=Math.max(0,Math.min(1,(alt+6)/24)),warm=Math.max(0,1-Math.abs(alt-3)/12)*0.45;
  if(Q===2){
    const T=clamp01((alt+8)/30),dusk=clamp01(1-Math.abs(alt-1)/13),night=clamp01((3-alt)/9);
    sun.intensity=day?0.25+1.6*Math.pow(k,0.5):0;
    sun.color.copy(lin('#FFFFFF')).lerp(lin('#FFB36E'),clamp01(1-alt/30)).lerp(lin('#FF8A48'),clamp01(1-alt/7));
    const zen=lin('#04081A').lerp(lin('#16306A'),clamp01(T*2.2)).lerp(lin('#3A74C2'),clamp01((T-0.35)/0.65));
    const hor=lin('#0B1226').lerp(lin('#CBDDEA'),Math.pow(T,0.7)).lerp(lin('#F39A62'),dusk*0.75);
    const gnd=lin('#151C14').lerp(lin('#6E7F58'),T);
    const dk=clamp01((alt+9)/9);
    hemi.color.copy(zen).lerp(hor,0.5).multiplyScalar(1.4);hemi.groundColor.copy(gnd);hemi.intensity=day?0.1+0.08*k:0.14+0.3*dk;
    setEnvI(day?0.75+0.55*k:0.35+0.5*dk);
    const mo=night>0.05;if(moon.visible!==mo)moon.visible=mo;moon.intensity=0.22*night;
    const sc=lin('#FFE2B0').lerp(lin('#FF9A55'),clamp01(1-alt/12));
    [skyU,envU].forEach(u=>{
      u.zen.value.copy(zen);u.hor.value.copy(hor);u.gnd.value.copy(gnd);u.sunDir.value.copy(sv.v);
      u.sunCol.value.copy(sc).multiplyScalar(day?1:clamp01(1+alt/4));u.glow.value=day?1:clamp01(1+alt/5);
      u.cLit.value.copy(sc).multiplyScalar(0.85*(day?1:clamp01(1+alt/4))).add(hor.clone().multiplyScalar(0.35)).multiplyScalar(0.12+0.88*T);
      u.cShade.value.copy(zen).lerp(lin('#8C98A8'),0.5).multiplyScalar(0.7*(0.2+0.8*T));
    });
    skyU.cover.value=0.52;envU.cover.value=0.52;skyU.disc.value=day?1:0;envU.disc.value=0;
    scene.background.copy(hor);fog.color.copy(hor).lerp(zen,0.12);fog.near=120;fog.far=850;
    envDirty=true;
    /* garden lights, window glow and bulbs come on as the sun sets */
    let nl=0;
    objectGroup.traverse(n=>{if(n.isPointLight){const on=night>0.02&&nl<8;if(n.visible!==on)n.visible=on;n.intensity=on?9*night:0;if(on)nl++;}});
    if(GLOW.bulb)GLOW.bulb.emissiveIntensity=0.5+9*night;
    if(GLOW.win)GLOW.win.emissiveIntensity=2.4*night;
  }else if(Q===0){
    sun.intensity=day?0.5+0.4*k:0;sun.color.setHex(0xffffff);
    hemi.color.setHex(0xffffff);hemi.groundColor.setHex(0xd9d5cb);hemi.intensity=day?0.85:0.4;
    scene.background.setHex(0xF1EEE6);
  }else{
    sun.intensity=day?0.35+0.95*Math.pow(k,0.55):0;
    sun.color.setHex(0xffffff).lerp(new THREE.Color(0xffa55c),Math.max(0,Math.min(1,1-alt/35)));
    hemi.color.setHex(0xdfeaf5);hemi.groundColor.setHex(0x6b7a5a);hemi.intensity=day?0.38+0.3*k:0.16;
    const sky=new THREE.Color(0x0B1220).lerp(new THREE.Color(0xBFD8E8),twi);
    sky.lerp(new THREE.Color(0xE9A66B),warm);
    scene.background.copy(sky);fog.color.copy(sky);fog.near=500;fog.far=1400;
  }
  $('sunTxt').textContent=fmtHour(S.sun.hour)+(day?' · '+Math.round(alt)+'° high':' · night');
  invalidate();
}
function refreshMaterials(){Object.keys(_mat).forEach(k=>{_mat[k].needsUpdate=true;});Object.keys(_tm).forEach(k=>{_tm[k].needsUpdate=true;});}

/* ---- objects ---- */
const meshes=new Map();
function elevAt(x,z,skipId){
  let e=0;
  S.objects.forEach(o=>{const c=CAT[o.cat];if(c.kind!=='area'||c.building||o.id===skipId)return;if(inPoly(x,z,o.pts)){const h=o.height!=null?o.height:c.h;if(h>e)e=h;}});
  return e;
}
function buildObjectMesh(o,order){
  const c=CAT[o.cat];
  if(c.kind==='point')return buildPoint(o,elevAt(o.x,o.z));
  if(c.kind==='area'){const m=buildArea(o);m.position.y=Math.min(order,60)*0.003;return m;}
  return buildLine(o);
}
function rebuildObject(o){
  const old=meshes.get(o.id);if(old){objectGroup.remove(old);disposeTree(old);}
  const m=buildObjectMesh(o,S.objects.indexOf(o));objectGroup.add(m);meshes.set(o.id,m);invalidate();
}
function rebuildAll(){
  clearGroup(objectGroup);meshes.clear();
  S.objects.forEach((o,i)=>{const m=buildObjectMesh(o,i);objectGroup.add(m);meshes.set(o.id,m);});
  refreshLabels();invalidate();
}
function getSel(){return selId?S.objects.find(o=>o.id===selId)||null:null;}
function refreshLabels(){
  clearGroup(labelGroup);const k=Math.max(1,Math.max(S.lot.w,S.lot.d)/60);
  S.objects.forEach(o=>{
    const c=CAT[o.cat];let t=o.label||c.name,pos;
    if(c.kind==='point'){if(o.count>1)t+=' x'+o.count;pos=[o.x,Math.min(c.h*(o.scale||1),3)+0.6,o.z];}
    else if(c.kind==='area'){if(!c.building)t+=' · '+Math.round(polyArea(o.pts))+' sf';const ct=centroid(o.pts);pos=[ct[0],Math.min(o.height!=null?o.height:c.h,4)+0.8,ct[1]];}
    else{t+=' · '+Math.round(polyLen(o.pts))+' lf';const m=lineMid(o.pts);pos=[m[0],Math.min(o.height!=null?o.height:c.h,4)+0.8,m[1]];}
    const sp=labelSprite(t);sp.position.set(pos[0],pos[1],pos[2]);sp.scale.multiplyScalar(k);labelGroup.add(sp);
  });
  labelGroup.visible=ui.labels;invalidate();
}

/* ---- selection outline + vertex handles ---- */
const AMBER=0xF2C14E;
function buildSelection(){
  clearGroup(selGroup);clearGroup(handleGroup);selGroup.position.set(0,0,0);handleGroup.position.set(0,0,0);
  const o=getSel();if(!o){invalidate();return;}
  const c=CAT[o.cat];
  if(c.kind==='point'){
    const r=footR(o),ring=new THREE.Mesh(new THREE.RingGeometry(r*0.94,r,48).rotateX(-Math.PI/2),new THREE.MeshBasicMaterial({color:lin(AMBER),depthTest:false,transparent:true,opacity:0.95,side:THREE.DoubleSide,toneMapped:false}));
    ring.position.set(o.x,elevAt(o.x,o.z)+0.12,o.z);ring.renderOrder=998;ring.userData.ownMat=true;selGroup.add(ring);
  }else{
    const h=(o.height!=null?o.height:c.h)+0.15,pts=o.pts.map(p=>new THREE.Vector3(p[0],h,p[1]));if(c.kind==='area')pts.push(pts[0].clone());
    const ln=new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts),new THREE.LineBasicMaterial({color:lin(AMBER),depthTest:false,transparent:true,toneMapped:false}));ln.renderOrder=998;ln.userData.ownMat=true;selGroup.add(ln);
    o.pts.forEach((p,i)=>{
      const hm=new THREE.Mesh(new THREE.SphereGeometry(1,12,8),new THREE.MeshBasicMaterial({color:lin(0xFFFFFF),depthTest:false,transparent:true,toneMapped:false}));
      hm.position.set(p[0],h,p[1]);hm.userData.vi=i;hm.userData.ownMat=true;hm.renderOrder=999;handleGroup.add(hm);
    });
  }
  invalidate();
}

/* ---- camera views ---- */
function lotFit(aspect){const t=Math.tan(camera.fov*Math.PI/360);return Math.max((S.lot.d/2*1.14)/t,(S.lot.w/2*1.14)/(t*aspect));}
function viewPose(v,aspect){
  const m=Math.max(S.lot.w,S.lot.d);
  if(v==='plan')return{pos:new THREE.Vector3(0,lotFit(aspect),0.001),target:new THREE.Vector3(0,0,0)};
  const dir=new THREE.Vector3(-0.44,0.5,0.74).normalize();
  return{pos:dir.multiplyScalar(Math.max(m*1.25,lotFit(aspect)*1.12)),target:new THREE.Vector3(0,0,0)};
}
function startTween(pose,done,instant){
  const reduce=window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if(instant||reduce){tween=null;camera.position.copy(pose.pos);controls.target.copy(pose.target);controls.update();invalidate();if(done)done();return;}
  tween={t0:performance.now(),dur:550,fp:camera.position.clone(),ft:controls.target.clone(),tp:pose.pos,tt:pose.target,done};
}
function stepTween(){
  const k=Math.min(1,(performance.now()-tween.t0)/tween.dur),e=k<.5?2*k*k:1-Math.pow(-2*k+2,2)/2;
  camera.position.lerpVectors(tween.fp,tween.tp,e);controls.target.lerpVectors(tween.ft,tween.tt,e);
  if(k>=1){const d=tween.done;tween=null;if(d)d();}
  invalidate();
}
function applyMouseButtons(){
  const B=THREE.MOUSE,plan=view==='plan';
  if(tool.mode==='select')controls.mouseButtons={LEFT:plan?B.PAN:B.ROTATE,MIDDLE:B.DOLLY,RIGHT:B.PAN};
  else controls.mouseButtons={LEFT:-1,MIDDLE:B.PAN,RIGHT:plan?B.PAN:B.ROTATE};
}
function setView(v,instant){
  view=v;const r=v==='render';
  document.querySelectorAll('#viewSeg button').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.view===v)));
  cv.style.display=r?'none':'block';$('cv2').hidden=!r;
  $('chips3d').hidden=r;$('chips2d').hidden=!r;$('lookWrap').hidden=r;document.body.classList.toggle('is-render',r);
  if(r){
    tween=null;if(typeof tool!=='undefined'&&tool.mode!=='select')setTool({mode:'select'});
    if(selId)select(null);
    if(typeof closeLookMenu==='function')closeLookMenu();
    invalidate();return;
  }
  if(v==='persp')controls.enableRotate=true;
  startTween(viewPose(v,camera.aspect),()=>{controls.enableRotate=(v==='persp');},instant);
  applyMouseButtons();invalidate();
}
function resize(){
  const r=stageEl.getBoundingClientRect(),w=Math.max(1,Math.floor(r.width)),h=Math.max(1,Math.floor(r.height));
  renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,fxPR()));renderer.setSize(w,h,false);
  camera.aspect=w/h;camera.updateProjectionMatrix();
  const c2=$('cv2'),dp=Math.min(window.devicePixelRatio||1,2);if(c2){c2.width=Math.round(w*dp);c2.height=Math.round(h*dp);}
  invalidate();
}
if(window.ResizeObserver)new ResizeObserver(resize).observe(stageEl);else window.addEventListener('resize',resize);

/* ---- per-frame work ---- */
const _v=new THREE.Vector3();let _scaleTxt='',_scaleW=0;
function frameUpdates(){
  handleGroup.children.forEach(h=>{const d=camera.position.distanceTo(_v.copy(h.position).add(handleGroup.position));h.scale.setScalar(Math.max(0.15,d*0.0075));});
  $('compass').style.transform='rotate('+(controls.getAzimuthalAngle()*180/Math.PI).toFixed(1)+'deg)';
  const sc=$('scale');
  if(view==='plan'&&!tween&&cv.clientHeight>0){
    const fpp=2*camera.position.y*Math.tan(camera.fov*Math.PI/360)/cv.clientHeight;let L=1;
    [1,2,5,10,20,50,100,200].forEach(n=>{if(n/fpp<=150)L=n;});
    const w=Math.round(L/fpp),t=L+' ft';
    if(w!==_scaleW||t!==_scaleTxt){_scaleW=w;_scaleTxt=t;$('scaleLine').style.width=w+'px';$('scaleTxt').textContent=t;}
    sc.hidden=false;
  }else sc.hidden=true;
}
let _anT=0;
function loop(){
  requestAnimationFrame(loop);
  const now=performance.now();
  if(tween)stepTween();
  controls.update();
  if(Q===2&&view!=='render'){
    if(envDirty&&now-_envT>140){updateEnv();dirty=true;}
    if(FX.wind&&!FX.still&&!document.hidden&&now-_anT>50){_anT=now;WIND.t.value=now/1000;skyU.uTime.value=now/1000;dirty=true;}
  }
  if(view==='render'){if(r2dirty){r2dirty=false;dirty=false;if(typeof drawStage2D==='function')drawStage2D();}}
  else if(dirty){dirty=false;r2dirty=false;frameUpdates();placeSky();fxRender();}
}

/* ---- image capture for the proposal (clean frame, fixed size) ---- */
function capture(which){
  const W=1280,H=800,ps=renderer.getSize(new THREE.Vector2()),ppr=renderer.getPixelRatio();
  const pPos=camera.position.clone(),pQuat=camera.quaternion.clone(),pAsp=camera.aspect;
  const vis=[selGroup.visible,handleGroup.visible,ghostGroup.visible,previewGroup.visible,labelGroup.visible,gridMesh?gridMesh.visible:false];
  selGroup.visible=handleGroup.visible=ghostGroup.visible=previewGroup.visible=false;
  labelGroup.visible=(which==='plan');if(gridMesh)gridMesh.visible=(which==='plan');
  const pose=viewPose(which,W/H);
  camera.position.copy(pose.pos);camera.lookAt(pose.target);camera.aspect=W/H;camera.updateProjectionMatrix();
  renderer.setPixelRatio(1);renderer.setSize(W,H,false);placeSky();renderFrame();
  let url='';try{url=cv.toDataURL('image/jpeg',0.86);}catch(e){url='';}
  renderer.setPixelRatio(ppr);renderer.setSize(ps.x,ps.y,false);
  camera.aspect=pAsp;camera.updateProjectionMatrix();camera.position.copy(pPos);camera.quaternion.copy(pQuat);
  selGroup.visible=vis[0];handleGroup.visible=vis[1];ghostGroup.visible=vis[2];previewGroup.visible=vis[3];labelGroup.visible=vis[4];if(gridMesh)gridMesh.visible=vis[5];
  invalidate();return url;
}
/* ===== Plotline: library, inspector, estimate, tools ===== */
function isMobile(){return window.matchMedia('(max-width:860px)').matches;}
let toastT=null;
function toast(msg){const t=$('toast');t.textContent=msg;t.hidden=false;clearTimeout(toastT);toastT=setTimeout(()=>{t.hidden=true;},3400);}
function fmtPrice(n){return n>=100?String(Math.round(n)):n.toFixed(2).replace(/\.00$/,'');}
function fmtQ(r){const c=r.cat,q=r.qty;return c.kind==='area'?Math.round(q).toLocaleString('en-US'):c.kind==='line'?q.toFixed(1):String(q);}
function fmtQU(r){return fmtQ(r)+' '+r.cat.unit;}
function setSaveState(t){$('saveState').textContent=t;}

/* ---- history ---- */
let hist=[],hi=-1;
function snapJSON(){return JSON.stringify(S);}
function resetHistory(){hist=[snapJSON()];hi=0;updateUndoUI();}
function updateUndoUI(){$('undoBtn').disabled=hi<=0;$('redoBtn').disabled=hi>=hist.length-1;}
function commit(){
  const j=snapJSON();
  if(j!==hist[hi]){hist.length=hi+1;hist.push(j);hi++;if(hist.length>80){hist.shift();hi--;}}
  scheduleSave();updateUndoUI();
}
function restore(i){hi=i;S=normalizeState(JSON.parse(hist[hi]));afterLoad(true);scheduleSave();updateUndoUI();}
function undo(){if(hi>0)restore(hi-1);}
function redo(){if(hi<hist.length-1)restore(hi+1);}

/* ---- persistence (this browser) ---- */
const LSKEY='plotline.v1';let saveTimer=null;
function loadStore(){
  try{const raw=JSON.parse(localStorage.getItem(LSKEY)||'null');if(raw&&typeof raw==='object'&&raw.projects&&typeof raw.projects==='object'){store.cur=raw.cur||null;store.projects=raw.projects;return true;}}catch(e){}
  return false;
}
function persist(){try{localStorage.setItem(LSKEY,JSON.stringify(store));return true;}catch(e){return false;}}
function scheduleSave(){
  setSaveState('Saving…');clearTimeout(saveTimer);
  saveTimer=setTimeout(()=>{S.updated=Date.now();store.projects[S.id]=S;store.cur=S.id;setSaveState(persist()?'Saved on this device':'Not saved: browser storage is blocked');},500);
}

/* ---- library ---- */
let curGroup='trees';
function renderCats(){$('cats').innerHTML=GROUPS.map(g=>'<button class="cat" data-g="'+g.id+'" aria-pressed="'+(g.id===curGroup)+'">'+esc(g.name)+'</button>').join('');}
function renderLib(){
  $('lib').innerHTML=CATALOG.filter(c=>c.group===curGroup).map(c=>{
    const tip=c.kind==='point'?'Click, then click the ground to place':'Click, then draw it on the ground';
    return '<button class="item" data-c="'+c.id+'" aria-pressed="'+(tool.cat===c.id)+'" title="'+tip+'"><span class="sw '+c.kind+'" style="background:'+c.color+'"></span><span class="nm">'+esc(c.name)+'</span><span class="pr">'+(c.excluded?'':'$'+fmtPrice(unitCostOf(S,c))+'/'+c.unit)+'</span></button>';
  }).join('');
}
$('cats').addEventListener('click',e=>{const b=e.target.closest('[data-g]');if(!b)return;curGroup=b.dataset.g;renderCats();renderLib();});
$('lib').addEventListener('click',e=>{
  const b=e.target.closest('[data-c]');if(!b)return;const id=b.dataset.c;
  if(tool.cat===id){setTool({mode:'select'});return;}
  startCatTool(id);
});
$('toolSelect').addEventListener('click',()=>setTool({mode:'select'}));

/* ---- right-panel tabs (and mobile bottom tabs) ---- */
let rtab='inspect';
function setRTab(name){
  rtab=name;
  document.querySelectorAll('#rtabs button').forEach(b=>b.setAttribute('aria-selected',String(b.dataset.tab===name)));
  $('tabInspect').hidden=name!=='inspect';$('tabEstimate').hidden=name!=='estimate';$('tabPrices').hidden=name!=='prices';
  if(name==='inspect')renderInspector();
}
function showPanel(name){
  $('app').classList.toggle('m-lib',name==='library');
  if(name!=='library')setRTab(name);
  document.querySelectorAll('#mtabs button').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.p===name)));
}
$('rtabs').addEventListener('click',e=>{const b=e.target.closest('[data-tab]');if(b)setRTab(b.dataset.tab);});
$('mtabs').addEventListener('click',e=>{const b=e.target.closest('[data-p]');if(b)showPanel(b.dataset.p);});

/* ---- inspector ---- */
function r1(n){return Math.round(n*10)/10;}
function renderInspector(){
  const el=$('tabInspect'),o=getSel();
  if(!o){
    const E=estimate(S),real=S.objects.filter(q=>!CAT[q.cat].excluded);
    let surf=0;real.forEach(q=>{if(CAT[q.cat].kind==='area')surf+=polyArea(q.pts);});
    el.innerHTML='<div class="summary"><div><b>'+Math.round(S.lot.w*S.lot.d).toLocaleString('en-US')+'</b><span>Lot sq ft</span></div><div><b>'+real.length+'</b><span>Items</span></div><div><b>'+Math.round(surf).toLocaleString('en-US')+'</b><span>Surface sq ft</span></div><div><b>'+USD0.format(E.total)+'</b><span>Total</span></div></div>'
      +'<p class="help">Pick an item in the library, then click the ground. Surfaces and fences are drawn with clicks; <kbd>Enter</kbd> or a double-click finishes.</p>'
      +'<p class="help">Click anything to select it. Drag to move it, drag the white handles to reshape, <kbd>Delete</kbd> removes it, <kbd>[</kbd> <kbd>]</kbd> rotate.</p>'
      +'<p class="help">Left-drag orbits in 3D and pans in Plan. Right-drag pans (or orbits while a tool is active). Scroll to zoom.</p>';
    return;
  }
  const c=CAT[o.cat],pr=unitCostOf(S,c);
  let h='<div class="insp-head"><span class="sw '+c.kind+'" style="background:'+c.color+'"></span><div><div class="insp-name">'+esc(c.name)+'</div><div class="insp-sub">'+KIND_LABEL[c.kind]+'</div></div></div>';
  h+='<div class="field"><label for="f-label">Label on plan</label><input id="f-label" data-f="label" type="text" maxlength="60" value="'+esc(o.label)+'" placeholder="'+esc(c.name)+'"></div>';
  if(c.kind==='point'){
    h+='<div class="row2"><div class="field"><label for="f-x">From west edge (ft)</label><input id="f-x" data-f="x" type="number" step="0.5" value="'+r1(o.x+S.lot.w/2)+'"></div><div class="field"><label for="f-z">From north edge (ft)</label><input id="f-z" data-f="z" type="number" step="0.5" value="'+r1(o.z+S.lot.d/2)+'"></div></div>';
    h+='<div class="field"><label for="f-rot">Rotation (degrees)</label><div class="rangebox"><input id="f-rot" data-f="rot" type="range" min="0" max="360" step="5" value="'+Math.round(((o.rot%360)+360)%360)+'"><input data-f="rot" type="number" min="0" max="360" step="5" aria-label="Rotation degrees" value="'+Math.round(((o.rot%360)+360)%360)+'"></div></div>';
    h+='<div class="field"><label for="f-scale">Size (percent)</label><div class="rangebox"><input id="f-scale" data-f="scale" type="range" min="40" max="250" step="5" value="'+Math.round(o.scale*100)+'"><input data-f="scale" type="number" min="30" max="300" step="5" aria-label="Size percent" value="'+Math.round(o.scale*100)+'"></div></div>';
    if(c.group==='plants')h+='<div class="field"><label for="f-count">Plants in this group</label><input id="f-count" data-f="count" type="number" min="1" max="999" step="1" value="'+o.count+'"></div>';
  }else{
    const m=c.kind==='area'?'<div><b id="ro-a">'+Math.round(polyArea(o.pts)).toLocaleString('en-US')+' sf</b><span>Area</span></div><div><b id="ro-b">'+Math.round(polyPerim(o.pts))+' lf</b><span>Perimeter</span></div>':'<div><b id="ro-a">'+r1(polyLen(o.pts))+' lf</b><span>Length</span></div><div><b id="ro-b">'+o.pts.length+'</b><span>Points</span></div>';
    h+='<div class="readout">'+m+'</div>';
    h+='<div class="field"><label for="f-height">Height (ft)</label><input id="f-height" data-f="height" type="number" min="0.05" max="60" step="0.1" value="'+(o.height!=null?o.height:c.h)+'"></div>';
  }
  if(!c.excluded){
    h+='<div class="field"><label for="f-price">Your cost per '+UNIT_LONG[c.unit]+' (blank = price list: $'+fmtPrice(pr)+')</label><input id="f-price" data-f="price" type="number" min="0" step="0.01" value="'+(o.price!=null?o.price:'')+'"></div>';
    h+='<div class="readout"><div><b id="ro-q"></b><span>Quantity</span></div><div><b id="ro-p"></b><span>Client price</span></div></div>';
  }
  h+='<div class="field"><label for="f-note">Note for the proposal</label><textarea id="f-note" data-f="note" maxlength="400" rows="3" placeholder="Optional">'+esc(o.note)+'</textarea></div>';
  h+='<div class="btnrow"><button class="btn" id="btnDup">Duplicate</button><button class="btn danger" id="btnDel">Delete</button></div>';
  el.innerHTML=h;updatePriceReadout(o);
}
function updatePriceReadout(o){
  const c=CAT[o.cat],q=$('ro-q'),p=$('ro-p');if(!q||!p||c.excluded)return;
  const unit=o.price!=null?o.price:unitCostOf(S,c);
  q.textContent=c.kind==='point'?(o.count||1)+' ea':c.kind==='area'?Math.round(polyArea(o.pts)).toLocaleString('en-US')+' sf':r1(polyLen(o.pts))+' lf';
  p.textContent=money(qtyOfObj(o)*unit*(1+S.meta.markup/100));
}
function syncFields(f,val){document.querySelectorAll('#tabInspect [data-f="'+f+'"]').forEach(e=>{if(document.activeElement!==e)e.value=val;});}
function updateReadouts(o){
  updatePriceReadout(o);
  const c=CAT[o.cat];if(c.kind==='point')return;
  const a=$('ro-a'),b=$('ro-b');if(!a||!b)return;
  if(c.kind==='area'){a.textContent=Math.round(polyArea(o.pts)).toLocaleString('en-US')+' sf';b.textContent=Math.round(polyPerim(o.pts))+' lf';}
  else{a.textContent=r1(polyLen(o.pts))+' lf';b.textContent=String(o.pts.length);}
}
function applyField(o,f,el){
  const c=CAT[o.cat],v=el.value;
  switch(f){
    case 'label':o.label=v.slice(0,60);refreshLabels();break;
    case 'x':if(v==='')return;o.x=num(v,0,-1000,1000)-S.lot.w/2;rebuildObject(o);buildSelection();refreshLabels();break;
    case 'z':if(v==='')return;o.z=num(v,0,-1000,1000)-S.lot.d/2;rebuildObject(o);buildSelection();refreshLabels();break;
    case 'rot':if(v==='')return;o.rot=num(v,0,0,360);syncFields('rot',Math.round(o.rot));rebuildObject(o);break;
    case 'scale':if(v==='')return;o.scale=num(v,100,30,300)/100;syncFields('scale',Math.round(o.scale*100));rebuildObject(o);buildSelection();refreshLabels();break;
    case 'count':if(v==='')return;o.count=Math.round(num(v,1,1,999));rebuildObject(o);buildSelection();refreshLabels();break;
    case 'height':if(v==='')return;o.height=num(v,c.h,0.05,60);rebuildAll();buildSelection();break;
    case 'price':o.price=v===''?null:num(v,0,0,1e7);break;
    case 'note':o.note=v.slice(0,400);break;
  }
  updateEstimate();updatePriceReadout(o);updateReadouts(o);updateStatus();invalidate();
}
$('tabInspect').addEventListener('input',e=>{const f=e.target.dataset.f,o=getSel();if(f&&o)applyField(o,f,e.target);});
$('tabInspect').addEventListener('change',e=>{if(e.target.dataset.f)commit();});
$('tabInspect').addEventListener('click',e=>{
  if(e.target.closest('#btnDup'))duplicateSel();
  else if(e.target.closest('#btnDel'))deleteSel();
});
function select(id){
  selId=id;buildSelection();renderInspector();updateStatus();
  if(id&&isMobile())showPanel('inspect');else if(id&&rtab!=='inspect'&&!isMobile())setRTab('inspect');
}
function deleteSel(){
  const o=getSel();if(!o)return;
  S.objects=S.objects.filter(q=>q.id!==o.id);selId=null;rebuildAll();buildSelection();renderInspector();updateEstimate();updateStatus();commit();
}
function duplicateSel(){
  const o=getSel();if(!o)return;
  const n=JSON.parse(JSON.stringify(o));n.id=uid();
  if(n.pts)n.pts=n.pts.map(p=>[p[0]+3,p[1]+3]);else{n.x+=3;n.z+=3;}
  S.objects.push(n);rebuildAll();select(n.id);updateEstimate();commit();
}
function nudgeSel(dx,dz){
  const o=getSel();if(!o)return;
  if(o.pts)o.pts=o.pts.map(p=>[p[0]+dx,p[1]+dz]);else{o.x+=dx;o.z+=dz;}
  rebuildAll();buildSelection();renderInspector();commit();
}
function rotateSel(deg){
  const o=getSel();if(!o||o.pts)return;
  o.rot=((o.rot+deg)%360+360)%360;rebuildObject(o);renderInspector();commit();
}

/* ---- estimate tab ---- */
function qtyLine(r){return fmtQU(r)+' × '+money(r.clientUnit);}
function updateEstimate(){
  const E=estimate(S);
  let h='';
  if(!E.groups.length&&!E.custom.length)h='<p class="help">Nothing priced yet. Place items from the library and they appear here with quantities taken from the drawing.</p>';
  E.groups.forEach(g=>{
    h+='<div class="egroup">'+esc(g.g.name)+'</div>';
    g.rows.forEach(r=>{h+='<div class="erow"><span class="n">'+esc(r.cat.name)+(r.custom?' <small>(custom price)</small>':'')+'</span><span class="a">'+money(r.total)+'</span><span class="m">'+qtyLine(r)+'</span></div>';});
  });
  $('estRows').innerHTML=h;
  let t='<div class="totals">';
  t+='<div class="trow dim"><span>Your cost</span><span>'+money(E.costSum)+'</span></div>';
  t+='<div class="trow dim"><span>Markup '+S.meta.markup+'%</span><span>'+money(E.markupAmt)+'</span></div>';
  if(E.custom.length)t+='<div class="trow dim"><span>Added items</span><span>'+money(E.customSum)+'</span></div>';
  t+='<div class="trow"><span>Subtotal</span><span>'+money(E.subtotal)+'</span></div>';
  if(S.meta.tax>0)t+='<div class="trow"><span>Tax '+S.meta.tax+'%</span><span>'+money(E.tax)+'</span></div>';
  t+='<div class="trow big"><span>Total</span><span>'+money(E.total)+'</span></div></div>';
  $('estTotals').innerHTML=t;
  const so=getSel();
  if(!so)renderInspector();else updatePriceReadout(so);
}
function renderCustom(){
  $('customList').innerHTML=S.custom.map((c,i)=>'<div class="crow" data-ci="'+i+'"><input class="nm" type="text" maxlength="80" data-k="name" value="'+esc(c.name)+'" placeholder="Description (irrigation, soil, design fee)" aria-label="Description"><input type="number" min="0" step="1" data-k="qty" value="'+c.qty+'" aria-label="Quantity"><input type="number" min="0" step="0.01" data-k="price" value="'+c.price+'" aria-label="Price each"><button class="btn sm" data-del="'+i+'" aria-label="Remove item">&times;</button></div>').join('');
}
$('customList').addEventListener('input',e=>{
  const row=e.target.closest('[data-ci]');if(!row)return;const c=S.custom[+row.dataset.ci],k=e.target.dataset.k;if(!c||!k)return;
  if(k==='name')c.name=e.target.value.slice(0,80);else c[k]=num(e.target.value,0,0,1e7);
  updateEstimate();
});
$('customList').addEventListener('change',()=>commit());
$('customList').addEventListener('click',e=>{
  const b=e.target.closest('[data-del]');if(!b)return;
  S.custom.splice(+b.dataset.del,1);renderCustom();updateEstimate();commit();
});
$('addCustom').addEventListener('click',()=>{
  if(S.custom.length>=40){toast('That is the maximum number of added items.');return;}
  S.custom.push({id:uid(),name:'',qty:1,unit:'',price:0});renderCustom();updateEstimate();
  const rows=$('customList').querySelectorAll('.nm');if(rows.length)rows[rows.length-1].focus();
});
$('inMarkup').addEventListener('input',e=>{if(e.target.value==='')return;S.meta.markup=num(e.target.value,20,0,300);updateEstimate();});
$('inTax').addEventListener('input',e=>{if(e.target.value==='')return;S.meta.tax=num(e.target.value,0,0,30);updateEstimate();});
$('inMarkup').addEventListener('change',()=>commit());
$('inTax').addEventListener('change',()=>commit());

/* ---- prices tab ---- */
let resetArmed=false;
function renderPrices(){
  let h='<p class="help">Your installed cost per unit (materials and labor). These are starter numbers. Edit them to match your suppliers and crew rates.</p>';
  GROUPS.forEach(g=>{
    const items=CATALOG.filter(c=>c.group===g.id&&!c.excluded);if(!items.length)return;
    h+='<h3 class="sect">'+esc(g.name)+'</h3>';
    items.forEach(c=>{h+='<label class="prow"><span>'+esc(c.name)+'</span><span class="pin"><span class="u">$</span><input type="number" min="0" step="0.01" data-pc="'+c.id+'" value="'+unitCostOf(S,c)+'" aria-label="Price for '+esc(c.name)+'"><span class="u">/'+c.unit+'</span></span></label>';});
  });
  h+='<div class="btnrow" style="margin-top:14px"><button class="btn" id="btnResetPrices">'+(resetArmed?'Click again to reset all':'Reset to starter prices')+'</button></div>';
  $('tabPrices').innerHTML=h;
}
$('tabPrices').addEventListener('input',e=>{
  const id=e.target.dataset.pc;if(!id||e.target.value==='')return;
  const v=Number(e.target.value);if(!isFinite(v)||v<0)return;
  if(v===CAT[id].price)delete S.prices[id];else S.prices[id]=v;
  updateEstimate();renderLib();
});
$('tabPrices').addEventListener('change',e=>{if(e.target.dataset.pc)commit();});
$('tabPrices').addEventListener('click',e=>{
  if(!e.target.closest('#btnResetPrices'))return;
  if(!resetArmed){resetArmed=true;renderPrices();setTimeout(()=>{if(resetArmed){resetArmed=false;if(rtab==='prices')renderPrices();}},4000);return;}
  resetArmed=false;S.prices={};renderPrices();renderLib();updateEstimate();commit();toast('Prices reset to the starter list.');
});

/* ---- status + context bar ---- */
function updateStatus(extra){
  let t;
  if(extra)t=extra;
  else if(tool.mode==='place')t='Placing '+CAT[tool.cat].name+'. Click the ground.';
  else if(tool.mode==='draw')t='Drawing '+CAT[tool.cat].name+'.';
  else{
    const o=getSel(),n=S.objects.length;
    t=o?CAT[o.cat].name+' selected':n+' item'+(n===1?'':'s')+' · lot '+S.lot.w+' × '+S.lot.d+' ft ('+Math.round(S.lot.w*S.lot.d).toLocaleString('en-US')+' sf)';
  }
  $('status').textContent=t;
}
function updateCtx(){
  const el=$('ctxbar');
  if(tool.mode==='select'){el.hidden=true;return;}
  const c=CAT[tool.cat];let h='';
  if(tool.mode==='place'){
    h='<span class="tx"><b>'+esc(c.name)+'</b> · click to place · <kbd>[</kbd><kbd>]</kbd> rotate</span><button class="btn sm primary" data-act="done">Done</button>';
  }else{
    const free=c.kind==='line'||tool.shape==='free';
    if(c.kind==='area')h+='<div class="seg"><button data-act="rect" aria-pressed="'+(tool.shape==='rect')+'">Rectangle</button><button data-act="free" aria-pressed="'+(tool.shape==='free')+'">Freeform</button></div>';
    const hint=!free?(tool.rect?'Click the opposite corner':'Click one corner'):(tool.pts.length?'Click to add points':'Click to start');
    h+='<span class="tx"><b>'+esc(c.name)+'</b> · '+hint+'</span>';
    if(free)h+='<button class="btn sm primary" data-act="finish">Finish</button>';
    h+='<button class="btn sm" data-act="undopt">Undo point</button><button class="btn sm" data-act="cancel">Cancel</button>';
  }
  el.innerHTML=h;el.hidden=false;
}
$('ctxbar').addEventListener('click',e=>{
  const b=e.target.closest('[data-act]');if(!b)return;const a=b.dataset.act;
  if(a==='done'||a==='cancel')setTool({mode:'select'});
  else if(a==='rect'||a==='free'){tool.shape=a;tool.pts=[];tool.rect=null;clearPreview();updateCtx();}
  else if(a==='finish')finishDraw();
  else if(a==='undopt'){if(tool.rect)tool.rect=null;else tool.pts.pop();updatePreview(lastHover);updateCtx();}
});

/* ---- tools: ghost, preview, placement, drawing ---- */
let ghost=null,lastHover=null,tabRot=0;
function clearGhost(){if(ghost){ghostGroup.remove(ghost);disposeTree(ghost);ghost=null;}}
function makeGhost(c){
  clearGhost();
  ghost=buildPoint({id:'ghost',cat:c.id,x:0,z:0,rot:tool.rot||0,scale:1,count:1},0);
  ghost.traverse(n=>{if(n.isMesh){n.material=n.material.clone();n.material.transparent=true;n.material.opacity=0.55;n.castShadow=false;n.userData.ownMat=true;}});
  ghost.visible=false;ghostGroup.add(ghost);
}
function startCatTool(id){
  const c=CAT[id];if(view==='render')setView('plan',true);
  if(c.kind==='point')setTool({mode:'place',cat:id,rot:0});
  else setTool({mode:'draw',cat:id,pts:[],rect:null,shape:c.kind==='area'?'rect':'free'});
  if(isMobile())toast(c.kind==='point'?'Tap the canvas to place it.':'Tap the canvas to draw it.');
}
function setTool(t){
  cancelDraw();clearGhost();tool=t;
  if(t.mode==='place')makeGhost(CAT[t.cat]);
  if(t.mode!=='select'&&selId){selId=null;buildSelection();renderInspector();}
  applyMouseButtons();updateCtx();renderLib();
  $('toolSelect').setAttribute('aria-pressed',String(t.mode==='select'));
  cv.style.cursor=t.mode==='select'?'default':'crosshair';
  updateStatus();
}
function clearPreview(){clearGroup(previewGroup);invalidate();}
function cancelDraw(){if(tool.mode==='draw'){tool.pts=[];tool.rect=null;}clearPreview();lastHover=null;}
function measureText(pts,closed){
  if(closed)return pts.length>=3?'Area '+Math.round(polyArea(pts)).toLocaleString('en-US')+' sf · perimeter '+Math.round(polyPerim(pts))+' lf':'';
  return pts.length>=2?'Length '+r1(polyLen(pts))+' lf':'';
}
function updatePreview(cur){
  clearGroup(previewGroup);if(tool.mode!=='draw'){invalidate();return;}
  const c=CAT[tool.cat];let pts=[],closed=c.kind==='area',stat='';
  if(c.kind==='area'&&tool.shape==='rect'){
    if(tool.rect&&cur){const a=tool.rect;pts=[[a.x,a.z],[cur.x,a.z],[cur.x,cur.z],[a.x,cur.z]];stat=Math.round(Math.abs(cur.x-a.x)*10)/10+' × '+Math.round(Math.abs(cur.z-a.z)*10)/10+' ft · '+measureText(pts,true);}
  }else{
    pts=tool.pts.map(p=>p.slice());if(cur)pts.push([cur.x,cur.z]);stat=measureText(pts,closed);
  }
  const y=0.5;
  if(pts.length>=2){
    const v=pts.map(p=>new THREE.Vector3(p[0],y,p[1]));if(closed&&pts.length>2)v.push(v[0].clone());
    const ln=new THREE.Line(new THREE.BufferGeometry().setFromPoints(v),new THREE.LineBasicMaterial({color:lin(AMBER),depthTest:false,transparent:true,toneMapped:false}));ln.renderOrder=999;ln.userData.ownMat=true;previewGroup.add(ln);
  }
  const dots=(tool.shape==='rect'&&c.kind==='area')?(tool.rect?[[tool.rect.x,tool.rect.z]]:[]):tool.pts;
  if(dots.length){
    const g=new THREE.BufferGeometry().setFromPoints(dots.map(p=>new THREE.Vector3(p[0],y,p[1])));
    const pt=new THREE.Points(g,new THREE.PointsMaterial({color:lin(AMBER),size:9,sizeAttenuation:false,depthTest:false,transparent:true,toneMapped:false}));pt.renderOrder=999;pt.userData.ownMat=true;previewGroup.add(pt);
  }
  updateStatus(stat||undefined);invalidate();
}
function snapv(v){return S.snap?Math.round(v/S.snap)*S.snap:v;}
function snapPt(gp,magnet,skipId){
  let x=snapv(gp.x),z=snapv(gp.z);
  if(magnet){
    let best=null,bd=0.9;
    const test=(px,pz)=>{const d=Math.hypot(px-gp.x,pz-gp.z);if(d<bd){bd=d;best=[px,pz];}};
    S.objects.forEach(o=>{if(o.pts&&o.id!==skipId)o.pts.forEach(p=>test(p[0],p[1]));});
    const w=S.lot.w/2,d=S.lot.d/2;[[-w,-d],[w,-d],[w,d],[-w,d]].forEach(p=>test(p[0],p[1]));
    if(best){x=best[0];z=best[1];}
    else{if(Math.abs(Math.abs(gp.x)-w)<0.6)x=Math.sign(gp.x)*w;if(Math.abs(Math.abs(gp.z)-d)<0.6)z=Math.sign(gp.z)*d;}
  }
  return{x,z};
}
function placeAt(p){
  const c=CAT[tool.cat],o={id:uid(),cat:c.id,x:p.x,z:p.z,rot:tool.rot||0,scale:1,count:1,label:'',price:null,note:''};
  S.objects.push(o);rebuildObject(o);refreshLabels();updateEstimate();updateStatus();commit();
}
let lastClickT=0,lastClickX=0,lastClickY=0;
function drawClick(p,e){
  const c=CAT[tool.cat];
  if(c.kind==='area'&&tool.shape==='rect'){
    if(!tool.rect){tool.rect={x:p.x,z:p.z};}
    else{
      const a=tool.rect;
      if(Math.abs(p.x-a.x)<1||Math.abs(p.z-a.z)<1){toast('Make the shape at least 1 ft across.');return;}
      finishShape([[a.x,a.z],[p.x,a.z],[p.x,p.z],[a.x,p.z]]);return;
    }
  }else{
    const now=performance.now(),dbl=now-lastClickT<350&&Math.hypot(e.clientX-lastClickX,e.clientY-lastClickY)<8;
    lastClickT=now;lastClickX=e.clientX;lastClickY=e.clientY;
    if(dbl){finishDraw();return;}
    const first=tool.pts[0];
    if(c.kind==='area'&&tool.pts.length>=3&&Math.hypot(p.x-first[0],p.z-first[1])<1.5){finishDraw();return;}
    const last=tool.pts[tool.pts.length-1];if(last&&Math.hypot(last[0]-p.x,last[1]-p.z)<0.05)return;
    tool.pts.push([p.x,p.z]);
  }
  updatePreview(p);updateCtx();
}
function finishDraw(){
  if(tool.mode!=='draw')return;const c=CAT[tool.cat];
  if(c.kind==='area'&&tool.shape==='rect'){toast('Click two opposite corners to make a rectangle.');return;}
  const need=c.kind==='area'?3:2;
  if(tool.pts.length<need){toast(c.kind==='area'?'Add at least three points.':'Add at least two points.');return;}
  finishShape(tool.pts.map(p=>p.slice()));
}
function finishShape(pts){
  const c=CAT[tool.cat],o={id:uid(),cat:c.id,pts,height:null,label:'',price:null,note:''};
  S.objects.push(o);setTool({mode:'select'});rebuildAll();select(o.id);updateEstimate();commit();
}

/* ---- pointer interaction ---- */
const raycaster=new THREE.Raycaster(),ndc=new THREE.Vector2(),groundPlane=new THREE.Plane(new THREE.Vector3(0,1,0),0);
function setRay(e){const r=cv.getBoundingClientRect();ndc.set(((e.clientX-r.left)/r.width)*2-1,-((e.clientY-r.top)/r.height)*2+1);raycaster.setFromCamera(ndc,camera);}
function getGround(e){setRay(e);const p=new THREE.Vector3();if(!raycaster.ray.intersectPlane(groundPlane,p))return null;p.x=Math.max(-600,Math.min(600,p.x));p.z=Math.max(-600,Math.min(600,p.z));return p;}
function pickObj(e){setRay(e);const hits=raycaster.intersectObjects(objectGroup.children,true);for(let i=0;i<hits.length;i++){const id=hits[i].object.userData.objId;if(id)return id;}return null;}
function pickHandle(e){if(!handleGroup.children.length)return null;setRay(e);const hits=raycaster.intersectObjects(handleGroup.children,false);return hits.length?hits[0].object.userData.vi:null;}

let down=null;
stageEl.addEventListener('pointerdown',e=>{
  if(e.target!==cv||e.button!==0)return;
  if(down){down=null;controls.enabled=true;rebuildAll();buildSelection();return;}
  down={pid:e.pointerId,x:e.clientX,y:e.clientY,t:performance.now(),moved:false,mode:'orbit',hit:null};
  if(tool.mode!=='select')return;
  const vi=pickHandle(e);
  if(vi!=null&&getSel()){down.mode='vertex';down.vi=vi;controls.enabled=false;return;}
  const id=pickObj(e);down.hit=id;
  if(!id)return;
  const o=S.objects.find(q=>q.id===id);if(!o)return;
  const c=CAT[o.cat];
  if(c.kind==='point'||id===selId){
    const gp=getGround(e);if(!gp)return;
    down.mode='move';down.o=o;down.start=gp;controls.enabled=false;
    down.orig=c.kind==='point'?{x:o.x,z:o.z}:{pts:o.pts.map(p=>p.slice())};
    if(c.kind==='point'&&id!==selId)select(id);
  }
},true);
function dragMove(e){
  const gp=getGround(e);if(!gp||!down.start)return;
  const o=down.o,c=CAT[o.cat],m=meshes.get(o.id);if(!m)return;
  const dx=gp.x-down.start.x,dz=gp.z-down.start.z;
  if(c.kind==='point'){
    const nx=snapv(down.orig.x+dx),nz=snapv(down.orig.z+dz);m.position.x=nx;m.position.z=nz;down.cur={x:nx,z:nz};
    selGroup.position.set(nx-o.x,0,nz-o.z);
    const fx=$('tabInspect').querySelector('[data-f="x"]'),fz=$('tabInspect').querySelector('[data-f="z"]');
    if(fx&&fz){fx.value=r1(nx+S.lot.w/2);fz.value=r1(nz+S.lot.d/2);}
  }else{
    const sx=snapv(dx),sz=snapv(dz);m.position.x=sx;m.position.z=sz;down.cur={dx:sx,dz:sz};selGroup.position.set(sx,0,sz);
  }
  handleGroup.position.copy(selGroup.position);invalidate();
}
function dragVertex(e){
  const o=getSel();if(!o)return;const gp=getGround(e);if(!gp)return;
  const p=snapPt(gp,true,o.id);o.pts[down.vi]=[p.x,p.z];rebuildObject(o);buildSelection();updateReadouts(o);
}
window.addEventListener('pointermove',e=>{
  if(down&&e.pointerId===down.pid){
    if(Math.hypot(e.clientX-down.x,e.clientY-down.y)>4)down.moved=true;
    if(down.moved){if(down.mode==='move')dragMove(e);else if(down.mode==='vertex')dragVertex(e);}
    return;
  }
  if(e.target!==cv)return;
  if(tool.mode==='place'||tool.mode==='draw'){
    const gp=getGround(e);if(!gp)return;const p=snapPt(gp,tool.mode==='draw');lastHover=p;
    if(tool.mode==='place'&&ghost){ghost.position.set(p.x,elevAt(p.x,p.z),p.z);ghost.visible=true;invalidate();}
    else if(tool.mode==='draw')updatePreview(p);
  }else if(tool.mode==='select'&&e.buttons===0){
    cv.style.cursor=pickHandle(e)!=null?'grab':(pickObj(e)?'pointer':'default');
  }
});
cv.addEventListener('pointerleave',()=>{if(ghost){ghost.visible=false;invalidate();}});
window.addEventListener('pointerup',e=>{
  if(!down||e.pointerId!==down.pid)return;
  const d=down;down=null;controls.enabled=true;
  if(d.mode==='move'&&d.moved&&d.cur){
    const o=d.o,c=CAT[o.cat];
    if(c.kind==='point'){o.x=d.cur.x;o.z=d.cur.z;}else o.pts=d.orig.pts.map(p=>[p[0]+d.cur.dx,p[1]+d.cur.dz]);
    rebuildAll();buildSelection();renderInspector();updateEstimate();commit();return;
  }
  if(d.mode==='vertex'&&d.moved){rebuildAll();buildSelection();renderInspector();updateEstimate();commit();return;}
  if(d.moved||performance.now()-d.t>700||d.mode==='vertex')return;
  if(tool.mode==='select'){select(d.hit||null);return;}
  const gp=getGround(e);if(!gp)return;
  if(tool.mode==='place')placeAt(snapPt(gp,false));
  else if(tool.mode==='draw')drawClick(snapPt(gp,true),e);
});
window.addEventListener('pointercancel',e=>{
  if(!down||e.pointerId!==down.pid)return;
  down=null;controls.enabled=true;rebuildAll();buildSelection();
});
stageEl.addEventListener('contextmenu',e=>e.preventDefault());

/* ---- view / overlay controls ---- */
$('viewSeg').addEventListener('click',e=>{const b=e.target.closest('[data-view]');if(b)setView(b.dataset.view);});
$('tgGrid').addEventListener('click',e=>{ui.grid=!ui.grid;e.currentTarget.setAttribute('aria-pressed',String(ui.grid));if(gridMesh)gridMesh.visible=ui.grid;invalidate();});
$('tgLabels').addEventListener('click',e=>{ui.labels=!ui.labels;e.currentTarget.setAttribute('aria-pressed',String(ui.labels));labelGroup.visible=ui.labels;invalidate();});
$('tgShadow').addEventListener('click',e=>{ui.shadows=!ui.shadows;e.currentTarget.setAttribute('aria-pressed',String(ui.shadows));sun.castShadow=ui.shadows;refreshMaterials();invalidate();});
$('sunMonth').addEventListener('change',e=>{S.sun.month=Math.round(num(e.target.value,6,1,12));applySun();commit();});
$('sunHour').addEventListener('input',e=>{S.sun.hour=num(e.target.value,16,5,21);applySun();});
$('sunHour').addEventListener('change',()=>commit());
$('lotW').addEventListener('change',e=>{S.lot.w=num(e.target.value,60,10,400);e.target.value=S.lot.w;lotChanged();});
$('lotD').addEventListener('change',e=>{S.lot.d=num(e.target.value,40,10,400);e.target.value=S.lot.d;lotChanged();});
$('latIn').addEventListener('change',e=>{S.lot.lat=num(e.target.value,45,0,70);e.target.value=S.lot.lat;applySun();commit();});
$('snapSel').addEventListener('change',e=>{S.snap=Number(e.target.value);commit();});
function lotChanged(){buildLot();refreshLabels();setView(view,true);updateStatus();renderInspector();commit();}
$('pname').addEventListener('input',e=>{S.meta.name=e.target.value.slice(0,80);});
$('pname').addEventListener('change',e=>{if(!S.meta.name.trim()){S.meta.name='Untitled project';e.target.value=S.meta.name;}commit();});
$('undoBtn').addEventListener('click',undo);
$('redoBtn').addEventListener('click',redo);

/* ---- keyboard ---- */
window.addEventListener('keydown',e=>{
  const tg=e.target,typing=tg&&/^(INPUT|TEXTAREA|SELECT)$/.test(tg.tagName);
  if(propOpen){if(e.key==='Escape')closeProposal();return;}
  if(e.key==='Escape'){
    if(!$('projMenu').hidden){closeMenu();return;}
    if(!$('lookMenu').hidden){closeLookMenu();return;}
    if(tool.mode==='draw'&&(tool.pts.length||tool.rect)){cancelDraw();updateCtx();updateStatus();}
    else if(tool.mode!=='select')setTool({mode:'select'});
    else if(typing)tg.blur();
    else select(null);
    return;
  }
  if(typing)return;
  const mod=e.ctrlKey||e.metaKey,k=e.key.toLowerCase();
  if(mod&&k==='z'){e.preventDefault();if(e.shiftKey)redo();else undo();return;}
  if(mod&&k==='y'){e.preventDefault();redo();return;}
  if(mod)return;
  if(e.key==='Enter'&&tool.mode==='draw'){e.preventDefault();finishDraw();return;}
  if((e.key==='Delete'||e.key==='Backspace')&&selId){e.preventDefault();deleteSel();return;}
  if(e.key==='['||e.key===']'){
    const s=e.key==='['?-15:15;
    if(tool.mode==='place'){tool.rot=((tool.rot||0)+s+360)%360;if(ghost)ghost.rotation.y=-tool.rot*Math.PI/180;invalidate();}
    else rotateSel(s);
    return;
  }
  if(k==='v'&&tool.mode!=='select'){setTool({mode:'select'});return;}
  if(selId&&/^Arrow/.test(e.key)){
    e.preventDefault();const st=S.snap||0.5;
    nudgeSel(e.key==='ArrowLeft'?-st:e.key==='ArrowRight'?st:0,e.key==='ArrowUp'?-st:e.key==='ArrowDown'?st:0);
  }
});
/* ===== Plotline: render look (sketch / standard / realistic) ===== */
function fxHtml(){
  const sup=fxSupported(),nm={full:'Full',light:'Light',off:'Off'},ds={full:'Adds ambient occlusion. Looks best, uses the most power.',light:'Soft light, bloom and filmic colour. Easy on laptops (default).',off:'Plain realistic look. Fastest.'};
  return '<div class="fxbox"><div class="fxh">Realistic effects</div><div class="fxseg" role="group" aria-label="Effects quality">'
    +['full','light','off'].map(m=>'<button type="button" data-fx="'+m+'" aria-pressed="'+(FX.mode===m)+'"'+(!sup&&m!=='off'?' disabled':'')+'>'+nm[m]+'</button>').join('')
    +'</div><span class="fxd">'+(sup?ds[FX.mode]:'This device cannot run the extra effects.')+'</span>'
    +'<label class="fxchk"><input type="checkbox" data-wind'+(FX.wind?' checked':'')+'> Moving foliage and clouds (uses more power)</label></div>';
}
function renderLookMenu(){
  $('lookMenu').innerHTML=LOOKS.map((l,i)=>'<button data-l="'+i+'" aria-pressed="'+(i===Q)+'"><b>'+l.name+'</b><span>'+l.desc+'</span></button>').join('')+(Q===2?fxHtml():'');
  $('lookTxt').textContent=LOOKS[Q].name;
}
function closeLookMenu(){$('lookMenu').hidden=true;$('lookBtn').setAttribute('aria-expanded','false');}
function applyLook(n){
  Q=[0,1,2].includes(n)?n:1;
  try{applyRenderMode();}
  catch(err){Q=1;applyRenderMode();if(S)S.look=1;toast('The realistic look is not supported on this device.');}
  renderLookMenu();
}
function setLook(n){
  if(n===Q)return;
  S.look=n;applyLook(n);
  buildLot();rebuildAll();applySun();buildSelection();refreshMaterials();
  if(tool.mode==='place')makeGhost(CAT[tool.cat]);
  if(tool.mode==='draw')updatePreview(lastHover);
  renderLookMenu();commit();invalidate();
}
$('lookBtn').addEventListener('click',()=>{
  const open=$('lookMenu').hidden;$('lookMenu').hidden=!open;$('lookBtn').setAttribute('aria-expanded',String(open));
});
$('lookMenu').addEventListener('click',e=>{
  const f=e.target.closest('[data-fx]');if(f){setFxMode(f.dataset.fx);return;}
  const b=e.target.closest('[data-l]');if(!b)return;
  closeLookMenu();setLook(+b.dataset.l);
});
$('lookMenu').addEventListener('change',e=>{if(e.target.matches('[data-wind]'))setWind(e.target.checked);});
document.addEventListener('click',e=>{if(!$('lookMenu').hidden&&!e.composedPath().includes($('lookWrap')))closeLookMenu();});
/* ===== Plotline: realistic post-processing (HDR, ambient occlusion, bloom, tone map, FXAA) ===== */
const FX={mode:'light',wind:false,active:false,ok:null,auto:!/noauto/.test(location.search),still:/still/.test(location.search)};
(function(){
  try{
    const m=localStorage.getItem('plotline.fx');if(m==='full'||m==='light'||m==='off')FX.mode=m;
    const w=localStorage.getItem('plotline.wind');if(w==='1')FX.wind=true;
  }catch(e){}
  if(window.matchMedia&&matchMedia('(prefers-reduced-motion: reduce)').matches)FX.wind=false;
})();
function fxSave(){try{localStorage.setItem('plotline.fx',FX.mode);localStorage.setItem('plotline.wind',FX.wind?'1':'0');}catch(e){}}
function fxSupported(){
  if(FX.ok===null){
    try{FX.ok=!!(renderer.capabilities.isWebGL2&&renderer.extensions.has('EXT_color_buffer_float'));}catch(e){FX.ok=false;}
  }
  return FX.ok;
}
function fxWanted(){return Q===2&&FX.mode!=='off'&&fxSupported();}
function fxPR(){return FX.active?(FX.mode==='full'?1.25:1):2;}

const POST=(function(){
  const U={sd:{value:null},sr:{value:new THREE.Vector2(1,1)},su:{value:0},sn:{value:1},sf:{value:1500}};
  const qScene=new THREE.Scene(),qCam=new THREE.OrthographicCamera(-1,1,1,-1,0,1),qg=new THREE.BufferGeometry();
  qg.setAttribute('position',new THREE.Float32BufferAttribute([-1,-1,0,3,-1,0,-1,3,0],3));
  qg.setAttribute('uv',new THREE.Float32BufferAttribute([0,0,2,0,0,2],2));
  const quad=new THREE.Mesh(qg,null);quad.frustumCulled=false;qScene.add(quad);
  const VS='varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position.xy,0.0,1.0);}';
  const v2=(x,y)=>new THREE.Vector2(x,y);
  function sm(fs,u){return new THREE.ShaderMaterial({uniforms:u,vertexShader:VS,fragmentShader:fs,depthTest:false,depthWrite:false});}
  const DEPTH='float vz(vec2 uv){float d=texture2D(tDepth,uv).x;return (near*far)/((far-near)*d-far);}';

  /* --- screen-space ambient occlusion from the depth buffer (two radii: contact + broad) --- */
  const mAO=sm('uniform sampler2D tDepth;uniform vec2 tanH;uniform vec2 px;uniform float near;uniform float far;uniform float r1;uniform float r2;uniform float k;varying vec2 vUv;'
  +DEPTH
  +'vec3 vp(vec2 uv){float z=vz(uv);return vec3((uv*2.0-1.0)*tanH*(-z),z);}'
  +'float ign(vec2 p){return fract(52.9829189*fract(dot(p,vec2(0.06711056,0.00583715))));}'
  +'float occl(vec3 P,vec3 T,vec3 B,vec3 N,float rot,float radius){float o=0.0;'
  +'for(int i=0;i<8;i++){float fi=float(i)+0.5;float a=fi*2.39996323+rot;float h=fi/8.0;float s=sqrt(max(0.0,1.0-h*h));'
  +'vec3 S=P+(T*cos(a)*s+B*sin(a)*s+N*h)*radius*(0.25+0.75*h);'
  +'vec2 suv=(S.xy/(-S.z))/tanH*0.5+0.5;float sz=vz(suv);float diff=sz-S.z;'
  +'float rc=smoothstep(0.0,1.0,radius/max(0.001,abs(P.z-sz)));'
  +'o+=(diff>0.04+(-P.z)*0.0025?1.0:0.0)*rc;}return o/8.0;}'
  +'void main(){float d0=texture2D(tDepth,vUv).x;if(d0>=0.99999){gl_FragColor=vec4(1.0);return;}'
  +'vec3 P=vp(vUv);vec3 pl=vp(vUv-vec2(px.x,0.0)),pr=vp(vUv+vec2(px.x,0.0)),pd=vp(vUv-vec2(0.0,px.y)),pu=vp(vUv+vec2(0.0,px.y));'
  +'vec3 dx=abs(pr.z-P.z)<abs(pl.z-P.z)?pr-P:P-pl;vec3 dy=abs(pu.z-P.z)<abs(pd.z-P.z)?pu-P:P-pd;'
  +'vec3 N=normalize(cross(dx,dy));if(dot(N,-P)<0.0)N=-N;'
  +'vec3 T=normalize(abs(N.y)<0.99?cross(N,vec3(0.0,1.0,0.0)):cross(N,vec3(1.0,0.0,0.0)));vec3 B=cross(N,T);'
  +'float rot=ign(gl_FragCoord.xy)*6.2831853;'
  +'float o1=occl(P,T,B,N,rot,r1),o2=occl(P,T,B,N,rot+1.7,r2);'
  +'float ao=(1.0-o1)*(1.0-0.5*o2);gl_FragColor=vec4(vec3(pow(clamp(ao,0.0,1.0),k)),1.0);}',
  {tDepth:{value:null},tanH:{value:v2(1,1)},px:{value:v2(1,1)},near:{value:1},far:{value:1500},r1:{value:1.6},r2:{value:7},k:{value:1.05}});
  const mBlur=sm('uniform sampler2D tAO;uniform sampler2D tDepth;uniform vec2 dir;uniform float near;uniform float far;varying vec2 vUv;'
  +DEPTH
  +'void main(){float z0=vz(vUv);float sum=texture2D(tAO,vUv).x;float ws=1.0;'
  +'for(int i=1;i<=4;i++){float fi=float(i);float g=exp(-fi*fi/6.0);'
  +'vec2 o=dir*fi;float za=vz(vUv+o),zb=vz(vUv-o);float tol=abs(z0)*0.06+0.4;'
  +'float wa=g*exp(-abs(za-z0)/tol*3.0),wb=g*exp(-abs(zb-z0)/tol*3.0);'
  +'sum+=texture2D(tAO,vUv+o).x*wa+texture2D(tAO,vUv-o).x*wb;ws+=wa+wb;}'
  +'gl_FragColor=vec4(vec3(sum/ws),1.0);}',
  {tAO:{value:null},tDepth:{value:null},dir:{value:v2(1,0)},near:{value:1},far:{value:1500}});

  /* --- bloom: bright-pass, dual-filter down and up --- */
  const mPre=sm('uniform sampler2D tex;uniform vec2 px;uniform float thr;varying vec2 vUv;'
  +'vec3 pf(vec3 c){float br=max(c.r,max(c.g,c.b));float kn=thr*0.5+0.0001;float s=clamp(br-thr+kn,0.0,2.0*kn);s=s*s/(4.0*kn);float w=max(s,br-thr)/max(br,0.0001);return min(c*max(w,0.0),vec3(24.0));}'
  +'void main(){vec3 c=pf(texture2D(tex,vUv+px*vec2(-0.5,-0.5)).rgb)+pf(texture2D(tex,vUv+px*vec2(0.5,-0.5)).rgb)+pf(texture2D(tex,vUv+px*vec2(-0.5,0.5)).rgb)+pf(texture2D(tex,vUv+px*vec2(0.5,0.5)).rgb);gl_FragColor=vec4(c*0.25,1.0);}',
  {tex:{value:null},px:{value:v2(1,1)},thr:{value:1}});
  const mDown=sm('uniform sampler2D tex;uniform vec2 px;varying vec2 vUv;'
  +'void main(){vec3 c=texture2D(tex,vUv).rgb*4.0;c+=texture2D(tex,vUv+px*vec2(-1.0,-1.0)).rgb+texture2D(tex,vUv+px*vec2(1.0,-1.0)).rgb+texture2D(tex,vUv+px*vec2(-1.0,1.0)).rgb+texture2D(tex,vUv+px*vec2(1.0,1.0)).rgb;gl_FragColor=vec4(c/8.0,1.0);}',
  {tex:{value:null},px:{value:v2(1,1)}});
  const mUp=sm('uniform sampler2D tA;uniform sampler2D tB;uniform vec2 px;varying vec2 vUv;'
  +'void main(){vec3 c=texture2D(tB,vUv+px*vec2(-2.0,0.0)).rgb+texture2D(tB,vUv+px*vec2(2.0,0.0)).rgb+texture2D(tB,vUv+px*vec2(0.0,-2.0)).rgb+texture2D(tB,vUv+px*vec2(0.0,2.0)).rgb'
  +'+2.0*(texture2D(tB,vUv+px*vec2(-1.0,-1.0)).rgb+texture2D(tB,vUv+px*vec2(1.0,-1.0)).rgb+texture2D(tB,vUv+px*vec2(-1.0,1.0)).rgb+texture2D(tB,vUv+px*vec2(1.0,1.0)).rgb);'
  +'gl_FragColor=vec4(texture2D(tA,vUv).rgb+c/12.0,1.0);}',
  {tA:{value:null},tB:{value:null},px:{value:v2(1,1)}});

  /* --- composite: AO, bloom, ACES filmic tone map, grade, vignette, dither --- */
  const mComp=sm('uniform sampler2D tScene;uniform sampler2D tAO;uniform sampler2D tBloom;uniform float exposure;uniform float aoK;uniform float bloomK;uniform float vig;uniform float hasAO;uniform float hasBloom;varying vec2 vUv;'
  +'const mat3 AIN=mat3(vec3(0.59719,0.07600,0.02840),vec3(0.35458,0.90834,0.13383),vec3(0.04823,0.01566,0.83777));'
  +'const mat3 AOUT=mat3(vec3(1.60475,-0.10208,-0.00327),vec3(-0.53108,1.10813,-0.07276),vec3(-0.07367,-0.00605,1.07602));'
  +'vec3 fit(vec3 v){vec3 a=v*(v+0.0245786)-0.000090537;vec3 b=v*(0.983729*v+0.4329510)+0.238081;return a/b;}'
  +'vec3 aces(vec3 c){c*=exposure/0.6;c=AIN*c;c=fit(c);c=AOUT*c;return clamp(c,0.0,1.0);}'
  +'vec3 enc(vec3 c){return mix(c*12.92,1.055*pow(c,vec3(1.0/2.4))-0.055,step(vec3(0.0031308),c));}'
  +'float ign(vec2 p){return fract(52.9829189*fract(dot(p,vec2(0.06711056,0.00583715))));}'
  +'void main(){vec3 c=texture2D(tScene,vUv).rgb;float L=dot(c,vec3(0.2126,0.7152,0.0722));'
  +'if(hasAO>0.5){float ao=texture2D(tAO,vUv).x;c*=mix(1.0,ao,aoK*(1.0-0.45*smoothstep(0.9,4.0,L)));}'
  +'if(hasBloom>0.5)c+=texture2D(tBloom,vUv).rgb*bloomK;'
  +'c=aces(c);float l=dot(c,vec3(0.2126,0.7152,0.0722));c=mix(vec3(l),c,1.07);c=enc(c);'
  +'vec2 q=vUv-0.5;c*=1.0-vig*dot(q,q)*1.7;c+=(ign(gl_FragCoord.xy)-0.5)/255.0;gl_FragColor=vec4(c,1.0);}',
  {tScene:{value:null},tAO:{value:null},tBloom:{value:null},exposure:{value:1},aoK:{value:0.72},bloomK:{value:0.16},vig:{value:0.22},hasAO:{value:0},hasBloom:{value:0}});

  /* --- FXAA (luma edge blur) to the screen --- */
  const mAA=sm('uniform sampler2D tex;uniform vec2 px;varying vec2 vUv;'
  +'void main(){vec3 rgbNW=texture2D(tex,vUv+vec2(-1.0,-1.0)*px).rgb,rgbNE=texture2D(tex,vUv+vec2(1.0,-1.0)*px).rgb,rgbSW=texture2D(tex,vUv+vec2(-1.0,1.0)*px).rgb,rgbSE=texture2D(tex,vUv+vec2(1.0,1.0)*px).rgb,rgbM=texture2D(tex,vUv).rgb;'
  +'vec3 lm=vec3(0.299,0.587,0.114);float lNW=dot(rgbNW,lm),lNE=dot(rgbNE,lm),lSW=dot(rgbSW,lm),lSE=dot(rgbSE,lm),lM=dot(rgbM,lm);'
  +'float lmin=min(lM,min(min(lNW,lNE),min(lSW,lSE))),lmax=max(lM,max(max(lNW,lNE),max(lSW,lSE)));'
  +'vec2 dir=vec2(-((lNW+lNE)-(lSW+lSE)),((lNW+lSW)-(lNE+lSE)));'
  +'float dr=max((lNW+lNE+lSW+lSE)*0.03125,0.0078125);float rcp=1.0/(min(abs(dir.x),abs(dir.y))+dr);'
  +'dir=min(vec2(8.0),max(vec2(-8.0),dir*rcp))*px;'
  +'vec3 A=0.5*(texture2D(tex,vUv+dir*(1.0/3.0-0.5)).rgb+texture2D(tex,vUv+dir*(2.0/3.0-0.5)).rgb);'
  +'vec3 Bv=A*0.5+0.25*(texture2D(tex,vUv+dir*-0.5).rgb+texture2D(tex,vUv+dir*0.5).rgb);float lB=dot(Bv,lm);'
  +'gl_FragColor=vec4((lB<lmin||lB>lmax)?A:Bv,1.0);}',
  {tex:{value:null},px:{value:v2(1,1)}});

  let rtS=null,rtL=null,rtA=null,rtA2=null,bd=[],bu=[],W=0,H=0;
  const _sz=new THREE.Vector2();
  function mkRT(w,h,hf,depth){
    return new THREE.WebGLRenderTarget(Math.max(1,w|0),Math.max(1,h|0),{type:hf?THREE.HalfFloatType:THREE.UnsignedByteType,format:THREE.RGBAFormat,minFilter:THREE.LinearFilter,magFilter:THREE.LinearFilter,depthBuffer:!!depth,stencilBuffer:false});
  }
  function freeAll(){[rtS,rtL,rtA,rtA2].concat(bd,bu).forEach(t=>{if(t){if(t.depthTexture)t.depthTexture.dispose();t.dispose();}});rtS=rtL=rtA=rtA2=null;bd=[];bu=[];W=H=0;}
  function ensure(w,h){
    if(rtS&&W===w&&H===h)return;
    freeAll();W=w;H=h;
    rtS=mkRT(w,h,true,true);rtS.depthTexture=new THREE.DepthTexture(w,h,THREE.UnsignedIntType);
    rtL=mkRT(w,h,false,false);
    rtA=mkRT(w/2,h/2,false,false);rtA2=mkRT(w/2,h/2,false,false);
    let bw=w/2,bh=h/2;
    for(let i=0;i<5;i++){bd.push(mkRT(bw,bh,true,false));if(i<4)bu.push(mkRT(bw,bh,true,false));bw=Math.max(2,bw/2);bh=Math.max(2,bh/2);}
    bu.push(bd[4]);
    renderer.setRenderTarget(rtS);
    const gl=renderer.getContext();
    if(gl.checkFramebufferStatus(gl.FRAMEBUFFER)!==gl.FRAMEBUFFER_COMPLETE){renderer.setRenderTarget(null);throw new Error('hdr target incomplete');}
    renderer.setRenderTarget(null);
    U.sd.value=rtS.depthTexture;U.sr.value.set(w,h);
  }
  function pass(mat,target){quad.material=mat;renderer.setRenderTarget(target);renderer.render(qScene,qCam);}
  function lotUI(show,saved){
    if(show){lotGroup.children.forEach((c,i)=>{c.visible=saved[i];});return null;}
    const sv=lotGroup.children.map(c=>c.visible);lotGroup.children.forEach(c=>{if(c.userData.ui)c.visible=false;});return sv;
  }
  function render(opt){
    renderer.getDrawingBufferSize(_sz);const w=_sz.x|0,h=_sz.y|0;ensure(w,h);
    const full=FX.mode==='full',tanY=Math.tan(camera.fov*Math.PI/360),tanX=tanY*camera.aspect;
    const uiv=[selGroup.visible,handleGroup.visible,previewGroup.visible,labelGroup.visible];
    U.sn.value=camera.near;U.sf.value=camera.far;U.su.value=0;
    /* 1. scene into the HDR target (editor overlays are drawn later, on top) */
    const sv=lotUI(false);
    selGroup.visible=handleGroup.visible=previewGroup.visible=labelGroup.visible=false;
    renderer.setRenderTarget(rtS);renderer.render(scene,camera);
    lotUI(true,sv);
    renderer.autoClear=false;
    /* 2. ambient occlusion */
    if(full){
      const a=mAO.uniforms;a.tDepth.value=rtS.depthTexture;a.tanH.value.set(tanX,tanY);a.px.value.set(1/w,1/h);a.near.value=camera.near;a.far.value=camera.far;
      pass(mAO,rtA);
      const b=mBlur.uniforms;b.tDepth.value=rtS.depthTexture;b.near.value=camera.near;b.far.value=camera.far;
      b.tAO.value=rtA.texture;b.dir.value.set(2/rtA.width,0);pass(mBlur,rtA2);
      b.tAO.value=rtA2.texture;b.dir.value.set(0,2/rtA.height);pass(mBlur,rtA);
    }
    /* 3. bloom */
    mPre.uniforms.tex.value=rtS.texture;mPre.uniforms.px.value.set(1/w,1/h);pass(mPre,bd[0]);
    for(let i=1;i<5;i++){mDown.uniforms.tex.value=bd[i-1].texture;mDown.uniforms.px.value.set(1/bd[i-1].width,1/bd[i-1].height);pass(mDown,bd[i]);}
    for(let i=3;i>=0;i--){mUp.uniforms.tA.value=bd[i].texture;mUp.uniforms.tB.value=bu[i+1].texture;mUp.uniforms.px.value.set(1/bu[i+1].width,1/bu[i+1].height);pass(mUp,bu[i]);}
    /* 4. composite and tone map, 5. anti-alias to the screen */
    const c=mComp.uniforms;c.tScene.value=rtS.texture;c.tAO.value=rtA.texture;c.tBloom.value=bu[0].texture;
    c.hasAO.value=full?1:0;c.hasBloom.value=1;c.exposure.value=(opt&&opt.exposure)||POST.exposure;
    pass(mComp,rtL);
    mAA.uniforms.tex.value=rtL.texture;mAA.uniforms.px.value.set(1/w,1/h);pass(mAA,null);
    /* 6. editor overlays (grid, outlines, labels) straight onto the screen */
    const vis=[objectGroup.visible,ghostGroup.visible,skyMesh.visible],bg=scene.background,fg=scene.fog;
    const lv=lotGroup.children.map(x=>x.visible);
    objectGroup.visible=ghostGroup.visible=skyMesh.visible=false;
    lotGroup.children.forEach(x=>{x.visible=x.visible&&!!x.userData.ui;});
    selGroup.visible=uiv[0];handleGroup.visible=uiv[1];previewGroup.visible=uiv[2];labelGroup.visible=uiv[3];
    scene.background=null;scene.fog=null;U.su.value=1;
    renderer.setRenderTarget(null);renderer.clearDepth();renderer.render(scene,camera);
    scene.background=bg;scene.fog=fg;U.su.value=0;
    objectGroup.visible=vis[0];ghostGroup.visible=vis[1];skyMesh.visible=vis[2];lotGroup.children.forEach((x,i)=>{x.visible=lv[i];});
    renderer.autoClear=true;
  }
  return{U:U,render:render,free:freeAll,exposure:1};
})();

/* make a line/grid material hide behind scene geometry when the overlay pass draws it */
function depthClip(mat){
  mat.onBeforeCompile=function(sh){
    sh.uniforms.uSD=POST.U.sd;sh.uniforms.uSR=POST.U.sr;sh.uniforms.uSU=POST.U.su;sh.uniforms.uSN=POST.U.sn;sh.uniforms.uSF=POST.U.sf;
    sh.fragmentShader=sh.fragmentShader.replace('void main() {','uniform sampler2D uSD;uniform vec2 uSR;uniform float uSU;uniform float uSN;uniform float uSF;'
      +'float uLin(float d){return uSN*uSF/(uSF-d*(uSF-uSN));}\nvoid main() {\nif(uSU>0.5&&uLin(gl_FragCoord.z)>uLin(texture2D(uSD,gl_FragCoord.xy/uSR).x)+0.5)discard;\n');
  };
  return mat;
}

/* one entry point for drawing a frame */
function renderFrame(opt){
  if(FX.active){
    try{POST.render(opt);return;}
    catch(err){
      console.warn('Realistic effects disabled:',err&&err.message);
      FX.ok=false;renderer.autoClear=true;renderer.setRenderTarget(null);POST.U.su.value=0;
      setTimeout(fxApply,0);toast('Realistic effects are not supported on this device. Showing the basic realistic look.');
    }
  }
  renderer.render(scene,camera);
}
/* re-evaluate the effects state after a mode change or failure (rebuilds so every material matches the output path) */
function fxApply(){
  _fw.skip=16;_fw.s=[];
  applyRenderMode();if(!FX.active)POST.free();resize();
  buildLot();rebuildAll();applySun();buildSelection();refreshMaterials();
  if(tool.mode==='place')makeGhost(CAT[tool.cat]);
  if(tool.mode==='draw')updatePreview(lastHover);
  renderLookMenu();invalidate();
}
function setFxMode(m,nosave){
  if(m===FX.mode)return;
  const was=FX.active;FX.mode=m;if(!nosave)fxSave();
  if(Q===2&&was!==fxWanted())fxApply();
  else{if(Q===2)resize();renderLookMenu();invalidate();}
}
function setWind(on){FX.wind=!!on;fxSave();if(!on)WIND.t.value=0;renderLookMenu();invalidate();}

/* step the effects down if frames take too long: every few frames, read one pixel back (which waits for the GPU) and time that frame */
const _fw={i:0,skip:16,s:[],px:new Uint8Array(4)};
function fxRender(){
  if(!FX.auto||!FX.active){renderFrame();return;}
  if(_fw.skip>0){_fw.skip--;renderFrame();return;}
  if((++_fw.i)%8){renderFrame();return;}
  const t0=performance.now();renderFrame();try{const gl=renderer.getContext();gl.readPixels(0,0,1,1,gl.RGBA,gl.UNSIGNED_BYTE,_fw.px);}catch(e){}
  const dt=performance.now()-t0;
  _fw.s.push(Math.min(dt,4000));
  if(_fw.s.length>=6){
    const a=_fw.s.slice().sort((x,y)=>x-y),med=(a[2]+a[3])/2;_fw.s=[];
    if(med>50&&FX.mode==='full'){_fw.skip=16;setFxMode('light',true);toast('Switched to Light effects for smoother movement. You can change this in the Look menu.');}
    else if(med>65&&FX.mode==='light'){_fw.skip=16;setFxMode('off',true);toast('Turned effects off for smoother movement. You can change this in the Look menu.');}
  }
}
/* ===== Plotline: 2D rendered plan, drawing primitives =====
   D = {cx, k (px per ft), ox, oy (px of lot centre), u (ui scale), ill (illustrated), sun}  */
const FB='"Instrument Sans",system-ui,-apple-system,"Segoe UI",sans-serif',FM='"IBM Plex Mono",ui-monospace,Menlo,monospace',FD='"Bricolage Grotesque","Instrument Sans",system-ui,sans-serif';
const _tc2={},_lp={};
function r2Tex(kind,base){return _tc2[kind+base]||(_tc2[kind+base]=texCanvas(kind,base,256,false));}
function linePat(kind){
  if(_lp[kind])return _lp[kind];
  const N=96,c=document.createElement('canvas');c.width=c.height=N;const g=c.getContext('2d'),R=rng(hash('lp'+kind));
  g.fillStyle='#fff';g.fillRect(0,0,N,N);g.strokeStyle='#333';g.fillStyle='#333';g.lineWidth=1;
  const dots=(n,a,b)=>{for(let i=0;i<n;i++){g.beginPath();g.arc(R()*N,R()*N,a+R()*(b-a),0,6.283);g.fill();}};
  const rings=(n,a,b)=>{for(let i=0;i<n;i++){g.beginPath();g.arc(R()*N,R()*N,a+R()*(b-a),0,6.283);g.stroke();}};
  if(kind==='lawn'){for(let i=0;i<22;i++){const x=R()*N,y=R()*N;g.beginPath();g.moveTo(x-2,y);g.lineTo(x,y-5);g.lineTo(x+2,y);g.stroke();}}
  else if(kind==='mulch')dots(70,.6,1.2);
  else if(kind==='cover')rings(14,2,4.5);
  else if(kind==='gravel')rings(34,1.2,3.2);
  else if(kind==='pavers'){for(let y=0;y<N;y+=16){g.beginPath();g.moveTo(0,y+.5);g.lineTo(N,y+.5);g.stroke();for(let x=((y/16)%2)*16;x<N;x+=32){g.beginPath();g.moveTo(x+.5,y);g.lineTo(x+.5,y+16);g.stroke();}}}
  else if(kind==='concrete')dots(18,.5,.9);
  else if(kind==='deck'){for(let y=0;y<N;y+=12){g.beginPath();g.moveTo(0,y+.5);g.lineTo(N,y+.5);g.stroke();}}
  else if(kind==='asphalt')dots(160,.4,.8);
  else if(kind==='water'){for(let y=10;y<N;y+=20){g.beginPath();g.moveTo(0,y);for(let x=0;x<N;x+=12){g.quadraticCurveTo(x+3,y-3,x+6,y);g.quadraticCurveTo(x+9,y+3,x+12,y);}g.stroke();}}
  return(_lp[kind]=c);
}
function P(D,x,z){return[D.ox+x*D.k,D.oy+z*D.k];}
function pat(D,canvas,ft){
  const p=D.cx.createPattern(canvas,'repeat');if(!p)return '#ccc';
  const s=ft?ft*D.k/canvas.width:D.u*0.9;
  if(p.setTransform)p.setTransform(new DOMMatrix([s,0,0,s,D.ox,D.oy]));
  return p;
}
function polyPath(D,pts,close){
  const cx=D.cx;cx.beginPath();pts.forEach((p,i)=>{const q=P(D,p[0],p[1]);if(i)cx.lineTo(q[0],q[1]);else cx.moveTo(q[0],q[1]);});if(close)cx.closePath();
}
function lobe(cx,x,y,r,n,ph){
  cx.beginPath();const N=n*10;
  for(let i=0;i<=N;i++){const a=i/N*6.2832,rr=r*(0.88+0.12*Math.abs(Math.cos(n*a/2+ph)));const px=x+Math.cos(a)*rr,py=y+Math.sin(a)*rr;if(i)cx.lineTo(px,py);else cx.moveTo(px,py);}
  cx.closePath();
}
function gfill(D,x,y,r,base){
  if(!D.ill)return '#fff';
  const g=D.cx.createRadialGradient(x-r*.35,y-r*.4,r*.08,x,y,r*1.05);
  g.addColorStop(0,shade(base,1.4));g.addColorStop(.55,base);g.addColorStop(1,shade(base,.66));return g;
}
function outl(D,base){return D.ill?shade(base,.42):'#111';}
function blob(D,x,y,r,base,n,ph,lw){
  const cx=D.cx;lobe(cx,x,y,r,n,ph);cx.fillStyle=gfill(D,x,y,r,base);cx.fill();
  cx.lineWidth=(lw||1.1)*D.u;cx.strokeStyle=outl(D,base);cx.stroke();
}
function dot(cx,x,y,r,col){cx.beginPath();cx.arc(x,y,Math.max(0.5,r),0,6.2832);cx.fillStyle=col;cx.fill();}

/* ---- surfaces ---- */
function r2Area(D,o){
  const c=CAT[o.cat],cx=D.cx,ill=D.ill;
  polyPath(D,o.pts,true);
  if(c.building){
    cx.fillStyle=ill?'#D4CBBA':'#fff';cx.fill();
    cx.save();cx.clip();
    if(ill){cx.strokeStyle='rgba(60,50,40,.10)';cx.lineWidth=1;const b=o.pts.map(p=>P(D,p[0],p[1])),x0=Math.min(...b.map(q=>q[0])),x1=Math.max(...b.map(q=>q[0])),y0=Math.min(...b.map(q=>q[1])),y1=Math.max(...b.map(q=>q[1])),st=7*D.u;
      for(let t=x0-(y1-y0);t<x1;t+=st){cx.beginPath();cx.moveTo(t,y1);cx.lineTo(t+(y1-y0),y0);cx.stroke();}}
    cx.restore();
    if(isRect(o.pts)){
      const xs=o.pts.map(p=>p[0]),zs=o.pts.map(p=>p[1]),x0=Math.min(...xs),x1=Math.max(...xs),z0=Math.min(...zs),z1=Math.max(...zs),dx=x1-x0,dz=z1-z0,m=Math.min(dx,dz)/2;
      const rd=dx>=dz?[[x0+m,(z0+z1)/2],[x1-m,(z0+z1)/2]]:[[(x0+x1)/2,z0+m],[(x0+x1)/2,z1-m]];
      cx.strokeStyle=ill?'#8F8676':'#111';cx.lineWidth=1.3*D.u;cx.beginPath();
      const r0=P(D,rd[0][0],rd[0][1]),r1=P(D,rd[1][0],rd[1][1]);cx.moveTo(r0[0],r0[1]);cx.lineTo(r1[0],r1[1]);
      const cs=[[x0,z0],[x1,z0],[x1,z1],[x0,z1]];
      cs.forEach(cr=>{const near=Math.hypot(cr[0]-rd[0][0],cr[1]-rd[0][1])<Math.hypot(cr[0]-rd[1][0],cr[1]-rd[1][1])?rd[0]:rd[1],a=P(D,cr[0],cr[1]),b=P(D,near[0],near[1]);cx.moveTo(a[0],a[1]);cx.lineTo(b[0],b[1]);});
      cx.stroke();
    }
    polyPath(D,o.pts,true);cx.strokeStyle=ill?'#5E5850':'#111';cx.lineWidth=2.4*D.u;cx.stroke();
    return;
  }
  if(c.water){
    if(ill){const b=o.pts.map(p=>P(D,p[0],p[1])),x0=Math.min(...b.map(q=>q[0])),y0=Math.min(...b.map(q=>q[1])),x1=Math.max(...b.map(q=>q[0])),y1=Math.max(...b.map(q=>q[1])),g=cx.createLinearGradient(x0,y0,x1,y1);g.addColorStop(0,'#7DB9D6');g.addColorStop(1,'#2F7FA6');cx.fillStyle=g;}
    else cx.fillStyle=pat(D,linePat('water'),0);
    cx.fill();
    if(ill){cx.save();cx.clip();cx.strokeStyle='rgba(255,255,255,.35)';cx.lineWidth=1.2*D.u;const ct=centroid(o.pts),q=P(D,ct[0],ct[1]),rr=Math.sqrt(polyArea(o.pts))*D.k*0.25;[0.5,0.8,1.1].forEach(f=>{cx.beginPath();cx.ellipse(q[0],q[1],rr*f,rr*f*0.6,-0.3,0.4,2.6);cx.stroke();});cx.restore();}
    polyPath(D,o.pts,true);cx.strokeStyle=ill?'#8D8A82':'#111';cx.lineWidth=3*D.u;cx.stroke();
    return;
  }
  if(ill)cx.fillStyle=c.tex?pat(D,r2Tex(c.tex,c.color),TEXFT[c.tex]):c.color;
  else cx.fillStyle=c.tex?pat(D,linePat(c.tex),0):'#fff';
  cx.fill();
  if(ill){cx.save();cx.clip();cx.lineWidth=Math.max(5*D.u,0.9*D.k);cx.strokeStyle='rgba(0,0,0,.13)';cx.stroke();cx.restore();}
  const hard=c.tex==='pavers'||c.tex==='deck'||c.tex==='concrete'||c.tex==='asphalt';
  cx.lineWidth=(hard?1.8:1.1)*D.u;cx.strokeStyle=ill?shade(c.color,hard?0.5:0.55):'#111';cx.stroke();
}

/* ---- fences, walls, edging, hedges ---- */
function r2Line(D,o){
  const c=CAT[o.cat],cx=D.cx,k=D.k,ill=D.ill,u=D.u,w=Math.max((c.t||0.2)*k,1.4*u);
  const path=()=>polyPath(D,o.pts,false);
  cx.lineJoin='round';cx.lineCap='butt';
  if(c.id==='hedge'){
    const R=rng(hash(o.id)),st=Math.max(0.8,c.t*0.8);
    for(let i=1;i<o.pts.length;i++){
      const a=o.pts[i-1],b=o.pts[i],L=Math.hypot(b[0]-a[0],b[1]-a[1]),n=Math.max(1,Math.ceil(L/st));
      for(let j=0;j<=n;j++){const t=j/n,q=P(D,a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t);blob(D,q[0],q[1],c.t*0.62*k*(0.9+R()*0.2),ill?jit(c.color,R):c.color,7,R()*6,1);}
    }
    return;
  }
  if(c.id==='edging'){path();cx.strokeStyle=ill?'#3A4044':'#111';cx.lineWidth=Math.max(1.8*u,w);cx.stroke();return;}
  path();cx.strokeStyle=ill?shade(c.color,0.45):'#111';cx.lineWidth=w+2*u;cx.stroke();
  path();cx.strokeStyle=ill?c.color:'#fff';cx.lineWidth=w;cx.stroke();
  if(c.id==='wall'){path();cx.setLineDash([k*0.9,k*0.9]);cx.strokeStyle=ill?'rgba(0,0,0,.22)':'#111';cx.lineWidth=Math.max(1,w*0.12);cx.stroke();cx.setLineDash([]);}
  const ps=Math.max(w*1.35,3.5*u);
  for(let i=1;i<o.pts.length;i++){
    const a=o.pts[i-1],b=o.pts[i],L=Math.hypot(b[0]-a[0],b[1]-a[1]),n=Math.max(1,Math.ceil(L/7));
    for(let j=(i===1?0:1);j<=n;j++){const t=j/n,q=P(D,a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t);cx.fillStyle=ill?shade(c.color,0.55):'#111';cx.fillRect(q[0]-ps/2,q[1]-ps/2,ps,ps);}
  }
}

/* ---- placed items ---- */
function r2Point(D,o){
  const c=CAT[o.cat],cx=D.cx,k=D.k,u=D.u,ill=D.ill,sc=o.scale||1,R=rng(hash(o.id)),q=P(D,o.x,o.z),X=q[0],Y=q[1],ph=R()*6;
  const st=c.style,r=(c.sp||0)/2*sc*k;
  const cluster=c.group==='plants'&&(o.count||1)>1;
  if(st==='round'||st==='ornamental'){
    const rr=r*(st==='round'?0.95:0.9);
    blob(D,X,Y,rr,c.color,11,ph);
    for(let i=0;i<5;i++){const a=i/5*6.28+ph,q2=[X+Math.cos(a)*rr*0.46,Y+Math.sin(a)*rr*0.46];lobe(cx,q2[0],q2[1],rr*0.34,7,a);cx.fillStyle=ill?(i%2?'rgba(255,255,255,.12)':shade(c.color2||c.color,1)+'55'):'#fff';cx.fill();cx.strokeStyle=ill?'rgba(0,0,0,.2)':'rgba(0,0,0,.5)';cx.lineWidth=0.8*u;cx.stroke();}
    dot(cx,X,Y,Math.max(1.5*u,rr*0.06),ill?'#4A3626':'#111');
  }else if(st==='conifer'){
    const N=16;cx.beginPath();for(let i=0;i<N*2;i++){const a=i/(N*2)*6.2832+ph,rr=r*(i%2?0.66:1);if(i)cx.lineTo(X+Math.cos(a)*rr,Y+Math.sin(a)*rr);else cx.moveTo(X+Math.cos(a)*rr,Y+Math.sin(a)*rr);}cx.closePath();
    cx.fillStyle=gfill(D,X,Y,r,c.color);cx.fill();cx.strokeStyle=outl(D,c.color);cx.lineWidth=1.1*u;cx.stroke();
    cx.beginPath();for(let i=0;i<N*2;i++){const a=i/(N*2)*6.2832+ph+0.1,rr=r*0.55*(i%2?0.6:1);if(i)cx.lineTo(X+Math.cos(a)*rr,Y+Math.sin(a)*rr);else cx.moveTo(X+Math.cos(a)*rr,Y+Math.sin(a)*rr);}cx.closePath();
    cx.fillStyle=ill?'rgba(255,255,255,.1)':'#fff';cx.fill();cx.strokeStyle=ill?'rgba(0,0,0,.25)':'rgba(0,0,0,.6)';cx.lineWidth=0.8*u;cx.stroke();
    dot(cx,X,Y,Math.max(1.5*u,r*0.07),ill?'#3E2F24':'#111');
  }else if(st==='column'){
    blob(D,X,Y,Math.max(r,2.5*u),c.color,7,ph);dot(cx,X,Y,Math.max(1.2*u,r*0.12),ill?'#3E2F24':'#111');
  }else if(st==='mound'||st==='clipped'){
    const n=cluster?Math.min(o.count,30):1,sp=c.sp*0.85,ur=(cluster?0.8:0.95)*(c.sp/2)*sc*k*(st==='clipped'?1:0.9);
    const rot=(o.rot||0)*Math.PI/180;
    for(let i=n-1;i>=0;i--){
      const rd=sp*0.9*Math.sqrt(i)*sc*k,a=i*2.39996+rot,x=X+Math.cos(a)*rd,y=Y+Math.sin(a)*rd;
      blob(D,x,y,ur,c.color,st==='clipped'?16:9,i*1.3);
      if(ill&&c.flower){const rr=rng(i+hash(o.id));for(let f=0;f<6;f++){const aa=rr()*6.28,dd=Math.sqrt(rr())*ur*0.7;dot(cx,x+Math.cos(aa)*dd,y+Math.sin(aa)*dd,Math.max(1.1*u,ur*0.1),shade(c.flower,0.85+rr()*0.3));}}
      if(st==='clipped'){cx.beginPath();cx.arc(x,y,ur*0.62,0,6.2832);cx.strokeStyle=ill?'rgba(0,0,0,.16)':'rgba(0,0,0,.4)';cx.lineWidth=0.8*u;cx.stroke();}
    }
  }else if(st==='grass'){
    const n=ill?24:12,L=r*1.05;cx.lineCap='round';
    for(let i=0;i<n;i++){const a=i/n*6.28+R()*0.3,l=L*(0.65+R()*0.35);cx.beginPath();cx.moveTo(X,Y);cx.quadraticCurveTo(X+Math.cos(a+0.35)*l*0.6,Y+Math.sin(a+0.35)*l*0.6,X+Math.cos(a)*l,Y+Math.sin(a)*l);cx.strokeStyle=ill?[c.color,shade(c.color,0.8),shade(c.color,1.15)][i%3]:'#111';cx.lineWidth=(ill?1.4:1)*u;cx.stroke();}
    cx.lineCap='butt';dot(cx,X,Y,Math.max(1.2*u,r*0.1),ill?shade(c.color,0.6):'#111');
  }else if(st==='fern'){
    const n=9;
    for(let i=0;i<n;i++){const a=i/n*6.28+R()*0.3,l=r*(0.9+R()*0.3);cx.save();cx.translate(X,Y);cx.rotate(a);cx.beginPath();cx.ellipse(l/2,0,l/2,Math.max(1.5*u,l*0.13),0,0,6.2832);cx.fillStyle=ill?(i%2?c.color:shade(c.color,1.2)):'#fff';cx.fill();cx.strokeStyle=outl(D,c.color);cx.lineWidth=0.9*u;cx.stroke();cx.beginPath();cx.moveTo(0,0);cx.lineTo(l,0);cx.strokeStyle=ill?'rgba(255,255,255,.35)':'rgba(0,0,0,.5)';cx.stroke();cx.restore();}
  }else if(st==='rock'){
    cx.save();cx.translate(X,Y);cx.rotate(ph);
    const N=9,pts=[];for(let i=0;i<N;i++){const a=i/N*6.2832,rr=r*(0.82+R()*0.24);pts.push([Math.cos(a)*rr,Math.sin(a)*rr*0.88]);}
    cx.beginPath();pts.forEach((p,i)=>{if(i)cx.lineTo(p[0],p[1]);else cx.moveTo(p[0],p[1]);});cx.closePath();
    cx.fillStyle=gfill(D,-r*0.2,-r*0.2,r,c.color);cx.fill();cx.strokeStyle=outl(D,c.color);cx.lineWidth=1.3*u;cx.stroke();
    cx.beginPath();cx.moveTo(pts[0][0]*0.2,pts[0][1]*0.2);[2,5,7].forEach(i=>cx.lineTo(pts[i][0]*0.55,pts[i][1]*0.55));cx.strokeStyle=ill?'rgba(0,0,0,.22)':'rgba(0,0,0,.5)';cx.lineWidth=0.9*u;cx.stroke();
    cx.beginPath();cx.arc(r*0.8,r*0.45,r*0.22,0,6.2832);cx.fillStyle=ill?shade(c.color,0.9):'#fff';cx.fill();cx.strokeStyle=outl(D,c.color);cx.stroke();
    cx.restore();
  }else if(st==='pot'){
    cx.beginPath();cx.arc(X,Y,r,0,6.2832);cx.fillStyle=gfill(D,X,Y,r,c.color);cx.fill();cx.strokeStyle=outl(D,c.color);cx.lineWidth=1.2*u;cx.stroke();
    cx.beginPath();cx.arc(X,Y,r*0.78,0,6.2832);cx.fillStyle=ill?'#3B2A20':'#fff';cx.fill();cx.stroke();
    blob(D,X,Y,r*0.6,'#3F7D3C',8,ph);if(ill)dot(cx,X+r*0.15,Y-r*0.1,Math.max(1.5*u,r*0.14),'#D95C8A');
  }else if(st==='firepit'){
    cx.beginPath();cx.arc(X,Y,r,0,6.2832);cx.fillStyle=ill?'#8C877F':'#fff';cx.fill();cx.strokeStyle=outl(D,c.color);cx.lineWidth=1.3*u;cx.stroke();
    for(let i=0;i<12;i++){const a=i/12*6.2832;cx.beginPath();cx.moveTo(X+Math.cos(a)*r*0.66,Y+Math.sin(a)*r*0.66);cx.lineTo(X+Math.cos(a)*r,Y+Math.sin(a)*r);cx.lineWidth=0.9*u;cx.stroke();}
    cx.beginPath();cx.arc(X,Y,r*0.64,0,6.2832);cx.fillStyle=ill?'#2A2623':'#fff';cx.fill();cx.stroke();
    if(ill){const g=cx.createRadialGradient(X,Y,0,X,Y,r*0.55);g.addColorStop(0,'rgba(255,190,70,.95)');g.addColorStop(1,'rgba(255,110,0,0)');cx.fillStyle=g;cx.fillRect(X-r,Y-r,r*2,r*2);}
  }else if(st==='light'){
    if(ill){const g=cx.createRadialGradient(X,Y,0,X,Y,Math.max(1.6*k,8*u));g.addColorStop(0,'rgba(255,214,120,.55)');g.addColorStop(1,'rgba(255,214,120,0)');cx.fillStyle=g;cx.beginPath();cx.arc(X,Y,Math.max(1.6*k,8*u),0,6.2832);cx.fill();}
    dot(cx,X,Y,Math.max(0.4*k,2.5*u),ill?'#2E3234':'#111');dot(cx,X,Y,Math.max(0.2*k,1.2*u),ill?'#FFE2A8':'#fff');
  }else{ /* box shapes */
    const w=(c.w||c.sp)*sc*k,d=(c.d||c.sp)*sc*k;
    cx.save();cx.translate(X,Y);cx.rotate((o.rot||0)*Math.PI/180);
    if(st==='bench'){
      cx.fillStyle=ill?c.color:'#fff';cx.fillRect(-w/2,-d/2,w,d);cx.strokeStyle=outl(D,c.color);cx.lineWidth=1.2*u;cx.strokeRect(-w/2,-d/2,w,d);
      cx.lineWidth=0.8*u;for(let i=1;i<6;i++){cx.beginPath();cx.moveTo(-w/2,-d/2+d*i/6);cx.lineTo(w/2,-d/2+d*i/6);cx.stroke();}
      cx.fillStyle=ill?shade(c.color,0.6):'#111';cx.fillRect(-w/2,-d/2,w,d*0.16);
    }else if(st==='raised'){
      cx.fillStyle=ill?c.color:'#fff';cx.fillRect(-w/2,-d/2,w,d);cx.strokeStyle=outl(D,c.color);cx.lineWidth=1.2*u;cx.strokeRect(-w/2,-d/2,w,d);
      const b=0.4*k;cx.fillStyle=ill?'#4A3326':'#fff';cx.fillRect(-w/2+b,-d/2+b,w-2*b,d-2*b);cx.strokeRect(-w/2+b,-d/2+b,w-2*b,d-2*b);
      if(ill)for(let i=0;i<9;i++)dot(cx,(R()-.5)*(w-3*b),(R()-.5)*(d-3*b),Math.max(1.4*u,0.2*k),shade('#4C8B45',0.8+R()*0.4));
    }else if(st==='pergola'){
      cx.strokeStyle=ill?shade(c.color,0.9):'#111';cx.lineWidth=Math.max(1.2*u,0.3*k);
      const n=13;for(let i=0;i<n;i++){const x=-w/2-0.2*k+(w+0.4*k)*i/(n-1);cx.beginPath();cx.moveTo(x,-d/2-0.7*k);cx.lineTo(x,d/2+0.7*k);cx.stroke();}
      [-1,1].forEach(b=>{cx.beginPath();cx.moveTo(-w/2-0.7*k,b*(d/2-0.4*k));cx.lineTo(w/2+0.7*k,b*(d/2-0.4*k));cx.lineWidth=Math.max(1.6*u,0.5*k);cx.stroke();});
      cx.fillStyle=ill?shade(c.color,0.5):'#111';const ps=Math.max(0.5*k,3*u);[-1,1].forEach(a=>[-1,1].forEach(b=>cx.fillRect(a*(w/2-0.4*k)-ps/2,b*(d/2-0.4*k)-ps/2,ps,ps)));
    }else if(st==='shed'){
      const rw=w+1.2*k,rd=d+1.2*k;
      cx.fillStyle=ill?'#8C857E':'#fff';cx.fillRect(-rw/2,-rd/2,rw,rd);
      if(ill){cx.fillStyle='rgba(255,255,255,.14)';cx.beginPath();cx.moveTo(-rw/2,-rd/2);cx.lineTo(rw/2,-rd/2);cx.lineTo(rw/2-rd/2,0);cx.lineTo(-rw/2+rd/2,0);cx.closePath();cx.fill();cx.fillStyle='rgba(0,0,0,.14)';cx.beginPath();cx.moveTo(-rw/2,rd/2);cx.lineTo(rw/2,rd/2);cx.lineTo(rw/2-rd/2,0);cx.lineTo(-rw/2+rd/2,0);cx.closePath();cx.fill();}
      cx.strokeStyle=ill?'#4F4A44':'#111';cx.lineWidth=1.3*u;cx.strokeRect(-rw/2,-rd/2,rw,rd);
      cx.beginPath();cx.moveTo(-rw/2,-rd/2);cx.lineTo(-rw/2+rd/2,0);cx.moveTo(-rw/2,rd/2);cx.lineTo(-rw/2+rd/2,0);cx.moveTo(rw/2,-rd/2);cx.lineTo(rw/2-rd/2,0);cx.moveTo(rw/2,rd/2);cx.lineTo(rw/2-rd/2,0);cx.moveTo(-rw/2+rd/2,0);cx.lineTo(rw/2-rd/2,0);cx.lineWidth=1*u;cx.stroke();
    }else{cx.fillStyle=ill?c.color:'#fff';cx.fillRect(-w/2,-d/2,w,d);cx.strokeStyle=outl(D,c.color);cx.strokeRect(-w/2,-d/2,w,d);}
    cx.restore();
  }
}

/* ---- sun shadows: drawn into an opaque layer, then composited once ---- */
function r2SunVec(){
  const sv=sunVec();if(sv.alt<=2)return null;
  let dx=-sv.v.x/sv.v.y,dz=-sv.v.z/sv.v.y;const m=Math.hypot(dx,dz);if(m>3.5){dx*=3.5/m;dz*=3.5/m;}
  return{dx,dz};
}
function r2Shadows(D,lc,sv){
  const k=D.k,list=[];
  const add=(H,fn)=>list.push({H,fn});
  const fillP=pts=>{lc.beginPath();pts.forEach((p,i)=>{if(i)lc.lineTo(p[0],p[1]);else lc.moveTo(p[0],p[1]);});lc.closePath();lc.fill();};
  const circ=(x,y,r)=>{lc.beginPath();lc.arc(x,y,Math.max(0.5,r),0,6.2832);lc.fill();};
  const sweep=(pts,H)=>{ // pts in world feet
    const A=pts.map(p=>P(D,p[0],p[1])),B=pts.map(p=>P(D,p[0]+sv.dx*H,p[1]+sv.dz*H));
    fillP(A);fillP(B);for(let i=0;i<A.length;i++){const j=(i+1)%A.length;fillP([A[i],A[j],B[j],B[i]]);}
  };
  const capsule=(x,z,r0,H,r1,f)=>{const a=P(D,x,z),b=P(D,x+sv.dx*H*f,z+sv.dz*H*f),dx=b[0]-a[0],dy=b[1]-a[1],L=Math.hypot(dx,dy)||1,nx=-dy/L,ny=dx/L;circ(a[0],a[1],r0*k);circ(b[0],b[1],r1*k);fillP([[a[0]+nx*r0*k,a[1]+ny*r0*k],[b[0]+nx*r1*k,b[1]+ny*r1*k],[b[0]-nx*r1*k,b[1]-ny*r1*k],[a[0]-nx*r0*k,a[1]-ny*r0*k]]);};
  const rectPts=(x,z,w,d,rot)=>{const cs=Math.cos(rot),sn=Math.sin(rot);return[[-w/2,-d/2],[w/2,-d/2],[w/2,d/2],[-w/2,d/2]].map(p=>[x+p[0]*cs-p[1]*sn,z+p[0]*sn+p[1]*cs]);};
  S.objects.forEach(o=>{
    const c=CAT[o.cat];
    if(c.kind==='area'){
      const H=o.height!=null?o.height:c.h;if(H<0.9||c.water)return;
      add(H,()=>{sweep(o.pts,H);lc.save();lc.globalCompositeOperation='destination-out';polyPath({cx:lc,k:D.k,ox:D.ox,oy:D.oy},o.pts,true);lc.fill();lc.restore();});
    }else if(c.kind==='line'){
      const H=o.height!=null?o.height:c.h;if(H<0.9)return;
      add(H,()=>{for(let i=1;i<o.pts.length;i++){const a=o.pts[i-1],b=o.pts[i],dx=b[0]-a[0],dz=b[1]-a[1],L=Math.hypot(dx,dz)||1,t=Math.max(c.t,0.3)/2,nx=-dz/L*t,nz=dx/L*t;sweep([[a[0]+nx,a[1]+nz],[b[0]+nx,b[1]+nz],[b[0]-nx,b[1]-nz],[a[0]-nx,a[1]-nz]],H);}});
    }else{
      const sc=o.scale||1,H=c.h*sc;if(H<0.9)return;const st=c.style,rot=(o.rot||0)*Math.PI/180;
      if(st==='round'||st==='ornamental')add(H,()=>{capsule(o.x,o.z,0.3,H,c.sp*sc*0.44,0.72);});
      else if(st==='conifer'||st==='column')add(H,()=>{capsule(o.x,o.z,c.sp*sc*(st==='conifer'?0.42:0.4),H,0.25,1);});
      else if(st==='bench'||st==='raised'||st==='shed')add(H,()=>{sweep(rectPts(o.x,o.z,c.w*sc,c.d*sc,rot),H);});
      else if(st==='pergola')add(H,()=>{const w=c.w*sc,d=c.d*sc;[-1,1].forEach(a=>[-1,1].forEach(b=>{const cs=Math.cos(rot),sn=Math.sin(rot),px=a*(w/2-0.4),pz=b*(d/2-0.4);sweep(rectPts(o.x+px*cs-pz*sn,o.z+px*sn+pz*cs,0.5,0.5,rot),H);}));
        for(let i=0;i<9;i++){const px=-w/2-0.2+(w+0.4)*i/8,cs=Math.cos(rot),sn=Math.sin(rot);const q=rectPts(o.x+px*cs,o.z+px*sn,0.3,d+1.4,rot).map(p=>[p[0]+sv.dx*H,p[1]+sv.dz*H]);fillP(q.map(p=>P(D,p[0],p[1])));}});
      else if(st==='light')add(H,()=>{capsule(o.x,o.z,0.1,H,0.1,1);});
      else{
        const n=c.group==='plants'&&(o.count||1)>1?Math.min(o.count,12):1,sp=c.sp*0.85;
        add(H,()=>{for(let i=0;i<n;i++){const rd=sp*0.9*Math.sqrt(i)*sc,a=i*2.39996+rot;capsule(o.x+Math.cos(a)*rd,o.z+Math.sin(a)*rd,c.sp*sc*0.36,H,c.sp*sc*0.3,0.5);}});
      }
    }
  });
  list.sort((a,b)=>a.H-b.H).forEach(e=>e.fn());
}
/* ===== Plotline: 2D rendered plan, sheet layout, legend, view controls, export ===== */
const cv2=$('cv2');
const R2V={zoom:1,px:0,py:0};let R2L=null,shCv=null;
function ftin(v){const f=Math.floor(v+1e-6),i=Math.round((v-f)*12);return f+"'-"+(i%12)+'"';}
function txt(cx,s,x,y,o){
  cx.font=(o.w||500)+' '+o.size+'px '+(o.f||FB);cx.textAlign=o.align||'left';cx.textBaseline=o.base||'middle';
  if(o.halo){cx.lineJoin='round';cx.lineWidth=o.halo;cx.strokeStyle='rgba(255,255,255,.88)';cx.strokeText(s,x,y);}
  cx.fillStyle=o.col||'#1B2A20';cx.fillText(s,x,y);
}
function legendItems(){
  const E=new Map();
  S.objects.forEach(o=>{const c=CAT[o.cat];if(c.excluded)return;let r=E.get(c.id);if(!r){r={c,n:0,qty:0};E.set(c.id,r);}r.n++;r.qty+=qtyOfObj(o);});
  const groups=GROUPS.map(g=>({g,items:CATALOG.filter(c=>c.group===g.id&&E.has(c.id)).map(c=>E.get(c.id))})).filter(g=>g.items.length);
  const nums={};let n=0;groups.forEach(g=>g.items.forEach(r=>{if(r.c.kind==='point')nums[r.c.id]=++n;}));
  return{groups,nums};
}
function symbolAt(D,c,x,y,box){
  const D2={cx:D.cx,k:box/Math.max(c.w||0,c.d||0,c.sp||1),ox:x,oy:y,u:D.u,ill:D.ill};
  r2Point(D2,{id:'leg'+c.id,cat:c.id,x:0,z:0,rot:0,scale:1,count:1},null);
}
function drawLegend(D,x,y,w,h,lg){
  const cx=D.cx,u=D.u,ill=D.ill;
  cx.fillStyle=ill?'#FBF9F3':'#fff';cx.fillRect(x,y,w,h);cx.strokeStyle=ill?'#C9C2B0':'#111';cx.lineWidth=1.2*u;cx.strokeRect(x,y,w,h);
  txt(cx,'KEY',x+14*u,y+18*u,{size:11*u,w:700,col:ill?'#566559':'#111'});
  let rows=0;lg.groups.forEach(g=>{rows+=1+g.items.length;});
  const avail=h-36*u,rh=Math.max(15*u,Math.min(27*u,avail/Math.max(1,rows)));
  let yy=y+34*u+rh*0.5;
  for(const g of lg.groups){
    if(yy>y+h-rh*0.4)break;
    txt(cx,g.g.name.toUpperCase(),x+14*u,yy,{size:10*u,w:700,col:ill?'#7A877D':'#444'});yy+=rh;
    for(const r of g.items){
      if(yy>y+h-rh*0.4){txt(cx,'…',x+14*u,yy,{size:12*u});break;}
      const c=r.c,sy=yy,sym=Math.min(rh*0.82,22*u);
      if(c.kind==='point'){
        const nm=lg.nums[c.id];cx.beginPath();cx.arc(x+22*u,sy,8.5*u,0,6.2832);cx.fillStyle=ill?'#1B2A20':'#111';cx.fill();txt(cx,String(nm),x+22*u,sy+0.5*u,{size:10.5*u,w:700,col:'#fff',align:'center'});
        symbolAt(D,c,x+50*u,sy,sym);
      }else if(c.kind==='area'){
        const sx=x+14*u,sw=40*u,sh=Math.min(rh*0.7,14*u);
        if(c.building){cx.fillStyle=ill?'#D4CBBA':'#fff';}
        else if(c.water)cx.fillStyle=ill?'#5FA3C7':pat({cx,k:3*u,ox:sx,oy:sy,u},linePat('water'),0);
        else cx.fillStyle=ill?pat({cx,k:3*u,ox:sx,oy:sy,u},r2Tex(c.tex,c.color),TEXFT[c.tex]):pat({cx,k:3*u,ox:sx,oy:sy,u},linePat(c.tex),0);
        cx.fillRect(sx,sy-sh/2,sw,sh);cx.strokeStyle=ill?shade(c.color,.55):'#111';cx.lineWidth=1*u;cx.strokeRect(sx,sy-sh/2,sw,sh);
      }else{
        cx.beginPath();cx.moveTo(x+14*u,sy);cx.lineTo(x+54*u,sy);
        if(c.id==='hedge'){cx.strokeStyle=ill?c.color:'#111';cx.lineWidth=7*u;cx.lineCap='round';cx.stroke();cx.lineCap='butt';}
        else{cx.strokeStyle=ill?shade(c.color,.45):'#111';cx.lineWidth=Math.min(6*u,Math.max(2*u,c.t*3*u))+1.5*u;cx.stroke();cx.beginPath();cx.moveTo(x+14*u,sy);cx.lineTo(x+54*u,sy);cx.strokeStyle=ill?c.color:'#fff';cx.lineWidth=Math.min(6*u,Math.max(2*u,c.t*3*u));cx.stroke();}
      }
      const q=c.kind==='point'?'×'+r.qty:c.kind==='area'?Math.round(r.qty).toLocaleString('en-US')+' sf':Math.round(r.qty)+' lf';
      txt(cx,q,x+w-12*u,sy,{size:11*u,f:FM,align:'right',col:ill?'#566559':'#333'});
      let nmT=c.name;cx.font='500 '+(12.5*u)+'px '+FB;const maxW=w-12*u-(cx.measureText(q).width)-72*u-12*u;
      while(nmT.length>4&&cx.measureText(nmT).width>maxW)nmT=nmT.slice(0,-2);if(nmT!==c.name)nmT=nmT.trim()+'…';
      txt(cx,nmT,x+(c.kind==='point'?70:66)*u,sy,{size:12.5*u});
      yy+=rh;
    }
  }
}
function dimLine(cx,x1,y1,x2,y2,label,u,vert){
  cx.save();cx.strokeStyle='#445';cx.fillStyle='#445';cx.lineWidth=1*u;
  cx.beginPath();cx.moveTo(x1,y1);cx.lineTo(x2,y2);cx.stroke();
  const tk=5*u;[[x1,y1],[x2,y2]].forEach(p=>{cx.beginPath();if(vert){cx.moveTo(p[0]-tk,p[1]);cx.lineTo(p[0]+tk,p[1]);}else{cx.moveTo(p[0],p[1]-tk);cx.lineTo(p[0],p[1]+tk);}cx.stroke();});
  cx.translate((x1+x2)/2,(y1+y2)/2);if(vert)cx.rotate(-Math.PI/2);
  cx.font='500 '+(11.5*u)+'px '+FM;const tw=cx.measureText(label).width;cx.fillStyle='rgba(255,255,255,.92)';cx.fillRect(-tw/2-4*u,-8*u,tw+8*u,16*u);
  cx.fillStyle='#334';cx.textAlign='center';cx.textBaseline='middle';cx.fillText(label,0,0.5*u);cx.restore();
}
function niceLen(maxFt){let L=1;[1,2,5,10,20,25,50,100,200].forEach(n=>{if(n<=maxFt)L=n;});return L;}

function drawSheet(cx,W,H,o){
  const u=o.u||1,ill=o.style!=='line',lg=legendItems();
  cx.save();cx.setTransform(1,0,0,1,0,0);cx.globalAlpha=1;cx.setLineDash([]);
  cx.fillStyle=ill?'#F5F2E9':'#fff';cx.fillRect(0,0,W,H);
  const legW=(o.legend&&W>=(o.legMin!=null?o.legMin:760*u))?Math.round(Math.max(220*u,Math.min(W*0.25,340*u))):0;
  const pad=Object.assign({t:24*u,r:24*u,b:24*u,l:24*u},o.pad||{});
  const tb=o.titleBlock?Math.round(92*u):0;
  const dr={x:pad.l,y:pad.t,w:W-pad.l-pad.r-(legW?legW+16*u:0),h:H-pad.t-pad.b-tb};
  const dm=o.dims?30*u:10*u,av={x:dr.x+dm,y:dr.y+dm,w:dr.w-dm*1.5,h:dr.h-dm*1.5};
  const k0=Math.max(0.01,Math.min(av.w/S.lot.w,av.h/S.lot.d)),v=o.view||{zoom:1,px:0,py:0},k=k0*v.zoom;
  const cx0=av.x+av.w/2,cy0=av.y+av.h/2,ox=cx0+v.px,oy=cy0+v.py,D={cx,k,ox,oy,u,ill};
  const lx=ox-S.lot.w/2*k,ly=oy-S.lot.d/2*k,lw=S.lot.w*k,lh=S.lot.d*k;
  cx.save();cx.beginPath();cx.rect(dr.x,dr.y,dr.w,dr.h);cx.clip();
  cx.fillStyle=ill?'#DDD7C4':'#fff';cx.fillRect(lx,ly,lw,lh);
  S.objects.forEach(ob=>{if(CAT[ob.cat].kind==='area')r2Area(D,ob);});
  const sv=o.shadows?r2SunVec():null;
  if(sv){
    if(!shCv)shCv=document.createElement('canvas');
    if(shCv.width!==W||shCv.height!==H){shCv.width=W;shCv.height=H;}
    const lc=shCv.getContext('2d');lc.setTransform(1,0,0,1,0,0);lc.clearRect(0,0,W,H);lc.fillStyle='#000';lc.globalCompositeOperation='source-over';
    r2Shadows(D,lc,sv);
    cx.save();cx.beginPath();cx.rect(lx,ly,lw,lh);cx.clip();cx.globalAlpha=ill?0.34:0.2;
    if('filter' in cx)cx.filter='blur('+(1.3*u)+'px)';
    cx.drawImage(shCv,0,0);cx.restore();
  }
  S.objects.forEach(ob=>{if(CAT[ob.cat].kind==='line')r2Line(D,ob);});
  S.objects.filter(ob=>CAT[ob.cat].kind==='point').sort((a,b)=>CAT[a.cat].h*(a.scale||1)-CAT[b.cat].h*(b.scale||1)).forEach(ob=>r2Point(D,ob));
  cx.setLineDash([9*u,5*u,2*u,5*u]);cx.strokeStyle=ill?'#B5472A':'#111';cx.lineWidth=1.6*u;cx.strokeRect(lx,ly,lw,lh);cx.setLineDash([]);
  /* labels */
  if(o.labels){
    const nums=legW>0,placed=[],fs=12*u,small=!nums&&lw<360*u;
    const put=(s,x,y,opt)=>{
      cx.font='600 '+fs+'px '+FB;const tw=cx.measureText(s).width,h=fs*1.2;let yy=y;
      for(let t=0;t<4;t++){const r=[x-tw/2,yy-h/2,tw,h];if(!placed.some(p=>r[0]<p[0]+p[2]&&r[0]+r[2]>p[0]&&r[1]<p[1]+p[3]&&r[1]+r[3]>p[1])){placed.push(r);txt(cx,s,x,yy,Object.assign({size:fs,w:600,align:'center',halo:3*u},opt||{}));return;}yy+=h;}
    };
    S.objects.forEach(ob=>{
      const c=CAT[ob.cat];
      if(c.kind==='area'){
        const b=ob.pts.map(p=>P(D,p[0],p[1])),bw=Math.max(...b.map(q=>q[0]))-Math.min(...b.map(q=>q[0])),bh=Math.max(...b.map(q=>q[1]))-Math.min(...b.map(q=>q[1]));
        const s=(ob.label||c.name)+(c.building?'':' · '+Math.round(polyArea(ob.pts))+' sf');cx.font='600 '+fs+'px '+FB;
        if(bw>cx.measureText(s).width*0.8&&bh>fs*2){const ct=centroid(ob.pts),q=P(D,ct[0],ct[1]);put(s,q[0],q[1],{col:ill?'#2A3A2E':'#111',w:c.building?700:600});}
      }else if(c.kind==='line'){
        if((!nums&&!small)||ob.label){const m=lineMid(ob.pts),q=P(D,m[0],m[1]),s=(ob.label||c.name)+' · '+Math.round(polyLen(ob.pts))+' lf';if(polyLen(ob.pts)*k>cx.measureText(s).width*0.9)put(s,q[0],q[1]-9*u,{size:fs*0.92});}
      }else{
        const q=P(D,ob.x,ob.z),r=footR(ob)*k;
        if(nums){const n=lg.nums[c.id],bx=q[0]+r*0.72,by=q[1]-r*0.72,br=Math.max(7.5*u,Math.min(10*u,r*0.7));
          cx.beginPath();cx.arc(bx,by,br,0,6.2832);cx.fillStyle=ill?'#1B2A20':'#fff';cx.fill();cx.strokeStyle=ill?'#fff':'#111';cx.lineWidth=1.4*u;cx.stroke();
          txt(cx,String(n),bx,by+0.5*u,{size:br*1.15,w:700,col:ill?'#fff':'#111',align:'center'});}
        else if(!small)put((ob.label||c.name)+((ob.count||1)>1?' ×'+ob.count:''),q[0],q[1]+r+fs*0.7,{col:ill?'#1B2A20':'#111'});
      }
    });
  }
  /* dimensions */
  if(o.dims){
    const off=16*u;
    dimLine(cx,lx,ly-off,lx+lw,ly-off,ftin(S.lot.w),u,false);
    dimLine(cx,lx-off,ly,lx-off,ly+lh,ftin(S.lot.d),u,true);
    cx.strokeStyle='#8a8f98';cx.lineWidth=0.8*u;cx.beginPath();cx.moveTo(lx,ly-off-5*u);cx.lineTo(lx,ly-2*u);cx.moveTo(lx+lw,ly-off-5*u);cx.lineTo(lx+lw,ly-2*u);cx.moveTo(lx-off-5*u,ly);cx.lineTo(lx-2*u,ly);cx.moveTo(lx-off-5*u,ly+lh);cx.lineTo(lx-2*u,ly+lh);cx.stroke();
  }
  /* north arrow */
  {const nx=dr.x+dr.w-34*u,ny=dr.y+46*u,r=20*u;cx.beginPath();cx.arc(nx,ny,r,0,6.2832);cx.fillStyle=ill?'rgba(255,255,255,.7)':'#fff';cx.fill();cx.strokeStyle=ill?'#1B2A20':'#111';cx.lineWidth=1.3*u;cx.stroke();
   cx.beginPath();cx.moveTo(nx,ny-r*0.8);cx.lineTo(nx+r*0.38,ny+r*0.55);cx.lineTo(nx,ny+r*0.25);cx.lineTo(nx-r*0.38,ny+r*0.55);cx.closePath();cx.fillStyle=ill?'#1B2A20':'#111';cx.fill();
   txt(cx,'N',nx,ny-r-9*u,{size:13*u,w:700,align:'center',col:ill?'#1B2A20':'#111'});}
  /* scale bar */
  {const L=niceLen(Math.min(170*u/k,S.lot.w*0.6)),bw=L*k,bx=dr.x+14*u,by=dr.y+dr.h-26*u,hh=6*u;
   for(let i=0;i<4;i++){cx.fillStyle=i%2?'#fff':(ill?'#1B2A20':'#111');cx.fillRect(bx+bw*i/4,by,bw/4,hh);}
   cx.strokeStyle=ill?'#1B2A20':'#111';cx.lineWidth=1*u;cx.strokeRect(bx,by,bw,hh);
   txt(cx,'0',bx,by-8*u,{size:10.5*u,f:FM,align:'center'});txt(cx,L+' ft',bx+bw,by-8*u,{size:10.5*u,f:FM,align:'center'});}
  cx.restore();
  if(legW)drawLegend(D,W-pad.r-legW,pad.t,legW,dr.h,lg);
  if(tb){
    const y0=H-pad.b-tb+10*u,m=S.meta;
    cx.strokeStyle=ill?'#1B2A20':'#111';cx.lineWidth=1.6*u;cx.beginPath();cx.moveTo(pad.l,y0);cx.lineTo(W-pad.r,y0);cx.stroke();
    txt(cx,m.name||'Untitled project',pad.l,y0+26*u,{size:26*u,f:FD,w:700});
    txt(cx,'Prepared for '+(m.client||'client')+(m.address?' · '+m.address:''),pad.l,y0+54*u,{size:13*u,col:'#566559'});
    txt(cx,m.company||'',W/2,y0+26*u,{size:15*u,w:700,align:'center'});txt(cx,m.contact||'',W/2,y0+48*u,{size:12.5*u,align:'center',col:'#566559'});
    const sunT=sunVec();txt(cx,'LANDSCAPE PLAN',W-pad.r,y0+20*u,{size:11*u,w:700,align:'right',col:'#566559'});
    txt(cx,fmtDate(m.date),W-pad.r,y0+40*u,{size:13*u,align:'right'});
    txt(cx,'Lot '+S.lot.w+' × '+S.lot.d+' ft · north up'+(o.shadows&&sunT.alt>2?' · shadows '+fmtHour(S.sun.hour):''),W-pad.r,y0+60*u,{size:12*u,align:'right',col:'#566559'});
  }
  cx.restore();
  return{k0,cx0,cy0,dr};
}

/* ---- stage view ---- */
function drawStage2D(){
  const W=cv2.width,H=cv2.height;if(!W||!H||!S)return;
  const dp=W/Math.max(1,stageEl.clientWidth),sb=stageEl.getBoundingClientRect(),top=document.querySelector('.ov-top').getBoundingClientRect(),sunEl=document.querySelector('.sunbar'),sn=sunEl.getBoundingClientRect(),sunOn=getComputedStyle(sunEl).display!=='none';
  const r=ui.r2;
  R2L=drawSheet(cv2.getContext('2d'),W,H,{style:r.style,labels:r.labels,shadows:r.shadows,legend:r.legend,dims:r.dims,u:dp,legMin:700*dp,view:R2V,pad:{t:Math.max(16,top.bottom-sb.top+8)*dp,b:Math.max(16,sunOn?sb.bottom-sn.top+8:12)*dp,l:14*dp,r:14*dp}});
}
function r2Zoom(f,mx,my){
  if(!R2L)return;const z1=R2V.zoom,z2=Math.max(0.5,Math.min(14,z1*f)),k=z2/z1;
  if(mx==null){mx=R2L.dr.x+R2L.dr.w/2;my=R2L.dr.y+R2L.dr.h/2;}
  R2V.px=mx-R2L.cx0-(mx-R2L.cx0-R2V.px)*k;R2V.py=my-R2L.cy0-(my-R2L.cy0-R2V.py)*k;R2V.zoom=z2;invalidate();
}
function r2Fit(){R2V.zoom=1;R2V.px=0;R2V.py=0;invalidate();}
const r2Ptr=new Map();let r2Pinch=0;
cv2.addEventListener('pointerdown',e=>{try{cv2.setPointerCapture(e.pointerId);}catch(x){}r2Ptr.set(e.pointerId,[e.clientX,e.clientY]);cv2.classList.add('drag');r2Pinch=0;});
cv2.addEventListener('pointermove',e=>{
  if(!r2Ptr.has(e.pointerId))return;const prev=r2Ptr.get(e.pointerId);r2Ptr.set(e.pointerId,[e.clientX,e.clientY]);
  const dp=cv2.width/Math.max(1,cv2.clientWidth);
  if(r2Ptr.size===1){R2V.px+=(e.clientX-prev[0])*dp;R2V.py+=(e.clientY-prev[1])*dp;invalidate();}
  else if(r2Ptr.size===2){const a=[...r2Ptr.values()],d=Math.hypot(a[0][0]-a[1][0],a[0][1]-a[1][1]),rc=cv2.getBoundingClientRect();
    if(r2Pinch)r2Zoom(d/r2Pinch,((a[0][0]+a[1][0])/2-rc.left)*dp,((a[0][1]+a[1][1])/2-rc.top)*dp);r2Pinch=d;}
});
['pointerup','pointercancel'].forEach(t=>cv2.addEventListener(t,e=>{r2Ptr.delete(e.pointerId);r2Pinch=0;if(!r2Ptr.size)cv2.classList.remove('drag');}));
cv2.addEventListener('wheel',e=>{e.preventDefault();const dp=cv2.width/Math.max(1,cv2.clientWidth),rc=cv2.getBoundingClientRect();r2Zoom(Math.exp(-e.deltaY*0.0016),(e.clientX-rc.left)*dp,(e.clientY-rc.top)*dp);},{passive:false});
cv2.addEventListener('dblclick',r2Fit);

/* ---- controls ---- */
function syncR2UI(){
  document.querySelectorAll('#r2Style button').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.s===ui.r2.style)));
  [['r2Labels','labels'],['r2Shadows','shadows'],['r2Legend','legend'],['r2Dims','dims']].forEach(a=>$(a[0]).setAttribute('aria-pressed',String(ui.r2[a[1]])));
}
$('r2Style').addEventListener('click',e=>{const b=e.target.closest('[data-s]');if(!b)return;ui.r2.style=b.dataset.s;syncR2UI();invalidate();});
[['r2Labels','labels'],['r2Shadows','shadows'],['r2Legend','legend'],['r2Dims','dims']].forEach(a=>$(a[0]).addEventListener('click',()=>{ui.r2[a[1]]=!ui.r2[a[1]];syncR2UI();invalidate();}));
$('r2In').addEventListener('click',()=>r2Zoom(1.35));$('r2Out').addEventListener('click',()=>r2Zoom(1/1.35));$('r2Fit').addEventListener('click',r2Fit);
function renderSheetCanvas(W,H,o){const c=document.createElement('canvas');c.width=W;c.height=H;drawSheet(c.getContext('2d'),W,H,o);return c;}
function capture2D(style){
  return renderSheetCanvas(1600,1000,{style:style||ui.r2.style,labels:true,shadows:ui.r2.shadows,legend:true,dims:true,u:1.35,legMin:0}).toDataURL('image/jpeg',0.9);
}
$('r2Save').addEventListener('click',()=>{
  const c=renderSheetCanvas(2400,1600,{style:ui.r2.style,labels:ui.r2.labels,shadows:ui.r2.shadows,legend:true,dims:ui.r2.dims,u:2,titleBlock:true,legMin:0});
  c.toBlob(b=>{if(b)saveFile(slug(S.meta.name)+'-plan.png',b);},'image/png');
});
syncR2UI();
/* ===== Plotline: projects, proposal, files, boot ===== */
function afterLoad(keepSel){
  $('pname').value=S.meta.name;$('lotW').value=S.lot.w;$('lotD').value=S.lot.d;$('latIn').value=S.lot.lat;
  $('snapSel').value=String(S.snap);$('sunMonth').value=String(S.sun.month);$('sunHour').value=S.sun.hour;
  $('inMarkup').value=S.meta.markup;$('inTax').value=S.meta.tax;
  applyLook(S.look);buildLot();rebuildAll();applySun();
  if(!keepSel||!getSel())selId=null;
  buildSelection();renderInspector();renderCustom();renderLib();renderPrices();updateEstimate();updateStatus();
}
function slug(s){return String(s||'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'').slice(0,60)||'project';}

/* ---- file saving (downloads capability) ---- */
const DL={save:async({filename,data})=>{const blob=data instanceof Blob?data:new Blob([data],{type:'text/plain;charset=utf-8'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=filename;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),4000);return{status:'saved'};}};
async function saveFile(name,data){
  try{await DL.save({filename:name,data});toast('Saved '+name);}
  catch(err){toast('Could not save the file.');}
}
function refreshDLUI(){['btnSaveHtml','btnSaveCsv','r2Save'].forEach(id=>{$(id).disabled=false;$(id).title='';});}
refreshDLUI();

/* ---- projects menu ---- */
let pendingDelete=null;
function sortedIds(){return Object.keys(store.projects).sort((a,b)=>(store.projects[b].updated||0)-(store.projects[a].updated||0));}
function renderMenu(){
  let h=sortedIds().map(id=>{
    const p=store.projects[id],n=Array.isArray(p.objects)?p.objects.length:0,nm=(p.meta&&p.meta.name)||'Untitled project';
    return '<div class="pitem" data-id="'+esc(id)+'" role="button" tabindex="0" aria-current="'+(id===S.id)+'"><span class="pn">'+esc(nm)+'</span><span class="ps">'+n+' items · '+esc(new Date(p.updated||0).toLocaleDateString())+'</span><span class="pact"><button class="btn sm danger" data-del="'+esc(id)+'">'+(pendingDelete===id?'Confirm':'Delete')+'</button></span></div>';
  }).join('');
  h+='<hr><div class="mrow"><button class="btn sm" data-m="new">New blank</button><button class="btn sm" data-m="sample">New from sample</button><button class="btn sm" data-m="dup">Duplicate this</button></div>';
  h+='<div class="mrow"><button class="btn sm" data-m="export">Export file</button><button class="btn sm" data-m="import">Import file</button></div>';
  $('projMenu').innerHTML=h;
}
function openMenu(){pendingDelete=null;renderMenu();$('projMenu').hidden=false;$('projBtn').setAttribute('aria-expanded','true');}
function closeMenu(){$('projMenu').hidden=true;$('projBtn').setAttribute('aria-expanded','false');pendingDelete=null;}
$('projBtn').addEventListener('click',()=>{if($('projMenu').hidden)openMenu();else closeMenu();});
document.addEventListener('click',e=>{if(!$('projMenu').hidden&&!e.target.closest('.menu-wrap'))closeMenu();});
function switchTo(ns,toastMsg){
  setTool({mode:'select'});S=ns;store.projects[S.id]=S;store.cur=S.id;resetHistory();afterLoad(false);setView(view,true);
  S.updated=Date.now();persist();setSaveState('Saved on this device');closeMenu();if(toastMsg)toast(toastMsg);
}
function openProject(id){const p=store.projects[id];if(!p)return;switchTo(normalizeState(p));}
function deleteProject(id){
  delete store.projects[id];pendingDelete=null;
  if(S.id===id){const rest=sortedIds();if(rest.length)openProject(rest[0]);else switchTo(blankState('Untitled project'));}
  persist();renderMenu();
}
$('projMenu').addEventListener('click',e=>{
  const del=e.target.closest('[data-del]');
  if(del){e.stopPropagation();const id=del.dataset.del;if(pendingDelete===id)deleteProject(id);else{pendingDelete=id;renderMenu();}return;}
  const m=e.target.closest('[data-m]');
  if(m){
    const a=m.dataset.m;
    if(a==='new')switchTo(blankState('Untitled project'),'Started a blank project.');
    else if(a==='sample')switchTo(sampleState(),'Loaded the sample backyard.');
    else if(a==='dup'){const n=normalizeState(JSON.parse(JSON.stringify(S)));n.id=uid();n.meta.name=(n.meta.name+' copy').slice(0,80);switchTo(n,'Duplicated.');}
    else if(a==='export')saveFile(slug(S.meta.name)+'.json',JSON.stringify(S,null,1));
    else if(a==='import')$('importFile').click();
    return;
  }
  const it=e.target.closest('[data-id]');if(it)openProject(it.dataset.id);
});
$('projMenu').addEventListener('keydown',e=>{if(e.key==='Enter'){const it=e.target.closest&&e.target.closest('.pitem');if(it&&e.target===it)openProject(it.dataset.id);}});
$('importFile').addEventListener('change',e=>{
  const f=e.target.files&&e.target.files[0];e.target.value='';if(!f)return;
  if(f.size>5*1024*1024){toast('That file is too large to be a Plotline project.');return;}
  const rd=new FileReader();
  rd.onload=()=>{
    try{const raw=JSON.parse(String(rd.result));if(!raw||!Array.isArray(raw.objects)||!raw.lot)throw new Error('shape');const n=normalizeState(raw);n.id=uid();switchTo(n,'Imported '+n.meta.name+'.');}
    catch(err){toast('That file is not a Plotline project.');}
  };
  rd.onerror=()=>toast('Could not read that file.');
  rd.readAsText(f);
});

/* ---- proposal ---- */
const PP_CSS='.pp{background:#fff;color:#1B2A20;font:14px/1.5 "Instrument Sans",system-ui,-apple-system,"Segoe UI",sans-serif;max-width:860px;margin:0 auto;padding:44px 48px}'
+'.pp *{box-sizing:border-box}'
+'.pp-head{display:flex;justify-content:space-between;gap:24px;align-items:flex-start;border-bottom:2px solid #1B2A20;padding-bottom:14px}'
+'.pp-co{font:700 22px "Bricolage Grotesque",system-ui,sans-serif;letter-spacing:-.01em}'
+'.pp-sub{color:#5C6A5F;font-size:13px;white-space:pre-line}'
+'.pp-meta{text-align:right;font-size:13px;color:#5C6A5F}'
+'.pp-kicker{font:600 11px "Instrument Sans",system-ui,sans-serif;text-transform:uppercase;letter-spacing:.12em;color:#2D6A4F;margin-bottom:2px}'
+'.pp-title{font:700 34px/1.1 "Bricolage Grotesque",system-ui,sans-serif;letter-spacing:-.02em;margin:26px 0 6px}'
+'.pp-for{color:#5C6A5F;margin:0 0 6px}'
+'.pp h2{font:700 12px "Instrument Sans",system-ui,sans-serif;text-transform:uppercase;letter-spacing:.12em;color:#2D6A4F;margin:28px 0 8px;border-bottom:1px solid #D5DCCF;padding-bottom:4px}'
+'.pp figure{margin:0 0 14px}'
+'.pp img{display:block;width:100%;height:auto;border:1px solid #D5DCCF;border-radius:4px}'
+'.pp figcaption{font-size:12px;color:#5C6A5F;margin-top:4px}'
+'.pp-scope{white-space:pre-line;margin:0}'
+'.pp .tw{overflow-x:auto}'
+'.pp table{width:100%;border-collapse:collapse;font-size:13.5px}'
+'.pp th{text-align:left;font:600 11px "Instrument Sans",system-ui,sans-serif;text-transform:uppercase;letter-spacing:.08em;color:#5C6A5F;border-bottom:1px solid #1B2A20;padding:6px}'
+'.pp th.n{text-align:right}'
+'.pp td{padding:6px;border-bottom:1px solid #E6EBE1;vertical-align:top}'
+'.pp .n{text-align:right;font-variant-numeric:tabular-nums;white-space:nowrap}'
+'.pp tr.gr td{font:700 11px "Instrument Sans",system-ui,sans-serif;text-transform:uppercase;letter-spacing:.08em;color:#2D6A4F;background:#F3F6EF;border-bottom:0}'
+'.pp .tot{margin:12px 0 0 auto;width:min(320px,100%);font-variant-numeric:tabular-nums}'
+'.pp .tot div{display:flex;justify-content:space-between;padding:3px 0}'
+'.pp .tot .grand{border-top:2px solid #1B2A20;margin-top:6px;padding-top:8px;font:700 22px "Bricolage Grotesque",system-ui,sans-serif}'
+'.pp ul{margin:0;padding-left:18px}'
+'.pp .terms{font-size:12.5px;color:#3E4B41;white-space:pre-line;margin:0}'
+'.pp .sign{display:grid;grid-template-columns:1fr 1fr;gap:36px;margin-top:40px}'
+'.pp .sign div{border-top:1px solid #1B2A20;padding-top:4px;font-size:12px;color:#5C6A5F}'
+'.pp-foot{margin-top:32px;font-size:11px;color:#8A968C;text-align:center}'
+'.pp tr,.pp figure,.pp .sign{break-inside:avoid}'
+'@media (max-width:640px){.pp{padding:24px 18px}.pp-head{flex-direction:column}.pp-meta{text-align:left}.pp-title{font-size:26px}}'
+'@media print{.pp{padding:0;max-width:none}}';
(function(){const st=document.createElement('style');st.textContent=PP_CSS;document.head.appendChild(st);})();

let propOpen=false,propImgs={plan:'',persp:''},prevT=null;
function autoScope(){
  let trees=0,plants=0,feat=0,sf=0,lf=0;
  S.objects.forEach(o=>{
    const c=CAT[o.cat];if(c.excluded)return;
    if(c.kind==='point'){const n=o.count||1;if(c.group==='trees')trees+=n;else if(c.group==='plants')plants+=n;else feat+=n;}
    else if(c.kind==='area')sf+=polyArea(o.pts);else lf+=polyLen(o.pts);
  });
  const bits=[];
  if(trees)bits.push(trees+(trees===1?' tree':' trees'));
  if(plants)bits.push(plants+(plants===1?' shrub or perennial':' shrubs and perennials'));
  if(feat)bits.push(feat+(feat===1?' site feature':' site features'));
  if(sf>=1)bits.push('about '+Math.round(sf).toLocaleString('en-US')+' sq ft of lawn, beds and paving');
  if(lf>=1)bits.push(Math.round(lf)+' linear ft of fencing, walls and edging');
  if(!bits.length)return 'Landscape work as shown on the attached plan.';
  const list=bits.length>1?bits.slice(0,-1).join(', ')+', and '+bits[bits.length-1]:bits[0];
  return 'Supply and install the landscape shown on the attached plan for the '+S.lot.w+' by '+S.lot.d+' ft site: '+list+'.';
}
function proposalArticle(imgs){
  const m=S.meta,E=estimate(S),scope=(m.scope&&m.scope.trim())||autoScope();
  let rows='';
  E.groups.forEach(g=>{
    rows+='<tr class="gr"><td colspan="5">'+esc(g.g.name)+'</td></tr>';
    g.rows.forEach(r=>{rows+='<tr><td>'+esc(r.cat.name)+'</td><td class="n">'+fmtQ(r)+'</td><td>'+UNIT_LONG[r.cat.unit]+'</td><td class="n">'+money(r.clientUnit)+'</td><td class="n">'+money(r.total)+'</td></tr>';});
  });
  if(E.custom.length){
    rows+='<tr class="gr"><td colspan="5">Additional items</td></tr>';
    E.custom.forEach(c=>{rows+='<tr><td>'+esc(c.name)+'</td><td class="n">'+esc(c.qty)+'</td><td></td><td class="n">'+money(c.price)+'</td><td class="n">'+money(c.total)+'</td></tr>';});
  }
  const notes=S.objects.filter(o=>o.note&&o.note.trim()).map(o=>'<li><b>'+esc(o.label||CAT[o.cat].name)+'.</b> '+esc(o.note)+'</li>').join('');
  let h='<article class="pp">';
  h+='<header class="pp-head"><div><div class="pp-co">'+esc(m.company||'Your company name')+'</div><div class="pp-sub">'+esc(m.contact)+'</div></div><div class="pp-meta"><div class="pp-kicker">Landscape proposal</div><div>'+esc(fmtDate(m.date))+'</div><div>Valid for '+esc(m.valid)+' days</div></div></header>';
  h+='<h1 class="pp-title">'+esc(m.name)+'</h1>';
  h+='<p class="pp-for">Prepared for <b>'+esc(m.client||'Client name')+'</b>'+(m.address?' · '+esc(m.address):'')+'</p>';
  h+='<h2>Design</h2>';
  if(imgs.plan)h+='<figure><img alt="Rendered site plan of the proposed landscape" src="'+imgs.plan+'"><figcaption>Site plan, north is up. Lot '+S.lot.w+' × '+S.lot.d+' ft. Numbers match the key.</figcaption></figure>';
  if(imgs.persp)h+='<figure><img alt="3D view of the proposed landscape" src="'+imgs.persp+'"><figcaption>3D view ('+LOOKS[imgs.look==null?1:imgs.look].name.toLowerCase()+' rendering), shown with shadows for the chosen time of day.</figcaption></figure>';
  h+='<h2>Scope of work</h2><p class="pp-scope">'+esc(scope)+'</p>';
  if(notes)h+='<ul style="margin-top:10px">'+notes+'</ul>';
  h+='<h2>Investment</h2>';
  if(rows)h+='<div class="tw"><table><thead><tr><th>Item</th><th class="n">Qty</th><th>Unit</th><th class="n">Unit price</th><th class="n">Amount</th></tr></thead><tbody>'+rows+'</tbody></table></div>';
  else h+='<p>No priced items yet.</p>';
  h+='<div class="tot"><div><span>Subtotal</span><span>'+money(E.subtotal)+'</span></div>';
  if(m.tax>0)h+='<div><span>Tax ('+esc(m.tax)+'%)</span><span>'+money(E.tax)+'</span></div>';
  h+='<div class="grand"><span>Total</span><span>'+money(E.total)+'</span></div></div>';
  if(m.terms&&m.terms.trim())h+='<h2>Terms</h2><p class="terms">'+esc(m.terms)+'</p>';
  h+='<div class="sign"><div>Client signature and date</div><div>Contractor signature and date</div></div>';
  h+='<div class="pp-foot">Prepared with Plotline</div></article>';
  return h;
}
function proposalDocument(){
  return '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>'+esc(S.meta.name)+' proposal</title>'
    +'<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,700&family=Instrument+Sans:wght@400;500;600&display=swap">'
    +'<style>body{margin:0;background:#EEF1EA}@media print{body{background:#fff}}'+PP_CSS+'</style></head><body>'+proposalArticle(propImgs)+'</body></html>';
}
function csvCell(v){v=String(v==null?'':v);if(/^[=+\-@\t\r]/.test(v))v="'"+v;return /[",\r\n]/.test(v)?'"'+v.replace(/"/g,'""')+'"':v;}
function csvText(){
  const E=estimate(S),rows=[['Group','Item','Qty','Unit','Unit price','Amount']];
  E.groups.forEach(g=>g.rows.forEach(r=>rows.push([g.g.name,r.cat.name,fmtQ(r).replace(/,/g,''),r.cat.unit,r.clientUnit.toFixed(2),r.total.toFixed(2)])));
  E.custom.forEach(c=>rows.push(['Additional items',c.name,c.qty,'ea',c.price.toFixed(2),c.total.toFixed(2)]));
  rows.push(['','Subtotal','','','',E.subtotal.toFixed(2)]);
  if(S.meta.tax>0)rows.push(['','Tax '+S.meta.tax+'%','','','',E.tax.toFixed(2)]);
  rows.push(['','Total','','','',E.total.toFixed(2)]);
  return rows.map(r=>r.map(csvCell).join(',')).join('\r\n');
}
function renderPreview(){$('propPreview').innerHTML=proposalArticle(propImgs);}
function fillForm(){document.querySelectorAll('#propForm [data-m]').forEach(el=>{const v=S.meta[el.dataset.m];el.value=v==null?'':v;});}
const propOpts={plan:'ill',look:-1};
function makeImgs(){
  const prev=Q,want=propOpts.look<0?prev:propOpts.look,imgs={plan:capture2D(propOpts.plan),look:want};
  if(want!==prev){applyLook(want);buildLot();rebuildAll();applySun();refreshMaterials();}
  imgs.persp=capture('persp');
  if(want!==prev){applyLook(prev);buildLot();rebuildAll();applySun();buildSelection();refreshMaterials();}
  invalidate();return imgs;
}
function openProposal(){
  setTool({mode:'select'});select(null);
  propImgs=makeImgs();
  fillForm();$('pf-planstyle').value=propOpts.plan;$('pf-look').value=String(propOpts.look);
  propOpen=true;$('propOverlay').hidden=false;renderPreview();$('btnPropClose').focus();
}
function closeProposal(){propOpen=false;$('propOverlay').hidden=true;invalidate();}
$('propBtn').addEventListener('click',openProposal);
$('btnPropClose').addEventListener('click',closeProposal);
$('propForm').addEventListener('submit',e=>e.preventDefault());
$('propForm').addEventListener('input',e=>{
  const k=e.target.dataset&&e.target.dataset.m;if(!k)return;
  S.meta[k]=k==='valid'?Math.round(num(e.target.value,30,1,365)):e.target.value;
  clearTimeout(prevT);prevT=setTimeout(renderPreview,150);
});
$('propForm').addEventListener('change',e=>{if(e.target.dataset&&e.target.dataset.m){if(e.target.dataset.m==='date'&&!e.target.value){S.meta.date=todayISO();e.target.value=S.meta.date;renderPreview();}commit();}});
$('pf-planstyle').addEventListener('change',e=>{propOpts.plan=e.target.value;propImgs=makeImgs();renderPreview();});
$('pf-look').addEventListener('change',e=>{propOpts.look=+e.target.value;propImgs=makeImgs();renderPreview();});
$('btnFillScope').addEventListener('click',()=>{S.meta.scope=autoScope();$('pf-scope').value=S.meta.scope;renderPreview();commit();});
$('btnSaveHtml').addEventListener('click',()=>saveFile(slug(S.meta.name)+'-proposal.html',proposalDocument()));
$('btnSaveCsv').addEventListener('click',()=>saveFile(slug(S.meta.name)+'-items.csv',csvText()));

/* ---- boot ---- */
(function boot(){
  const had=loadStore();
  if(had&&store.cur&&store.projects[store.cur])S=normalizeState(store.projects[store.cur]);
  else if(had&&Object.keys(store.projects).length)S=normalizeState(store.projects[sortedIds()[0]]);
  else S=sampleState();
  store.projects[S.id]=S;store.cur=S.id;
  renderCats();resize();
  afterLoad(false);resetHistory();
  setTool({mode:'select'});setView('persp',true);
  showPanel('library');setRTab('inspect');
  setSaveState(persist()?'Saved on this device':'Not saved: browser storage is blocked');
  loop();
  if(!had)toast('Sample backyard loaded. Pick an item from the library to add your own.');
})();
})();
