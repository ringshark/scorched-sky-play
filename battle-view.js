'use strict';
// Rendering/controller only. Physics, weapons and turns live in battle.js.
(()=>{
const game=new BattleGame(),canvas=document.querySelector('#field'),ctx=canvas.getContext('2d'),mini=document.querySelector('#overview'),mc=mini.getContext('2d');
const $=id=>document.getElementById(id),angle=$('battleAngle'),power=$('battlePower'),target=$('target');
let camera=0,cameraTarget=0,follow=true,airArmed=false,airX=null,last=0,accumulator=0,version=-1,terrainRef=null,fx=[],traces=[],texts=[],planes=[],pointer=null,stamp='';
const terrainCanvas=document.createElement('canvas');terrainCanvas.width=BT.width;terrainCanvas.height=720;const tc=terrainCanvas.getContext('2d');
const hash=(a,b)=>{const n=Math.sin(a*12.9898+b*78.233)*43758.5453;return n-Math.floor(n);};
function rect(c,x,y,w,h,r,color){c.fillStyle=color;c.beginPath();c.roundRect(x,y,w,h,r);c.fill();}
function ellipse(c,x,y,rx,ry,color){c.fillStyle=color;c.beginPath();c.ellipse(x,y,rx,ry,0,0,Math.PI*2);c.fill();}
const sky=document.createElement('canvas');sky.width=1280;sky.height=720;const sc=sky.getContext('2d');
const gradient=sc.createLinearGradient(0,0,0,720);gradient.addColorStop(0,'#b4a5be');gradient.addColorStop(.5,'#f1b58f');gradient.addColorStop(1,'#ffdc9e');sc.fillStyle=gradient;sc.fillRect(0,0,1280,720);
const glow=sc.createRadialGradient(980,235,20,980,235,250);glow.addColorStop(0,'#fff4b887');glow.addColorStop(1,'#ffe2ab00');sc.fillStyle=glow;sc.fillRect(700,0,580,520);ellipse(sc,980,235,44,44,'#ffedbc');
for(let i=0;i<7;i++)ellipse(sc,i*211,155+i%3*30,115,7,'#ffdfb42a');
function bakeTerrain(){
 const terrain=game.terrain;tc.clearRect(0,0,BT.width,720);tc.fillStyle='#fff';
 for(let r=0;r<terrain.rows;r++)for(let c=0;c<terrain.cols;c++)if(terrain.data[r*terrain.cols+c])tc.fillRect(c*CT.cell,r*CT.cell,CT.cell,CT.cell);
 tc.globalCompositeOperation='source-in';const earth=tc.createLinearGradient(0,300,0,560);earth.addColorStop(0,'#e0ad77');earth.addColorStop(.4,'#bb805e');earth.addColorStop(1,'#785a65');tc.fillStyle=earth;tc.fillRect(0,0,BT.width,720);
 tc.globalCompositeOperation='source-atop';
 for(let layer=0;layer<7;layer++){const y=350+layer*32;tc.beginPath();tc.moveTo(0,y);for(let x=0;x<=BT.width;x+=16)tc.lineTo(x,y+Math.sin(x*.008+layer)*9);tc.lineTo(BT.width,y+20);tc.lineTo(0,y+20);tc.closePath();tc.fillStyle=layer%2?'#674a5d29':'#ffd19b22';tc.fill();}
 for(let x=15;x<BT.width;x+=41)for(let y=350;y<CT.bedrock;y+=29){const n=hash(x,y);if(n>.77){ellipse(tc,x,y,5+n*3,3+n,'#d8aa8299');}}
 tc.fillStyle='#625b70';tc.fillRect(0,CT.bedrock,BT.width,720);tc.fillStyle='#a4919a';tc.fillRect(0,CT.bedrock,BT.width,2);tc.globalCompositeOperation='source-over';
 for(let c=0;c<terrain.cols;c++){const x=c*CT.cell,y=terrain.floor(x,0),original=y===terrain.originalTop[c];tc.fillStyle=original?'#657252':'#d29c74';tc.fillRect(x,y,CT.cell,4);tc.fillStyle=original?'#c5ca89':'#f1c996';tc.fillRect(x,y,CT.cell,1);if(original&&c%9===0){tc.strokeStyle='#a3b372';tc.beginPath();tc.moveTo(x,y);tc.lineTo(x-2,y-4);tc.stroke();}}
 version=terrain.version;terrainRef=terrain;
}
function background(){ctx.drawImage(sky,0,0);for(let layer=0;layer<3;layer++){ctx.beginPath();ctx.moveTo(0,720);for(let x=0;x<=1290;x+=12)ctx.lineTo(x,310+layer*38+Math.sin((x+camera*(.08+layer*.06))*.007+layer)*35);ctx.lineTo(1280,720);ctx.closePath();ctx.fillStyle=['#baa2b0','#a28f9a','#8c8981'][layer];ctx.fill();}}
function buildings(){for(const b of game.buildings){if(b.hp<=0)continue;const x=b.x-b.width/2,y=b.y-b.height;
 rect(ctx,x-4,b.y-4,b.width+8,8,2,'#504451');rect(ctx,x,y,b.width,b.height,3,'#574853');const wall=ctx.createLinearGradient(x,y,x+b.width,b.y);wall.addColorStop(0,'#e3c095');wall.addColorStop(1,'#aa7f68');rect(ctx,x+3,y+3,b.width-6,b.height-3,1,wall);
 ctx.strokeStyle='#87665c66';for(let by=y+16;by<b.y;by+=13){ctx.beginPath();ctx.moveTo(x+3,by);ctx.lineTo(x+b.width-3,by);ctx.stroke();}
 ctx.fillStyle='#57485b';ctx.beginPath();ctx.moveTo(x-5,y+2);ctx.lineTo(b.x,y-CT.buildingRoof);ctx.lineTo(x+b.width+5,y+2);ctx.fill();ctx.strokeStyle='#ddaa82';ctx.lineWidth=3;ctx.stroke();
 for(const wx of [x+11,x+39]){rect(ctx,wx,y+18,14,17,2,'#635363');rect(ctx,wx+2,y+20,10,5,1,'#f3d8ab');}rect(ctx,b.x-8,b.y-23,16,23,1,'#735763');
 if(b.hp<CT.buildingHP){ctx.strokeStyle='#624755';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(b.x,y+3);ctx.lineTo(b.x-5,y+24);ctx.lineTo(b.x+6,y+32);ctx.lineTo(b.x-3,y+48);ctx.stroke();}
 }
 for(const pile of game.rubble)for(let i=0;i<CT.rubblePieces;i++){const n=hash(i,pile.id+2),x=pile.x+(n-.5)*CT.rubbleSpread,y=game.terrain.floor(x,0);rect(ctx,x,y-4,5+n*10,4+n*5,1,i%3?'#b58c79':'#645362');}
}
function tank(t){const light=t.side?'#ffc7ad':'#a7f1ff',dark=t.side?'#a84d51':'#267f9b';
 ctx.save();ctx.translate(t.x,t.y);ctx.rotate(t.tilt);ellipse(ctx,0,3,29,5,'#3c2d3c44');rect(ctx,-26,-16,52,19,7,'#343342');rect(ctx,-23,-13,46,13,5,'#1e2937');for(let x=-17;x<=17;x+=11){ellipse(ctx,x,-7,5,5,'#7d8a94');ellipse(ctx,x,-7,2.5,2.5,'#3b485e');}
 const armor=ctx.createLinearGradient(0,-40,0,-15);armor.addColorStop(0,light);armor.addColorStop(.3,t.color);armor.addColorStop(1,dark);rect(ctx,-25,-31,50,18,4,'#3c3b4c');rect(ctx,-23,-30,46,15,4,armor);rect(ctx,-17,-27,32,3,1,light);rect(ctx,-12,-42,25,16,5,armor);rect(ctx,-8,-44,17,4,1,'#3d4b5c');ctx.restore();
 ctx.save();ctx.translate(t.x,t.y-CT.tankHeight);ctx.rotate(-t.angle*Math.PI/180);rect(ctx,0,-6,CT.barrel,12,3,'#374153');rect(ctx,1,-4,CT.barrel-2,8,2,dark);rect(ctx,2,-4,CT.barrel-4,3,1,light);rect(ctx,CT.barrel-5,-7,8,14,2,'#3b4858');ctx.restore();
}
function infantry(t){const direction=t.side?-1:1,light=t.side?'#ffc2a1':'#a2e6f0',dark=t.side?'#995450':'#397d90';
 for(const [i,offset] of [-12,0,12].entries()){
  const x=t.x+offset,y=t.y+(i===1?-2:0);ellipse(ctx,x,y+1,8,3,'#3c2d3c55');rect(ctx,x-5,y-10,4,10,1,'#464253');rect(ctx,x+2,y-10,4,10,1,'#464253');rect(ctx,x-7,y-23,14,15,3,dark);rect(ctx,x-5,y-22,10,5,1,t.color);rect(ctx,x-4,y-31,9,9,3,'#ecc29d');rect(ctx,x-6,y-34,13,7,3,t.color);rect(ctx,x-7,y-29,15,3,1,dark);rect(ctx,x-3,y-19,6,6,1,light);
  ctx.save();ctx.translate(x,y-19);ctx.scale(direction,1);if(t.kind==='rocket'){rect(ctx,-9,-4,28,7,2,'#404455');rect(ctx,12,-5,7,9,1,'#a9ac86');}else{rect(ctx,0,-1,23,4,1,'#333a48');rect(ctx,9,2,5,5,1,'#48505b');}ctx.restore();
 }
}
function units(){for(const t of game.tanks){if(t.hp<=0){const y=game.terrain.floor(t.x,0);rect(ctx,t.x-17,y-10,34,10,3,'#514650');continue;}
 if(t.id===game.turn){ellipse(ctx,t.x,t.y+3,t.kind==='tank'?35:30,7,t.side?'#ffb18f70':'#90e8f58c');}
 if(t.kind==='tank')tank(t);else infantry(t);
 const top=t.y-76;rect(ctx,t.x-39,top,78,18,7,t.id===game.turn?'#2d5267':'#393d50');ctx.fillStyle=t.side?'#ffb8a1':'#a4edf5';ctx.font='800 10px system-ui';ctx.textAlign='center';ctx.fillText(UNIT_TYPES[t.kind].short,t.x,top+12);rect(ctx,t.x-30,top+22,60,5,2,'#36394b');rect(ctx,t.x-29,top+23,58*t.hp/UNIT_TYPES[t.kind].hp,3,1,t.color);ctx.fillStyle='#3f3549';ctx.font='800 10px system-ui';ctx.fillText(t.used?'DONE':t.hp+' HP',t.x,top+39);
}}
function render(){
 background();if(version!==game.terrain.version||terrainRef!==game.terrain)bakeTerrain();ctx.save();ctx.translate(-camera,0);ctx.drawImage(terrainCanvas,0,0);buildings();
 const active=game.active;if(active.side===0)for(const path of active.ghost){if(path.length<2)continue;ctx.setLineDash([4,10]);ctx.strokeStyle='#fff5de50';ctx.lineWidth=2;ctx.beginPath();path.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));ctx.stroke();ctx.setLineDash([]);}
 units();
 for(const p of game.projectiles){if(p.delay>0)continue;ellipse(ctx,p.x,p.y,p.kind==='air'?5:4,6,p.kind==='rocket'?'#ffe0a3':'#fff2c0');}
 for(const f of fx){if(f.blast){const k=f.age/BT.blastLife;ellipse(ctx,f.x,f.y,f.radius*(.25+k),f.radius*(.25+k),`rgba(255,191,105,${1-k})`);ellipse(ctx,f.x,f.y,f.radius*(1-k)*.55,f.radius*(1-k)*.55,`rgba(255,245,183,${1-k})`);}else {ctx.save();ctx.translate(f.x,f.y);ctx.rotate(f.age*4);rect(ctx,-4,-3,8,6,1,'#b88c70');ctx.restore();}}
 for(const t of traces){ctx.strokeStyle='#fff3b5';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(t.x,t.y);ctx.lineTo(t.tx,t.ty);ctx.stroke();}
 for(const p of planes){ctx.save();ctx.translate(p.x,p.y);ctx.fillStyle='#485065';ctx.beginPath();ctx.moveTo(-38,0);ctx.lineTo(-5,-5);ctx.lineTo(0,-22);ctx.lineTo(8,-5);ctx.lineTo(36,0);ctx.lineTo(8,5);ctx.lineTo(0,22);ctx.lineTo(-5,5);ctx.closePath();ctx.fill();ctx.restore();}
 for(const t of texts){ctx.globalAlpha=Math.max(0,1-t.age/CT.floatTextTime);ctx.font='900 17px system-ui';ctx.textAlign='center';ctx.strokeStyle='#664650';ctx.lineWidth=3;ctx.strokeText('−'+t.amount,t.x,t.y-t.age*25);ctx.fillStyle='#fff1cd';ctx.fillText('−'+t.amount,t.x,t.y-t.age*25);ctx.globalAlpha=1;}
 if(airArmed&&airX!==null){const y=game.terrain.floor(airX,0);ctx.strokeStyle='#ffedb7';ctx.lineWidth=2;ctx.setLineDash([5,5]);ctx.strokeRect(airX-BT.airSpacing,y-90,BT.airSpacing*2,90);ctx.setLineDash([]);ctx.font='800 12px system-ui';ctx.fillStyle='#493b4c';ctx.textAlign='center';ctx.fillText('AIRSTRIKE',airX,y-100);}
 ctx.restore();overview();
}
function overview(){mc.clearRect(0,0,360,44);mc.fillStyle='#b69a8a';mc.beginPath();mc.moveTo(0,44);for(let x=0;x<=BT.width;x+=24)mc.lineTo(x/BT.width*360,12+(game.terrain.floor(x,0)-350)*.15);mc.lineTo(360,44);mc.fill();for(const b of game.buildings)if(b.hp>0)rect(mc,b.x/BT.width*360-2,10,4,8,1,'#ead4b0');for(const t of game.tanks)if(t.hp>0)ellipse(mc,t.x/BT.width*360,9,t.id===game.turn?4:3,4,t.side?'#ff997e':'#75deed');mc.strokeStyle='#fff0bd';mc.lineWidth=1.5;mc.strokeRect(camera/BT.width*360,1,1280/BT.width*360,42);}
function focusUnit(){follow=true;cameraTarget=bClamp(game.active.x-640+(game.side===0?BT.cameraLead:-BT.cameraLead),0,BT.width-1280);}
function consume(){for(const e of game.events.splice(0)){
 if(e.type==='impact')fx.push({...e,blast:true,age:0});
 if(e.type==='collapse'||e.type==='chips'||e.type==='impact'){for(let i=0;i<(e.type==='chips'?8:BT.debrisCount);i++)fx.push({x:e.x,y:e.y,age:0,vx:bRandom(-BT.debrisSpeed,BT.debrisSpeed),vy:bRandom(-BT.debrisSpeed,-20)});}
 if(e.type==='damage')texts.push({...e,age:0});if(e.type==='tracer')traces.push({...e,age:0});if(e.type==='air'){planes.push({x:e.x-300,y:140,age:0});follow=false;cameraTarget=bClamp(e.x-640,0,BT.width-1280);}
 if(e.type==='activation'){airArmed=false;airX=null;focusUnit();}
 if(e.type==='battle'){fx=[];traces=[];texts=[];planes=[];airArmed=false;airX=null;focusUnit();}
}}
function updateUI(){const t=game.active,human=game.phase==='aim'&&game.side===0,gun=t.kind==='gunner';
 $('battleStatus').textContent=game.result||`ROUND ${game.round} · ${game.side===0?'YOUR':'ENEMY'} ${UNIT_TYPES[t.kind].short}${game.phase==='flight'?' · attacking':game.phase==='settle'?' · settling':''}`;
 $('battleWind').textContent=`WIND ${game.wind<0?'←':'→'} ${Math.abs(game.wind)}`;
 $('moveValue').textContent=Math.ceil(t.driveLeft);angle.value=t.angle;power.value=t.power;$('angleRead').textContent=gun?'DIRECT':t.angle+'°';$('powerRead').textContent=gun?'BURST':t.power;
 angle.disabled=power.disabled=!human||gun||airArmed;target.disabled=!human;for(const id of ['moveLeft','moveRight'])$(id).disabled=!human||t.driveLeft<=0||t.embedded||airArmed;
 $('attack').disabled=!human||!game.canFire()||(airArmed&&airX===null);$('attack').textContent=airArmed?'CALL STRIKE':gun?'BURST':'FIRE';$('hold').disabled=!human;
 $('airSupport').disabled=!human||game.air[0]<=0;$('airSupport').classList.toggle('armed',airArmed);$('airSupport').innerHTML=airArmed?'✕ CANCEL AIR<span>Tap ground → confirm</span>':`✈ AIRSTRIKE<span>${game.air[0]} call · replaces attack</span>`;
 $('instruction').textContent=airArmed?'Drag to pan · tap the ground to mark a strike · friendly fire is possible':human?(game.committed?'Unit committed · finish with an attack or Hold': 'Choose a ready unit · A/D or hold arrows to move · fire ends its activation'):'Enemy activation · drag the battlefield to inspect';
 for(const card of document.querySelectorAll('[data-unit]')){const u=game.tanks[+card.dataset.unit];card.disabled=!human||u.hp<=0||u.used||(game.committed&&u!==t);card.classList.toggle('selected',u===t);card.innerHTML=`<strong>${UNIT_TYPES[u.kind].short}</strong><small>${u.hp<=0?'DESTROYED':u.used?'DONE THIS ROUND':u.hp+' HP · '+(u===t?'SELECTED':'READY')}</small><span class="life" style="width:${Math.max(0,u.hp/UNIT_TYPES[u.kind].hp*100)}%"></span>`;}
 const next=game.tanks.filter(u=>u.side===1&&u.hp>0).map(u=>u.id+':'+u.hp).join(',');if(next!==stamp){target.replaceChildren(...game.tanks.filter(u=>u.side===1&&u.hp>0).map(u=>{const o=document.createElement('option');o.value=u.id;o.textContent=UNIT_TYPES[u.kind].name+' · '+u.hp+' HP';return o;}));stamp=next;}
 target.value=game.targetId;$('result').hidden=game.phase!=='over';$('resultTitle').textContent=game.result;
}
function attack(){if(game.side!==0||game.phase!=='aim')return;follow=true;if(airArmed){if(airX!==null&&game.callAir(airX)){airArmed=false;airX=null;}}else game.shoot();consume();updateUI();}
function restart(){game.restart();camera=0;consume();updateUI();}
$('attack').onclick=attack;$('hold').onclick=()=>{game.hold();consume();updateUI();};$('restartBattle').onclick=$('playAgain').onclick=restart;
$('focus').onclick=focusUnit;$('enemyView').onclick=()=>{const t=game.tanks[game.targetId];if(t){follow=false;cameraTarget=bClamp(t.x-640,0,BT.width-1280);}};
$('airSupport').onclick=()=>{airArmed=!airArmed;airX=null;game.setDrive(0);updateUI();};
for(const card of document.querySelectorAll('[data-unit]'))card.onclick=()=>{if(game.select(+card.dataset.unit)){airArmed=false;airX=null;focusUnit();updateUI();}};
angle.oninput=()=>{if(!angle.disabled)game.active.angle=+angle.value;};power.oninput=()=>{if(!power.disabled)game.active.power=+power.value;};target.onchange=()=>game.setTarget(+target.value);
for(const [id,d] of [['moveLeft',-1],['moveRight',1]]){const b=$(id);b.onpointerdown=e=>{e.preventDefault();b.setPointerCapture(e.pointerId);game.setDrive(d);follow=true;};for(const event of ['pointerup','pointercancel','lostpointercapture'])b.addEventListener(event,()=>game.setDrive(0));}
const point=e=>{const r=canvas.getBoundingClientRect();return{x:(e.clientX-r.left)/r.width*1280,y:(e.clientY-r.top)/r.height*720};};
canvas.onpointerdown=e=>{const p=point(e);pointer={id:e.pointerId,start:p.x,cam:camera,x:p.x,y:p.y};canvas.setPointerCapture(e.pointerId);};canvas.onpointermove=e=>{if(!pointer)return;const p=point(e);if(Math.abs(p.x-pointer.start)>6){follow=false;camera=cameraTarget=bClamp(pointer.cam-(p.x-pointer.start),0,BT.width-1280);}};
canvas.onpointerup=e=>{if(!pointer)return;const p=point(e);if(Math.abs(p.x-pointer.start)<=6){const world=p.x+camera;if(airArmed){airX=world;}else {const unit=game.tanks.find(t=>t.hp>0&&Math.abs(t.x-world)<40&&Math.abs(t.y-30-p.y)<55);if(unit?.side===0&&game.select(unit.id))focusUnit();else if(unit?.side===1)game.setTarget(unit.id);}}pointer=null;updateUI();};canvas.onpointercancel=()=>pointer=null;
function panMini(e){const r=mini.getBoundingClientRect();follow=false;camera=cameraTarget=bClamp((e.clientX-r.left)/r.width*BT.width-640,0,BT.width-1280);}
mini.onpointerdown=e=>{mini.setPointerCapture(e.pointerId);panMini(e);};mini.onpointermove=e=>{if(mini.hasPointerCapture(e.pointerId))panMini(e);};
window.addEventListener('keydown',e=>{if(e.target instanceof HTMLSelectElement)return;if(['KeyA','KeyD'].includes(e.code)){e.preventDefault();if(!airArmed)game.setDrive(e.code==='KeyA'?-1:1);follow=true;}if(e.code==='Space'){e.preventDefault();if(!e.repeat&&game.side===0)attack();}if(e.code==='Escape'){airArmed=false;airX=null;}if(['Digit1','Digit2','Digit3'].includes(e.code)&&game.select(+e.code.slice(-1)-1))focusUnit();if(game.side===0&&game.phase==='aim'&&game.active.kind!=='gunner'){if(e.key==='ArrowUp')game.active.angle=bClamp(game.active.angle+1,0,180);if(e.key==='ArrowDown')game.active.angle=bClamp(game.active.angle-1,0,180);if(e.key==='ArrowLeft')game.active.power=bClamp(game.active.power-1,0,100);if(e.key==='ArrowRight')game.active.power=bClamp(game.active.power+1,0,100);if(e.key.startsWith('Arrow'))e.preventDefault();}});
window.addEventListener('keyup',e=>{if(['KeyA','KeyD'].includes(e.code))game.setDrive(0);});window.addEventListener('blur',()=>game.setDrive(0));document.addEventListener('visibilitychange',()=>{game.setDrive(0);last=0;accumulator=0;});
function tick(dt){game.update(dt);consume();for(const f of fx){f.age+=dt;if(!f.blast){f.vy+=CT.tankGravity*dt;f.x+=f.vx*dt;f.y+=f.vy*dt;}}fx=fx.filter(f=>f.age<(f.blast?BT.blastLife:BT.debrisLife));for(const t of traces)t.age+=dt;traces=traces.filter(t=>t.age<BT.gunTraceLife);for(const t of texts)t.age+=dt;texts=texts.filter(t=>t.age<CT.floatTextTime);for(const p of planes){p.age+=dt;p.x+=350*dt;}planes=planes.filter(p=>p.age<2);
 if(follow&&game.phase==='flight'&&game.projectiles.length&&!airArmed){const p=game.projectiles[0];cameraTarget=bClamp(p.x-640,0,BT.width-1280);}else if(follow)focusUnit();camera+=(cameraTarget-camera)*Math.min(1,dt*BT.cameraSpeed);
}
function frame(ms){if(!last)last=ms;accumulator+=Math.min((ms-last)/1000,CT.maxFrame);last=ms;while(accumulator>=CT.step){tick(CT.step);accumulator-=CT.step;}updateUI();render();requestAnimationFrame(frame);}
window.battleDebug={game,update:dt=>{tick(dt);updateUI();},getCamera:()=>camera};consume();updateUI();requestAnimationFrame(frame);
})();
