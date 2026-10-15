'use strict';
// Slice 1 tuning; design/SCORCHED_SKY_BUILD_PLAN.md, Elements 2, 5–8.
// HP, fall/burial damage and match progression belong to Slice 2.
const TUNING = Object.freeze({
  width:1280, height:720, cell:4, islandLeft:100, islandRight:1180,
  surface:342, hillAmplitude:48, hillFrequency:0.009, detailAmplitude:15,
  detailFrequency:0.023, bottom:570, taper:90, padHalfWidth:40,
  spawnLeft:285, spawnRight:995, gravity:260, tankGravity:650,
  maxSpeed:650, craterRadius:46, windMax:24, step:1/120,
  maxFrame:0.05, tankHalfWidth:15, tankHeight:22, barrel:29,
  slideDegrees:45, slideAcceleration:170, slideDrag:5, settleSpeed:3,
  settleTime:0.6, aiDelay:1.2, aiAngle:135, aiAngleError:9,
  aiInitialPower:67, aiInitialError:18, aiPowerError:4, aiCorrection:0.012,
  aiCorrectionLimit:6, minPower:0, maxPower:100, minAngle:0, maxAngle:180,
  initialAngle:45, initialPower:66, projectileLife:16, killY:670,
  particles:38, particleLife:0.8, particleSpeed:150, explosionLife:0.45,
  keyDelay:0.28, keyRepeat:0.045, ghostOpacity:0.26,
});
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const random=(a,b)=>a+Math.random()*(b-a);
class Terrain {
  constructor(){this.cols=TUNING.width/TUNING.cell;this.rows=TUNING.height/TUNING.cell;this.data=new Uint8Array(this.cols*this.rows);this.generate();}
  solid(x,y){const c=Math.floor(x/TUNING.cell),r=Math.floor(y/TUNING.cell);return c>=0&&c<this.cols&&r>=0&&r<this.rows&&!!this.data[r*this.cols+c];}
  generate(){const phase=random(0,Math.PI*2);for(let c=0;c<this.cols;c++){
    const x=c*TUNING.cell;if(x<TUNING.islandLeft||x>TUNING.islandRight)continue;
    let top=TUNING.surface+Math.sin(x*TUNING.hillFrequency+phase)*TUNING.hillAmplitude+Math.sin(x*TUNING.detailFrequency+phase)*TUNING.detailAmplitude;
    for(const spawn of [TUNING.spawnLeft,TUNING.spawnRight]){const mix=clamp((Math.abs(x-spawn)-TUNING.padHalfWidth)/TUNING.padHalfWidth,0,1);top=TUNING.surface+(top-TUNING.surface)*mix;}
    const edge=Math.min(x-TUNING.islandLeft,TUNING.islandRight-x);
    const bottom=TUNING.bottom-TUNING.taper*Math.exp(-edge/TUNING.taper);
    for(let r=Math.ceil(top/TUNING.cell);r*TUNING.cell<bottom;r++)this.data[r*this.cols+c]=1;
  }}
  crater(x,y){const radius=TUNING.craterRadius;for(let r=Math.max(0,Math.floor((y-radius)/TUNING.cell));r<Math.min(this.rows,Math.ceil((y+radius)/TUNING.cell));r++)for(let c=Math.max(0,Math.floor((x-radius)/TUNING.cell));c<Math.min(this.cols,Math.ceil((x+radius)/TUNING.cell));c++)if(Math.hypot((c+.5)*TUNING.cell-x,(r+.5)*TUNING.cell-y)<radius)this.data[r*this.cols+c]=0;}
  floor(x,from){for(let y=Math.max(0,Math.floor(from/TUNING.cell)*TUNING.cell);y<TUNING.height;y+=TUNING.cell)if(this.solid(x,y))return y;return Infinity;}
}
function makeTank(x,color,angle){return {x,y:TUNING.surface,vx:0,vy:0,tilt:0,color,angle,power:TUNING.initialPower,grounded:true};}
function moveTank(t,terrain,dt){
  const oldY=t.y;
  t.vy+=TUNING.tankGravity*dt;t.x+=t.vx*dt;t.y+=t.vy*dt;
  const floor=terrain.floor(t.x,oldY-TUNING.cell);
  t.grounded=Number.isFinite(floor)&&t.y>=floor&&oldY<=floor+TUNING.cell;
  if(t.grounded){t.y=floor;t.vy=0;
    const left=terrain.floor(t.x-TUNING.tankHalfWidth,t.y-TUNING.tankHalfWidth),right=terrain.floor(t.x+TUNING.tankHalfWidth,t.y-TUNING.tankHalfWidth);
    const slope=Number.isFinite(left)&&Number.isFinite(right)?(right-left)/(TUNING.tankHalfWidth*2):(!Number.isFinite(left)?-2:2);
    t.tilt=Math.atan(slope);
    if(Math.abs(t.tilt)>TUNING.slideDegrees*Math.PI/180)t.vx+=Math.sign(slope)*TUNING.slideAcceleration*dt;
    else t.vx*=Math.exp(-TUNING.slideDrag*dt);
  }
}
function correctRookie(power,landingX,targetX){return clamp(power+clamp((landingX-targetX)*TUNING.aiCorrection,-TUNING.aiCorrectionLimit,TUNING.aiCorrectionLimit),TUNING.minPower,TUNING.maxPower);}
if(typeof module!=='undefined')module.exports={TUNING,Terrain,makeTank,moveTank,correctRookie};
if(typeof document!=='undefined'){
const canvas=document.querySelector('canvas'),ctx=canvas.getContext('2d');
const terrainCanvas=document.createElement('canvas');terrainCanvas.width=TUNING.width;terrainCanvas.height=TUNING.height;const tc=terrainCanvas.getContext('2d');
const angle=document.querySelector('#angle'),power=document.querySelector('#power'),fire=document.querySelector('#fire'),status=document.querySelector('#status'),windLabel=document.querySelector('#wind');
let terrain,tanks,turn,phase,wind,shot,ghost,particles,blast,timer,stable,aiPower,result,clock=0,accumulator=0,last=0;
const keys=new Map();
function rebuildTerrain(){
 tc.clearRect(0,0,TUNING.width,TUNING.height);
 // Draw every visible dirt cell; cut boundaries stay faithful to collision.
 for(let r=0;r<terrain.rows;r++)for(let c=0;c<terrain.cols;c++)if(terrain.data[r*terrain.cols+c]){
  const x=c*TUNING.cell,y=r*TUNING.cell;
  const layer=Math.sin(y*.046+Math.sin(x*.007)*.8);
  tc.fillStyle=layer>.5?'#b66e42':layer<-.6?'#a05b3b':'#c1804d';
  tc.fillRect(x,y,TUNING.cell,TUNING.cell);
  if(!terrain.solid(x,y-TUNING.cell)){tc.fillStyle='#5f4537';tc.fillRect(x,y,TUNING.cell,TUNING.cell);}
  if(!terrain.solid(x,y+TUNING.cell)){tc.fillStyle='#694537';tc.fillRect(x,y,TUNING.cell,TUNING.cell);}
 }
 // A thin living rim only on the exposed top, not the floor of a tunnel.
 for(let c=0;c<terrain.cols;c++){
  const x=c*TUNING.cell,y=terrain.floor(x,0);if(!Number.isFinite(y))continue;
  tc.fillStyle='#6f763c';tc.fillRect(x,y,TUNING.cell,5);
  tc.fillStyle='#b7bf65';tc.fillRect(x,y,TUNING.cell,2);
  if(c%7===0&&terrain.solid(x,y+12)){tc.strokeStyle='#a3ad57';tc.lineWidth=1.5;tc.beginPath();tc.moveTo(x+2,y);tc.lineTo(x-1,y-5);tc.moveTo(x+2,y);tc.lineTo(x+5,y-3);tc.stroke();}
 }
 // Coordinate hashing keeps stones still when a crater redraws the island.
 for(let x=110;x<1180;x+=17)for(let y=325;y<570;y+=19){
  const hash=Math.abs(Math.sin(x*12.9898+y*78.233)*43758.5453)%1;
  if(hash>.72&&terrain.solid(x-4,y)&&terrain.solid(x+5,y+3)&&terrain.solid(x,y-4)){
   tc.fillStyle=hash>.9?'#dfaa70':'#8e573d';tc.beginPath();tc.ellipse(x,y,3+hash*4,2+hash*2,.3,0,Math.PI*2);tc.fill();
   tc.strokeStyle='#efbf813f';tc.beginPath();tc.moveTo(x-3,y-1);tc.lineTo(x+2,y-2);tc.stroke();
  }
 }
}
function sync(){angle.value=tanks[0].angle;power.value=tanks[0].power;document.querySelector('#angleValue').textContent=`${tanks[0].angle}°`;document.querySelector('#powerValue').textContent=tanks[0].power;const enabled=phase==='aim'&&turn===0;angle.disabled=power.disabled=fire.disabled=!enabled;windLabel.textContent=`${wind<0?'←':wind>0?'→':'•'} ${Math.abs(wind)} wind`;status.textContent=result|| (phase==='aim'?(turn===0?'Your turn · aim, then fire':'Rookie is guessing…'):phase==='flight'?'Shell away':'Let the dirt settle…');}
function nextTurn(){turn=1-turn;wind=Math.round(random(-TUNING.windMax,TUNING.windMax));phase='aim';timer=TUNING.aiDelay;sync();}
function restart(){terrain=new Terrain();tanks=[makeTank(TUNING.spawnLeft,'#45c4ef',TUNING.initialAngle),makeTank(TUNING.spawnRight,'#ff7969',TUNING.aiAngle)];for(const t of tanks)t.y=terrain.floor(t.x,0);turn=0;phase='aim';wind=Math.round(random(-TUNING.windMax,TUNING.windMax));shot=null;ghost=[];particles=[];blast=null;timer=0;stable=0;result='';aiPower=random(TUNING.aiInitialPower-TUNING.aiInitialError,TUNING.aiInitialPower+TUNING.aiInitialError);keys.clear();rebuildTerrain();sync();}
function shoot(){if(phase!=='aim')return;const t=tanks[turn],r=t.angle*Math.PI/180,s=TUNING.maxSpeed*t.power/TUNING.maxPower;shot={x:t.x+Math.cos(r)*TUNING.barrel,y:t.y-TUNING.tankHeight-Math.sin(r)*TUNING.barrel,vx:Math.cos(r)*s,vy:-Math.sin(r)*s,age:0,path:[],owner:turn};phase='flight';sync();}
function impact(x,y,hit){const s=shot;if(s.owner===0)ghost=s.path.slice();else aiPower=correctRookie(aiPower,x,tanks[0].x);
 if(hit){terrain.crater(x,y);rebuildTerrain();blast={x,y,age:0};for(let i=0;i<TUNING.particles;i++)particles.push({x,y,vx:random(-TUNING.particleSpeed,TUNING.particleSpeed),vy:random(-TUNING.particleSpeed,0),age:0});}
 shot=null;phase='settle';stable=0;sync();}
function update(dt){clock+=dt;
 for(const t of tanks)moveTank(t,terrain,dt);
 if(phase!=='over'){const dead=tanks.map(t=>t.y>TUNING.killY);if(dead.some(Boolean)){result=dead.every(Boolean)?'Both tanks fell · draw':dead[0]?'Rookie wins · you fell!':'You win · Rookie fell!';phase='over';shot=null;sync();}}
 if(shot){shot.age+=dt;shot.vx+=wind*dt;shot.vy+=TUNING.gravity*dt;const dx=shot.vx*dt,dy=shot.vy*dt,steps=Math.max(1,Math.ceil(Math.hypot(dx,dy)/(TUNING.cell/2)));for(let i=0;i<steps&&shot;i++){shot.x+=dx/steps;shot.y+=dy/steps;shot.path.push([shot.x,shot.y]);const hit=terrain.solid(shot.x,shot.y)||tanks.some(t=>Math.hypot(shot.x-t.x,shot.y-(t.y-TUNING.tankHeight/2))<TUNING.tankHalfWidth);if(hit)impact(shot.x,shot.y,true);else if(shot.y>TUNING.height||shot.x<0||shot.x>TUNING.width||shot.age>TUNING.projectileLife)impact(shot.x,shot.y,false);}}
 if(phase==='settle'){if(tanks.every(t=>t.grounded&&Math.abs(t.vx)<TUNING.settleSpeed))stable+=dt;else stable=0;if(stable>=TUNING.settleTime)nextTurn();}
 if(phase==='aim'&&turn===1){timer-=dt;if(timer<=0){tanks[1].angle=Math.round(random(TUNING.aiAngle-TUNING.aiAngleError,TUNING.aiAngle+TUNING.aiAngleError));tanks[1].power=Math.round(clamp(aiPower+random(-TUNING.aiPowerError,TUNING.aiPowerError),TUNING.minPower,TUNING.maxPower));shoot();}}
 for(const p of particles){p.age+=dt;p.x+=p.vx*dt;p.y+=p.vy*dt;p.vy+=TUNING.tankGravity*dt;}particles=particles.filter(p=>p.age<TUNING.particleLife);if(blast){blast.age+=dt;if(blast.age>TUNING.explosionLife)blast=null;}
 for(const [key,k] of keys){k.time+=dt;if(k.time>=k.next){adjust(key);k.next+=TUNING.keyRepeat;}}
}
function rounded(x,y,w,h,r,color){ctx.fillStyle=color;ctx.beginPath();ctx.roundRect(x,y,w,h,r);ctx.fill();}
function ellipse(x,y,rx,ry,color){ctx.fillStyle=color;ctx.beginPath();ctx.ellipse(x,y,rx,ry,0,0,Math.PI*2);ctx.fill();}
function drawTank(t){
 const player=t===tanks[0],light=player?'#a2efff':'#ffc0a2',dark=player?'#177f9e':'#b34346';
 ellipse(t.x,t.y+3,29,5,'#3c28284a');
 ctx.save();ctx.translate(t.x,t.y);ctx.rotate(t.tilt);
 // Rubber track, tread teeth, recessed road wheels.
 rounded(-26,-16,52,19,8,'#322f3c');rounded(-23,-14,46,14,6,'#171e2c');
 for(let x=-20;x<=20;x+=7){rounded(x,-17,5,3,1,'#69717b');rounded(x,0,5,3,1,'#626974');}
 for(let x=-17;x<=17;x+=11){ellipse(x,-7,5.5,5.5,'#77858e');ellipse(x,-7,3,3,'#39495c');ellipse(x-1,-8,1,1,'#bdc9be');}
 const armor=ctx.createLinearGradient(0,-36,0,-12);armor.addColorStop(0,light);armor.addColorStop(.25,t.color);armor.addColorStop(1,dark);
 rounded(-25,-29,50,17,5,'#343744');rounded(-24,-31,48,17,4,armor);
 rounded(-17,-29,34,4,2,light);rounded(-17,-23,29,7,2,dark);
 for(const x of [-20,19]){ellipse(x,-24,1.5,1.5,light);ellipse(x,-18,1.5,1.5,'#39495c');}
 // Painted chevron and a glowing headlight.
 ctx.strokeStyle='#fff3c7';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(-5,-22);ctx.lineTo(0,-18);ctx.lineTo(5,-22);ctx.stroke();
 rounded(player?19:-24,-23,5,5,2,'#fff3b8');
 rounded(-13,-41,27,17,6,'#343744');rounded(-12,-41,25,14,5,armor);rounded(-9,-43,18,4,2,'#384855');rounded(-7,-43,14,2,1,light);
 ctx.strokeStyle='#384855';ctx.lineWidth=1.5;ctx.beginPath();ctx.moveTo(player?-11:11,-37);ctx.lineTo(player?-15:15,-58);ctx.stroke();ellipse(player?-15:15,-58,2,2,light);
 ctx.restore();
 ctx.save();ctx.translate(t.x,t.y-TUNING.tankHeight);ctx.rotate(-t.angle*Math.PI/180);
 const recoil=shot&&shot.owner===(player?0:1)?Math.max(0,1-shot.age/.18)*5:0;
 rounded(-recoil,-6,TUNING.barrel,12,3,'#303b48');rounded(-recoil,-4,TUNING.barrel,8,2,dark);rounded(2-recoil,-4,TUNING.barrel-5,3,1,light);rounded(TUNING.barrel-6-recoil,-7,9,14,3,'#35424c');rounded(TUNING.barrel-4-recoil,-5,6,10,2,t.color);
 ctx.restore();
}
function drawSky(){
 const sky=ctx.createLinearGradient(0,0,0,TUNING.height);sky.addColorStop(0,'#df8978');sky.addColorStop(.48,'#ffd995');sky.addColorStop(.78,'#f4d6af');sky.addColorStop(1,'#9faec7');ctx.fillStyle=sky;ctx.fillRect(0,0,TUNING.width,TUNING.height);
 const halo=ctx.createRadialGradient(920,188,20,920,188,230);halo.addColorStop(0,'#fff6b9ae');halo.addColorStop(1,'#fff6b900');ctx.fillStyle=halo;ctx.fillRect(650,0,540,450);
 ellipse(920,188,63,63,'#fff2ba');
 // Soft high haze, then low cloudbanks beneath the finite island.
 ctx.fillStyle='#fff5dc22';ctx.beginPath();ctx.ellipse(530,190,220,6,-.04,0,Math.PI*2);ctx.fill();
 for(let i=0;i<9;i++){const x=((i*193+clock*(3+i%3))%1500)-110,y=592+(i%3)*37;
  for(let j=0;j<4;j++){ellipse(x+j*34,y+9,61,21+j%2*8,'#c7bfd066');ellipse(x+j*34,y,58,18+j%2*9,'#fff1db');}
 }
}
function render(){
 drawSky();ctx.save();ctx.shadowColor='#694d4c50';ctx.shadowBlur=22;ctx.shadowOffsetY=13;ctx.drawImage(terrainCanvas,0,0);ctx.restore();
 if(ghost.length){ctx.strokeStyle=`rgba(255,255,255,${TUNING.ghostOpacity})`;ctx.lineWidth=3;ctx.setLineDash([4,10]);ctx.beginPath();ghost.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));ctx.stroke();ctx.setLineDash([]);}
 tanks.forEach(drawTank);
 if(shot){ellipse(shot.x,shot.y,9,9,'#ffefbd22');ellipse(shot.x,shot.y,4,4,'#fff4c9');}
 for(const p of particles){ctx.save();ctx.translate(p.x,p.y);ctx.rotate(p.age*9);rounded(-3,-3,6,6,1,'#945537');ctx.restore();}
 if(blast){const k=blast.age/TUNING.explosionLife;ctx.strokeStyle=`rgba(255,240,176,${1-k})`;ctx.lineWidth=6*(1-k);ctx.beginPath();ctx.arc(blast.x,blast.y,TUNING.craterRadius*(.4+k*1.3),0,Math.PI*2);ctx.stroke();
  for(let i=0;i<8;i++){const a=i*Math.PI/4,spread=k*TUNING.craterRadius*.7;ellipse(blast.x+Math.cos(a)*spread,blast.y+Math.sin(a)*spread,TUNING.craterRadius*(1-k)*.55,TUNING.craterRadius*(1-k)*.55,`rgba(255,${125+i*12},65,${1-k})`);}
  ellipse(blast.x,blast.y,TUNING.craterRadius*(1-k)*.6,TUNING.craterRadius*(1-k)*.6,`rgba(255,249,204,${1-k})`);
 }
 ctx.font='800 13px system-ui';ctx.textAlign='center';tanks.forEach((t,i)=>{rounded(t.x-31,t.y-83,62,21,10,'#3b3a4b');ctx.fillStyle=i===0?'#a2efff':'#ffc0a2';ctx.fillText(i===0?'YOU':'ROOKIE',t.x,t.y-68);});
}
function adjust(key){if(phase!=='aim'||turn!==0)return;const t=tanks[0];if(key==='ArrowUp')t.angle=clamp(t.angle+1,TUNING.minAngle,TUNING.maxAngle);if(key==='ArrowDown')t.angle=clamp(t.angle-1,TUNING.minAngle,TUNING.maxAngle);if(key==='ArrowRight')t.power=clamp(t.power+1,TUNING.minPower,TUNING.maxPower);if(key==='ArrowLeft')t.power=clamp(t.power-1,TUNING.minPower,TUNING.maxPower);sync();}
angle.oninput=()=>{tanks[0].angle=+angle.value;sync();};power.oninput=()=>{tanks[0].power=+power.value;sync();};fire.onclick=()=>{if(turn===0)shoot();};document.querySelector('#restart').onclick=restart;
window.addEventListener('keydown',e=>{if(e.code==='Space'||e.key.startsWith('Arrow')){e.preventDefault();if(e.repeat)return;if(e.code==='Space'){if(turn===0)shoot();}else{adjust(e.key);keys.set(e.key,{time:0,next:TUNING.keyDelay});}}});window.addEventListener('keyup',e=>keys.delete(e.key));window.addEventListener('blur',()=>keys.clear());document.addEventListener('visibilitychange',()=>{keys.clear();last=0;accumulator=0;});
function frame(ms){if(!last)last=ms;accumulator+=Math.min((ms-last)/1000,TUNING.maxFrame);last=ms;while(accumulator>=TUNING.step){update(TUNING.step);accumulator-=TUNING.step;}render();requestAnimationFrame(frame);}
restart();requestAnimationFrame(frame);
// Explicit debug surface for deterministic physics/browser checks; no aiming oracle.
window.scorchedDebug={getState:()=>({phase,turn,wind,result,tanks,terrain,ghost,shot}),restart,update};
}
