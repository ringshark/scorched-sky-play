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
function rebuildTerrain(){tc.clearRect(0,0,TUNING.width,TUNING.height);for(let r=0;r<terrain.rows;r++)for(let c=0;c<terrain.cols;c++)if(terrain.data[r*terrain.cols+c]){tc.fillStyle=terrain.solid(c*TUNING.cell,r*TUNING.cell-TUNING.cell)?((r+c)%11===0?'#a45d37':'#b97040'):'#ffe286';tc.fillRect(c*TUNING.cell,r*TUNING.cell,TUNING.cell,TUNING.cell);}}
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
function drawTank(t){ctx.save();ctx.translate(t.x,t.y);ctx.rotate(t.tilt);rounded(-21,-15,42,17,7,'#28334b');for(let i=-12;i<=12;i+=12){ctx.fillStyle='#78859a';ctx.beginPath();ctx.arc(i,-6,4,0,Math.PI*2);ctx.fill();}rounded(-20,-28,40,17,5,t.color);rounded(-10,-36,22,14,5,t.color);ctx.restore();ctx.save();ctx.translate(t.x,t.y-TUNING.tankHeight);ctx.rotate(-t.angle*Math.PI/180);rounded(0,-5,TUNING.barrel,10,3,t.color);ctx.restore();}
function render(){const sky=ctx.createLinearGradient(0,0,0,720);sky.addColorStop(0,'#edac78');sky.addColorStop(.55,'#ffe0a1');sky.addColorStop(1,'#aeb6d2');ctx.fillStyle=sky;ctx.fillRect(0,0,1280,720);ctx.fillStyle='#fff2b6';ctx.beginPath();ctx.arc(920,185,74,0,Math.PI*2);ctx.fill();
 for(let i=0;i<9;i++){const x=((i*193+clock*5)%1500)-110,y=590+(i%3)*34;ctx.fillStyle='#fff1dc';for(let j=0;j<4;j++){ctx.beginPath();ctx.ellipse(x+j*32,y,55,19+j%2*7,0,0,Math.PI*2);ctx.fill();}}
 ctx.drawImage(terrainCanvas,0,0);
 if(ghost.length){ctx.strokeStyle=`rgba(255,255,255,${TUNING.ghostOpacity})`;ctx.lineWidth=3;ctx.setLineDash([5,9]);ctx.beginPath();ghost.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));ctx.stroke();ctx.setLineDash([]);}
 tanks.forEach(drawTank);if(shot){ctx.fillStyle='#fffbd6';ctx.beginPath();ctx.arc(shot.x,shot.y,5,0,Math.PI*2);ctx.fill();}
 for(const p of particles){ctx.fillStyle='#82492e';ctx.fillRect(p.x,p.y,5,5);}if(blast){const k=blast.age/TUNING.explosionLife;ctx.fillStyle=`rgba(255,110,49,${1-k})`;ctx.beginPath();ctx.arc(blast.x,blast.y,TUNING.craterRadius*(.4+k),0,Math.PI*2);ctx.fill();ctx.fillStyle=`rgba(255,246,178,${1-k})`;ctx.beginPath();ctx.arc(blast.x,blast.y,TUNING.craterRadius*(1-k),0,Math.PI*2);ctx.fill();}
 ctx.font='bold 16px system-ui';ctx.textAlign='center';tanks.forEach((t,i)=>{ctx.fillStyle='#493e50';ctx.fillText(i===0?'YOU':'ROOKIE',t.x,t.y-60);});
}
function adjust(key){if(phase!=='aim'||turn!==0)return;const t=tanks[0];if(key==='ArrowUp')t.angle=clamp(t.angle+1,TUNING.minAngle,TUNING.maxAngle);if(key==='ArrowDown')t.angle=clamp(t.angle-1,TUNING.minAngle,TUNING.maxAngle);if(key==='ArrowRight')t.power=clamp(t.power+1,TUNING.minPower,TUNING.maxPower);if(key==='ArrowLeft')t.power=clamp(t.power-1,TUNING.minPower,TUNING.maxPower);sync();}
angle.oninput=()=>{tanks[0].angle=+angle.value;sync();};power.oninput=()=>{tanks[0].power=+power.value;sync();};fire.onclick=()=>{if(turn===0)shoot();};document.querySelector('#restart').onclick=restart;
window.addEventListener('keydown',e=>{if(e.code==='Space'||e.key.startsWith('Arrow')){e.preventDefault();if(e.repeat)return;if(e.code==='Space'){if(turn===0)shoot();}else{adjust(e.key);keys.set(e.key,{time:0,next:TUNING.keyDelay});}}});window.addEventListener('keyup',e=>keys.delete(e.key));window.addEventListener('blur',()=>keys.clear());document.addEventListener('visibilitychange',()=>{keys.clear();last=0;accumulator=0;});
function frame(ms){if(!last)last=ms;accumulator+=Math.min((ms-last)/1000,TUNING.maxFrame);last=ms;while(accumulator>=TUNING.step){update(TUNING.step);accumulator-=TUNING.step;}render();requestAnimationFrame(frame);}
restart();requestAnimationFrame(frame);
// Explicit debug surface for deterministic physics/browser checks; no aiming oracle.
window.scorchedDebug={getState:()=>({phase,turn,wind,result,tanks,terrain,ghost,shot}),restart,update};
}
