'use strict';
(()=>{
const game=new TacticsGame(),canvas=document.querySelector('#board'),ctx=canvas.getContext('2d'),$=id=>document.getElementById(id),S=TT.cell;
ctx.setTransform(2,0,0,2,0,0);ctx.imageSmoothingEnabled=true;
const reducedMotion=matchMedia('(prefers-reduced-motion: reduce)').matches;
let mode='move',target=null,feedback='',fx=[],animations=new Map(),last=0,clock=0,uiKey='';
const atlas=new Image(),unitArt=document.createElement('canvas');let artReady=false;atlas.onload=()=>{gradeMaterial(atlas,unitArt,1.22,1.08,.92);artReady=true;uiKey='';};atlas.src='assets/tactics-units-v1.webp';
const crops=[[139,9,302,558],[584,9,302,558],[171,582,227,425],[615,582,229,425],[181,1027,216,447],[628,1027,217,452]];
// Grade cached pixels rather than relying on Canvas filter support on phones.
function gradeMaterial(image,out,brightness,contrast,saturation,soften=false){
 const work=document.createElement('canvas');work.width=soften?648:image.width;work.height=soften?864:image.height;const c=work.getContext('2d');c.drawImage(image,0,0,work.width,work.height);
 let pixels;try{pixels=c.getImageData(0,0,work.width,work.height);}catch{
  // Direct file:// launches may prohibit pixel reads; keep artwork playable.
  out.width=soften?864:image.width;out.height=soften?1152:image.height;const oc=out.getContext('2d');oc.filter=`brightness(${brightness}) contrast(${contrast}) saturate(${saturation})`;oc.drawImage(work,0,0,out.width,out.height);return;
 }const d=pixels.data;
 for(let i=0;i<d.length;i+=4){const r=(d[i]*brightness-128)*contrast+128,g=(d[i+1]*brightness-128)*contrast+128,b=(d[i+2]*brightness-128)*contrast+128,l=.2126*r+.7152*g+.0722*b;d[i]=l+(r-l)*saturation;d[i+1]=l+(g-l)*saturation;d[i+2]=l+(b-l)*saturation;}
 c.putImageData(pixels,0,0);out.width=soften?864:image.width;out.height=soften?1152:image.height;const oc=out.getContext('2d');oc.imageSmoothingEnabled=true;oc.imageSmoothingQuality='high';oc.drawImage(work,0,0,out.width,out.height);
}
const noise=(a,b)=>{const n=Math.sin(a*12.9898+b*78.233)*43758.5453;return n-Math.floor(n);};
function rect(c,x,y,w,h,r,color){c.fillStyle=color;c.beginPath();c.roundRect(x,y,w,h,r);c.fill();}
function oval(c,x,y,rx,ry,color){c.fillStyle=color;c.beginPath();c.ellipse(x,y,rx,ry,0,0,Math.PI*2);c.fill();}
const ground=document.createElement('canvas');ground.width=432;ground.height=576;const gc=ground.getContext('2d');const earth=gc.createLinearGradient(0,0,432,576);earth.addColorStop(0,'#677553');earth.addColorStop(.5,'#6e7850');earth.addColorStop(1,'#4d6349');gc.fillStyle=earth;gc.fillRect(0,0,432,576);
for(let i=0;i<700;i++){const x=noise(i,1)*432,y=noise(i,2)*576;oval(gc,x,y,3+noise(i,3)*17,2+noise(i,4)*13,i%2?'#a39a6621':'#263b2b20');}
gc.strokeStyle='#aa99756b';gc.lineWidth=29;gc.beginPath();gc.moveTo(218,-20);gc.bezierCurveTo(200,150,236,300,214,600);gc.stroke();gc.strokeStyle='#c0aa7c25';gc.lineWidth=3;for(const dx of [-9,9]){gc.beginPath();gc.moveTo(218+dx,0);gc.bezierCurveTo(200+dx,150,236+dx,300,214+dx,576);gc.stroke();}
for(let y=0;y<576;y+=3)for(let x=0;x<432;x+=3){const n=noise(x,y);gc.fillStyle=n>.5?'#e9d8a821':'#142e241f';gc.fillRect(x+n*2,y+noise(y,x)*2,1+n,1);}
function proceduralFeature(t){const x=t.x*S,y=t.y*S,n=noise(t.x,t.y);
 if(t.crater){oval(ctx,x+24,y+25,19,16,'#394233');oval(ctx,x+23,y+24,14,11,'#554b38');ctx.strokeStyle='#baa37d69';ctx.lineWidth=2;ctx.beginPath();ctx.ellipse(x+23,y+24,16,13,-.2,.15,Math.PI);ctx.stroke();}
 if(t.kind==='rubble'){for(let i=0;i<12;i++){const xx=x+8+noise(i,t.x+3)*30,yy=y+7+noise(i,t.y+9)*32;rect(ctx,xx,yy,3+noise(i,8)*7,4,1,i%2?'#91856c':'#5b5d4e');}return;}
 if(t.hp<=0)return;
 if(t.kind==='building'){
  rect(ctx,x+5,y+11,38,32,2,'#152b206b');rect(ctx,x+8,y+5,33,36,1,'#656d5d');rect(ctx,x+9,y+6,31,34,1,'#858a70');
  ctx.fillStyle='#a1a18a';ctx.beginPath();ctx.moveTo(x+9,y+6);ctx.lineTo(x+25,y+11);ctx.lineTo(x+25,y+35);ctx.lineTo(x+9,y+40);ctx.fill();ctx.fillStyle='#676e5c';ctx.beginPath();ctx.moveTo(x+40,y+6);ctx.lineTo(x+25,y+11);ctx.lineTo(x+25,y+35);ctx.lineTo(x+40,y+40);ctx.fill();
  ctx.strokeStyle='#3e4c3c';ctx.lineWidth=1;for(let i=0;i<7;i++){ctx.beginPath();ctx.moveTo(x+10,y+8+i*5);ctx.lineTo(x+24,y+12+i*3);ctx.moveTo(x+26,y+12+i*3);ctx.lineTo(x+39,y+8+i*5);ctx.stroke();}rect(ctx,x+29,y+13,7,8,1,'#343f36');
 }else if(t.kind==='rock'){
  oval(ctx,x+22,y+29,19,13,'#17291d66');ctx.fillStyle='#7f8270';ctx.beginPath();ctx.moveTo(x+8,y+12);ctx.lineTo(x+29,y+6);ctx.lineTo(x+42,y+22);ctx.lineTo(x+33,y+39);ctx.lineTo(x+12,y+37);ctx.closePath();ctx.fill();ctx.fillStyle='#aaa68e';ctx.beginPath();ctx.moveTo(x+8,y+12);ctx.lineTo(x+29,y+6);ctx.lineTo(x+32,y+22);ctx.lineTo(x+16,y+25);ctx.fill();
 }else if(t.kind==='tree'){
  oval(ctx,x+19,y+30,20,14,'#10291d55');oval(ctx,x+24,y+23,17,17,'#304f32');
  for(let i=0;i<75;i++){const a=noise(i,t.x+2)*Math.PI*2,r=Math.sqrt(noise(i,t.y+8))*17,xx=x+24+Math.cos(a)*r,yy=y+23+Math.sin(a)*r;oval(ctx,xx,yy,2+noise(i,3)*4,2+noise(i,5)*3,xx+yy<x+y+46?'#466d3e':i%3===0?'#a1a16a':i%2?'#7e8e50':'#5c7d42');}
 }else if(t.kind==='sandbag'){
  for(let i=0;i<5;i++){rect(ctx,x+6+i*7,y+21,9,8,3,'#3b472e77');rect(ctx,x+6+i*7,y+18,9,7,3,i%2?'#a49c70':'#b6aa78');}
 }
 if(t.hp<TT[t.kind==='sandbag'?'sandbagHP':t.kind+'HP']){rect(ctx,x+9,y+42,30,3,1,'#24362c');rect(ctx,x+9,y+42,30*t.hp/TT[t.kind==='sandbag'?'sandbagHP':t.kind+'HP'],3,1,'#d4b37d');}
}
// Runtime art is cosmetic: every prop is anchored to its original collision tile.
const terrainArt=new Image(),propArt=new Image(),quietGround=document.createElement('canvas'),coverArt=document.createElement('canvas');let terrainReady=false,propsReady=false;
// Cache the material grading once: ground recedes, interactive silhouettes retain detail.
terrainArt.onload=()=>{gradeMaterial(terrainArt,quietGround,.79,.95,.75,true);const c=quietGround.getContext('2d');c.fillStyle='#263b4918';c.fillRect(0,0,864,1152);terrainReady=true;};terrainArt.src='assets/tactics-ground-v3.webp';
propArt.onload=()=>{gradeMaterial(propArt,coverArt,1.18,1.12,.85);propsReady=true;};propArt.src='assets/tactics-cover-v2.webp';
const propCrops=Array.from({length:6},(_,i)=>[i%2*256,Math.floor(i/2)*256,256,256]); // Equal atlas cells, with transparent margins.
function feature(t){
 if(!propsReady){proceduralFeature(t);return;}
 const x=t.x*S,y=t.y*S;
 function sprite(index,size){const crop=propCrops[index];if(!crop)return;ctx.drawImage(coverArt,...crop,x+24-size/2,y+24-size/2,size,size);}
 if(t.crater)sprite(5,46);
 if(t.kind==='rubble'){sprite(4,46);return;}
 if(t.hp<=0)return;
 const index={building:0,rock:1,tree:2,sandbag:3}[t.kind];
 if(index===undefined)return;
 // Short unified contact shadows keep the props and units seated on the ground.
 shadow(x+28,y+30,t.kind==='sandbag'?23:25,t.kind==='sandbag'?10:23);
 sprite(index,t.kind==='tree'?48:47);
 const maxHP=TT[t.kind==='sandbag'?'sandbagHP':t.kind+'HP'];
 if(t.hp<maxHP){
  ctx.save();ctx.beginPath();ctx.rect(x+6,y+6,36,34);ctx.clip();
  ctx.strokeStyle='#241f1c99';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(x+17,y+7);ctx.lineTo(x+22,y+18);ctx.lineTo(x+18,y+24);ctx.lineTo(x+28,y+34);ctx.stroke();ctx.restore();
  rect(ctx,x+9,y+42,30,3,1,'#24362c');rect(ctx,x+9,y+42,30*t.hp/maxHP,3,1,'#d4b37d');
 }
}
const shadowStamp=document.createElement('canvas');shadowStamp.width=96;shadowStamp.height=96;{const c=shadowStamp.getContext('2d'),g=c.createRadialGradient(48,48,3,48,48,48);g.addColorStop(0,'#050e18c9');g.addColorStop(.5,'#08121b70');g.addColorStop(1,'#08121b00');c.fillStyle=g;c.fillRect(0,0,96,96);}
function shadow(x,y,rx,ry){ctx.drawImage(shadowStamp,x-rx,y-ry,rx*2,ry*2);}
const portraits=new Map();
function portrait(kind){if(!artReady)return '';if(portraits.has(kind))return portraits.get(kind);const c=document.createElement('canvas');c.width=c.height=96;const cc=c.getContext('2d'),crop=crops[['tank','gunner','rocket'].indexOf(kind)*2];cc.drawImage(unitArt,...crop,kind==='tank'?25:26,2,kind==='tank'?46:44,90);let url='';try{url=c.toDataURL();}catch{}portraits.set(kind,url);return url;}
function brackets(x,y,size,color){ctx.strokeStyle=color;ctx.lineWidth=1.6;ctx.beginPath();for(const [dx,dy] of [[-1,-1],[1,-1],[-1,1],[1,1]]){const xx=x+dx*size,yy=y+dy*size;ctx.moveTo(xx-dx*7,yy);ctx.lineTo(xx,yy);ctx.lineTo(xx,yy-dy*7);}ctx.stroke();}
function drawUnit(u){
 let px=u.x*S+24,py=u.y*S+24,angle=u.facing;const animation=animations.get(u.id);
 if(animation){const f=Math.min(animation.path.length-.001,animation.age/TT.moveDelay),i=Math.floor(f),part=f-i,from=i===0?animation.from:animation.path[i-1],to=animation.path[i];px=(from.x+(to.x-from.x)*part)*S+24;py=(from.y+(to.y-from.y)*part)*S+24;angle=Math.atan2(to.x-from.x,from.y-to.y);}
 if(u.hp<=0){shadow(px+2,py+3,24,20);if(artReady&&u.kind==='tank'){ctx.save();ctx.translate(px,py);ctx.rotate(angle);ctx.globalAlpha=.65;ctx.drawImage(unitArt,...crops[u.side],-15,-25,30,50);ctx.fillStyle='#151818a0';ctx.fillRect(-10,-10,20,25);ctx.restore();}else for(let i=0;i<5;i++)rect(ctx,px-12+noise(i,u.id)*22,py-9+noise(i,u.id+8)*17,5,4,1,'#4b4937');return;}
 const color=u.side?'#ffac8f':'#88f5e4',selected=u.id===game.selected;
 shadow(px+4,py+6,27,22);
 // Thin team arcs sit beneath the art; selection uses camera-style corner brackets.
 ctx.strokeStyle='#071321cc';ctx.lineWidth=4;ctx.beginPath();ctx.arc(px,py+1,21,.12*Math.PI,.88*Math.PI);ctx.stroke();ctx.strokeStyle=color;ctx.lineWidth=1.8;ctx.stroke();
 if(selected)brackets(px,py,23,'#c7fff2');
 ctx.save();ctx.translate(px,py);ctx.rotate(angle);
 if(artReady){const row=['tank','gunner','rocket'].indexOf(u.kind),crop=crops[row*2+u.side];if(u.kind==='tank')ctx.drawImage(unitArt,...crop,-15,-26,30,52);else for(const [dx,dy] of [[-10,7],[10,7],[0,-8]])ctx.drawImage(unitArt,...crop,dx-7.5,dy-15,15,30);}
 else if(u.kind==='tank'){rect(ctx,-15,-15,7,31,2,'#202c27');rect(ctx,8,-15,7,31,2,'#202c27');rect(ctx,-10,-16,20,32,3,u.side?'#a0805d':'#688477');rect(ctx,-7,-10,14,17,3,'#9b9d78');rect(ctx,-2,-25,4,19,1,'#c1ba93');}
 else for(const [dx,dy] of [[-10,6],[10,6],[0,-8]]){oval(ctx,dx,dy,5,8,u.side?'#a48162':'#7a9273');oval(ctx,dx,dy-3,4,4,'#aaa784');rect(ctx,dx+2,dy-13,2,12,1,'#293730');}
 ctx.restore();
 rect(ctx,px-13,py+22,26,3,1.5,'#07131ced');rect(ctx,px-13,py+22,26*u.hp/TACTICS_TYPES[u.kind].hp,3,1.5,color);
 const label=(u.side?'E':'')+(u.id%3+1)+' '+({tank:'TNK',gunner:'MG',rocket:'RKT'}[u.kind])+(u.used?' ✓':'');ctx.font='700 7px system-ui';ctx.textAlign='center';rect(ctx,px-22,py-33,44,10,3,'#091825e8');ctx.fillStyle=u.used?'#a3b4bc':color;ctx.fillText(label,px,py-25.5);
}
function impact(x,y,age,size=1){
 if(age<0)return;const life=Math.max(0,1-age/.7);if(!life)return;
 if(age<.18){const r=(5+age*72)*size,g=ctx.createRadialGradient(x,y,0,x,y,r);g.addColorStop(0,'#fff8d8');g.addColorStop(.25,'#ffd18ee0');g.addColorStop(1,'#f27a2c00');ctx.fillStyle=g;ctx.fillRect(x-r,y-r,r*2,r*2);}
 for(let i=0;i<7;i++){const a=noise(i,x+y)*Math.PI*2,d=age*(20+noise(i,3)*28)*size;oval(ctx,x+Math.cos(a)*d,y+Math.sin(a)*d-age*8*size,(3+age*9)*size,(2+age*7)*size,`rgba(113,113,99,${life*.23})`);if(age<.4){ctx.fillStyle=`rgba(246,188,115,${life*.8})`;ctx.fillRect(x+Math.cos(a)*d*1.4,y+Math.sin(a)*d*1.4,1.4,1.4);}}
}
function render(){ctx.drawImage(terrainReady?quietGround:ground,0,0,432,576);
 // Broad edge falloff adds depth without hiding terrain or changing tile rules.
 const shade=ctx.createRadialGradient(216,260,120,216,288,370);shade.addColorStop(0,'#18251c00');shade.addColorStop(1,'#07121f60');ctx.fillStyle=shade;ctx.fillRect(0,0,432,576);const sun=ctx.createLinearGradient(0,0,390,510);sun.addColorStop(0,'#f2cf7922');sun.addColorStop(.48,'#f2cf7900');sun.addColorStop(1,'#112b4212');ctx.fillStyle=sun;ctx.fillRect(0,0,432,576);
 if(game.phase==='deploy'){ctx.fillStyle='#58afba12';ctx.fillRect(0,(TT.rows-TT.deployRows)*S,432,TT.deployRows*S);ctx.strokeStyle='#94d9dbb0';ctx.setLineDash([4,5]);ctx.strokeRect(1,(TT.rows-TT.deployRows)*S,430,TT.deployRows*S-1);ctx.setLineDash([]);}
 const human=game.phase==='aim'&&game.side===0;
 if(human&&mode==='move')for(const p of game.reachable().values()){if(!p.path.length)continue;rect(ctx,p.x*S+2,p.y*S+2,S-4,S-4,6,'#80dcc62b');ctx.strokeStyle='#a5ffe24d';ctx.lineWidth=.8;ctx.strokeRect(p.x*S+3,p.y*S+3,S-6,S-6);oval(ctx,p.x*S+24,p.y*S+24,1.5,1.5,'#b8ede1b0');}
 if(human&&mode==='attack'){ctx.strokeStyle='#e8ca8a65';ctx.lineWidth=1;ctx.setLineDash([4,5]);ctx.beginPath();ctx.arc(game.active.x*S+24,game.active.y*S+24,TACTICS_TYPES[game.active.kind].range*S,0,Math.PI*2);ctx.stroke();ctx.setLineDash([]);for(let y=0;y<TT.rows;y++)for(let x=0;x<TT.cols;x++){const info=game.attackInfo(x,y);if(info.ok){rect(ctx,x*S+2,y*S+2,S-4,S-4,4,'#e0a26b22');ctx.strokeStyle='#e0b57570';ctx.strokeRect(x*S+3,y*S+3,S-6,S-6);}}}
 for(let y=0;y<TT.rows;y++)for(let x=0;x<TT.cols;x++){if(game.phase==='deploy'){ctx.strokeStyle='#b9d5db1a';ctx.lineWidth=.5;ctx.strokeRect(x*S,y*S,S,S);}else{ctx.fillStyle='#d7e6d52b';ctx.fillRect(x*S-.5,y*S-.5,1,1);}feature(game.tile(x,y));}
 if(target&&human){const u=game.active,info=game.attackInfo(target.x,target.y);if(mode==='air')for(const p of game.airFootprint(target.x,target.y)){rect(ctx,p.x*S+2,p.y*S+2,S-4,S-4,3,'#f49d7757');}else{const block=info.block,tx=(block?.x??target.x)*S+24,ty=(block?.y??target.y)*S+24;ctx.setLineDash([3,5]);ctx.strokeStyle=info.ok?'#ffe1a2':'#f7a08a';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(u.x*S+24,u.y*S+24);ctx.lineTo(tx,ty);ctx.stroke();ctx.setLineDash([]);}ctx.strokeStyle='#ffe0a1';ctx.lineWidth=2;ctx.strokeRect(target.x*S+4,target.y*S+4,S-8,S-8);}
 game.units.forEach(drawUnit);
 for(const f of fx){
  if(f.type==='shot'){const k=Math.min(1,f.age/.18),ox=f.from.x*S+24,oy=f.from.y*S+24,tx=f.x*S+24,ty=f.y*S+24;
   if(k<1){ctx.strokeStyle=f.kind==='gunner'?'#fff5c5':'#ffe5ae';ctx.lineWidth=f.kind==='gunner'?1.3:2;ctx.beginPath();ctx.moveTo(ox+(tx-ox)*Math.max(0,k-.25),oy+(ty-oy)*Math.max(0,k-.25));ctx.lineTo(ox+(tx-ox)*k,oy+(ty-oy)*k);ctx.stroke();}
   impact(tx,ty,f.age-.13,f.kind==='gunner'?.35:1);
  }else if(f.type==='damage'){ctx.font='800 12px system-ui';ctx.textAlign='center';ctx.strokeStyle='#071725';ctx.lineWidth=3;ctx.strokeText('−'+f.amount,f.x*S+24,f.y*S+12-f.age*20);ctx.fillStyle='#ffe9c0';ctx.fillText('−'+f.amount,f.x*S+24,f.y*S+12-f.age*20);}
  else if(f.type==='collapse'||f.type==='air')for(const p of f.cells||[{x:f.x,y:f.y}])impact(p.x*S+24,p.y*S+24,f.age);
 }
 // Sparse airborne dust is visual only and respects reduced-motion preferences.
 if(!reducedMotion)for(let i=0;i<12;i++){const x=(noise(i,6)*432+clock*(1+noise(i,2)*2))%432,y=(noise(i,7)*576-clock*1.3+576)%576;oval(ctx,x,y,.5+noise(i,4)*.5,.5,'#fce6b325');}

}
function consume(){for(const e of game.events.splice(0)){if(e.type==='restart'){fx=[];animations.clear();mode='move';target=null;feedback='';}else if(e.type==='move')animations.set(e.id,{...e,age:0});else if(['shot','damage','collapse','air'].includes(e.type))fx.push({...e,age:0});else if(e.type==='turn'){mode='move';target=null;feedback='';}}}
function ui(){const u=game.active,human=game.side===0&&game.phase==='aim',deploy=game.phase==='deploy',busy=['moving','resolve'].includes(game.phase);
 $('status').textContent=deploy?'DEPLOY YOUR FORCE':game.phase==='over'?game.result:game.side===1?'ENEMY ACTIVATION':busy?'ORDER IN PROGRESS':`YOUR ${TACTICS_TYPES[u.kind].short} · MOVE ${u.left}`;$('round').textContent='ROUND '+game.round;
 const stamp=JSON.stringify([game.phase,game.side,game.selected,game.committed,game.units.map(t=>[t.hp,t.used,t.left]),game.air,mode]);if(stamp!==uiKey){uiKey=stamp;for(const card of document.querySelectorAll('[data-unit]')){const t=game.units[+card.dataset.unit];card.disabled=!deploy&&(!human||t.used||t.hp<=0||game.committed&&t!==u);card.classList.toggle('active',t===u);const image=portrait(t.kind);card.innerHTML=`<span class="card-portrait" aria-hidden="true">${image?'<img src="'+image+'" alt="">':t.id+1}</span><span class="card-copy"><strong>${+card.dataset.unit+1} · ${TACTICS_TYPES[t.kind].short}</strong><small>${t.hp<=0?'DESTROYED':t.used?'DONE':t.hp+' HP · R'+TACTICS_TYPES[t.kind].range}</small><span class="bar" style="width:${Math.max(0,t.hp/TACTICS_TYPES[t.kind].hp*100)}%"></span></span>`;}}
 for(const id of ['move','attack','air','hold']){$(id).disabled=!human||id==='air'&&game.air[0]<=0;$(id).classList.toggle('active',id===mode);} $('air').textContent='AIR ×'+game.air[0];
 let help=deploy?'Select a squad, then tap a blue tile to reposition. Begin when ready.':game.side===1?'Enemy units use the same movement, range and cover rules.':busy?'Resolving your order…':mode==='move'?'Tap a green tile to move. Moving commits this squad; then attack or Hold.':mode==='air'?'Tap a strike row: three marked tiles. Confirm to call it. Allies can be hit.':'Tap an enemy or cover. Gold tiles can be attacked.';
 let canConfirm=false,confirm=deploy?'BEGIN BATTLE':mode==='air'?'CONFIRM AIRSTRIKE':mode==='attack'?'CONFIRM ATTACK':'SELECT A TARGET';
 if(target&&human&&mode==='attack'){const info=game.attackInfo(target.x,target.y);help=info.ok?`${info.target?TACTICS_TYPES[info.target.kind].name+' '+info.target.hp+' HP':info.tile.kind.toUpperCase()+' '+info.tile.hp+' HP'} · ${info.reason} · ${info.damage} damage${u.kind==='gunner'?'':' · blast affects adjacent tiles'}`:info.reason;canConfirm=info.ok;}
 if(target&&human&&mode==='air'){help='Airstrike: '+game.airFootprint(target.x,target.y).length+' tiles · '+TT.airDamage+' damage per tile · allies can be hit';canConfirm=game.air[0]>0;}
 $('help').textContent=feedback||help;$('confirm').textContent=confirm;$('confirm').disabled=!(deploy||human&&canConfirm);$('result').hidden=game.phase!=='over';$('resultTitle').textContent=game.result;$('resultCopy').textContent=`${game.round} rounds · ${game.units.filter(t=>t.side===0&&t.hp>0).length} friendly squads remaining.`;
}
function select(id){if(game.select(id)){mode='move';target=null;feedback='';}else feedback='Finish the active squad’s order first, or choose a ready squad.';ui();}
for(const card of document.querySelectorAll('[data-unit]'))card.onclick=()=>select(+card.dataset.unit);
for(const id of ['move','attack','air'])$(id).onclick=()=>{mode=id;target=null;feedback='';ui();};$('hold').onclick=()=>{game.hold();target=null;feedback='';consume();ui();};
$('confirm').onclick=()=>{let ok=false;if(game.phase==='deploy')ok=game.start();else if(target)ok=mode==='air'?game.callAir(target.x,target.y):game.attack(target.x,target.y);if(ok){target=null;feedback='';}consume();ui();};
function restart(){game.restart();consume();ui();}$('restart').onclick=$('again').onclick=restart;
canvas.addEventListener('pointerup',e=>{const r=canvas.getBoundingClientRect(),x=Math.floor((e.clientX-r.left)/r.width*TT.cols),y=Math.floor((e.clientY-r.top)/r.height*TT.rows);if(!game.inside(x,y))return;feedback='';const unit=game.unitAt(x,y);
 if(game.phase==='deploy'){if(unit?.side===0)select(unit.id);else if(!game.deploy(x,y))feedback='Deploy on an empty blue tile in your starting zone.';}
 else if(game.phase==='aim'&&game.side===0){if(unit?.side===0&&mode!=='air')select(unit.id);else if(mode==='air')target={x,y};else if(unit?.side===1){mode='attack';target={x,y};}else if(mode==='move'){if(!game.move(x,y))feedback='That tile cannot be reached with this squad’s remaining movement.';target=null;}else target={x,y};}
 consume();ui();});
function tick(dt){clock+=dt;game.update(dt);consume();for(const f of fx)f.age+=dt;fx=fx.filter(f=>f.age<.9);for(const [id,a] of animations){a.age+=dt;if(a.age>=a.path.length*TT.moveDelay)animations.delete(id);}}
function frame(ms){if(!last)last=ms;tick(Math.min((ms-last)/1000,.05));last=ms;ui();render();requestAnimationFrame(frame);}document.addEventListener('visibilitychange',()=>last=0);
window.tacticsDebug={game,tick:dt=>{tick(dt);ui();},getMode:()=>mode,getTarget:()=>target};consume();ui();requestAnimationFrame(frame);
})();

