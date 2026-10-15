'use strict';
// Gameplay numbers: design/SCORCHED_SKY_BUILD_PLAN.md, locked Elements 1–8.
// Unspecified values below are initial playtest tuning, not new design rules.
const TUNING = Object.freeze({
  width:1280, height:720, cell:4, islandLeft:100, islandRight:1180,
  surface:342, hillAmplitude:48, hillFrequency:0.009, detailAmplitude:15,
  detailFrequency:0.023, bottom:570, taper:90, padHalfWidth:40,
  spawnLeft:285, spawnRight:995, gravity:260, tankGravity:650,
  maxSpeed:650, windMax:24, step:1/120, maxFrame:0.05,
  tankHalfWidth:15, tankHeight:22, barrel:29, slideDegrees:45,
  slideAcceleration:170, slideDrag:5, settleSpeed:3, settleTime:0.6,
  maxHP:100, freeFall:30, fallPixelsPerHP:4, maxFallDamage:40,
  burialDamage:8, burialProbeWidth:9, directHitRadius:15,
  standardDamage:30, craterRadius:46, standardSplash:70,
  heavyDamage:50, heavyCrater:78, heavySplash:110,
  dirtRadius:78, dirtHeight:72, dirtDepth:32,
  draftAmmo:2, draftChoices:3, winsToMatch:2,
  aiDelay:1.2, aiAngle:135, aiAngleError:9, aiInitialPower:67,
  aiInitialError:18, aiPowerError:4, aiCorrection:0.012, aiCorrectionLimit:6,
  minPower:0, maxPower:100, minAngle:0, maxAngle:180,
  initialAngle:45, initialPower:66, aimStep:1, projectileLife:16, killY:670,
  particles:38, particleLife:0.8, particleSpeed:150, explosionLife:0.45,
  keyDelay:0.28, keyRepeat:0.045, ghostOpacity:0.26, recoilTime:0.18,
  recoilPixels:5, shakePixels:7, shakeTime:0.35, floatTextTime:1.4,
  splitterCount:3, splitterDamage:16, splitterCrater:26, splitterSplash:43,
  splitterSpread:74, splitterDownSpeed:18,
  rollerDamage:32, rollerCrater:43, rollerSplash:68, rollerSpeed:42,
  rollerAcceleration:210, rollerDrag:2, rollerLife:4, rollerFuse:0.35,
  rollerFlatSlope:0.12, rollerProbe:8, rollerClearance:3,
  drillDamage:35, drillCrater:49, drillSplash:74, drillSpeed:220,
  drillTunnel:7, drillMaxDistance:1600, drillExitDistance:12,
  regularAngleError:3, regularInitialError:9, regularPowerError:1.8,
  regularCorrection:0.04, regularCorrectionLimit:12,
  deadeyeAngleError:0.6, deadeyeInitialError:3.5, deadeyePowerError:0.6,
  deadeyeCorrection:0.085, deadeyeCorrectionLimit:22,
  aiMinObservedRange:90, aiClearanceStep:7, aiMaxElevation:72,
  aiWindLearning:0.12, aiStrategyOffset:12, aiValleyProbe:45,
  aiValleyDepth:12, aiThinGroundFactor:1.5, aiCoverHeight:20,
});
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const random=(a,b)=>a+Math.random()*(b-a);
const pick=list=>list[Math.floor(Math.random()*list.length)];
const shuffled=list=>{const out=list.slice();for(let i=out.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[out[i],out[j]]=[out[j],out[i]];}return out;};
const WEAPONS = Object.freeze({
  standard:{name:'Standard Shell',symbol:'●',description:'Reliable splash. Medium crater.',damage:TUNING.standardDamage,radius:TUNING.craterRadius,splash:TUNING.standardSplash},
  dirt:{name:'Dirt Bomb',symbol:'▴',description:'Build a mound. Bury a rival. Zero direct damage.',damage:0,radius:TUNING.dirtRadius},
  splitter:{name:'Splitter',symbol:'⋮',description:'Three bomblets at the apex. Wide coverage.',damage:TUNING.splitterDamage,radius:TUNING.splitterCrater,splash:TUNING.splitterSplash},
  roller:{name:'Roller',symbol:'◉',description:'Rolls downhill. Punishes valley positions.',damage:TUNING.rollerDamage,radius:TUNING.rollerCrater,splash:TUNING.rollerSplash},
  drill:{name:'Drill',symbol:'➤',description:'Cuts through a hill, then blasts the far side.',damage:TUNING.drillDamage,radius:TUNING.drillCrater,splash:TUNING.drillSplash},
  heavy:{name:'Heavy Shell',symbol:'◆',description:'50 direct damage. A huge crater for big drops.',damage:TUNING.heavyDamage,radius:TUNING.heavyCrater,splash:TUNING.heavySplash},
});
const DRAFT_POOL=['dirt','splitter','roller','drill','heavy'];
const RIVALS=Object.freeze([
  {name:'Rookie',title:'Find your range',color:'#ff7969',light:'#ffc0a2',dark:'#b34346',angleError:TUNING.aiAngleError,initialError:TUNING.aiInitialError,powerError:TUNING.aiPowerError,correction:TUNING.aiCorrection,limit:TUNING.aiCorrectionLimit},
  {name:'Regular',title:'Mind the terrain tools',color:'#e9b750',light:'#ffe2a0',dark:'#a87432',angleError:TUNING.regularAngleError,initialError:TUNING.regularInitialError,powerError:TUNING.regularPowerError,correction:TUNING.regularCorrection,limit:TUNING.regularCorrectionLimit},
  {name:'Deadeye',title:'Protect the ground beneath you',color:'#b596e6',light:'#e8d2ff',dark:'#6f519f',angleError:TUNING.deadeyeAngleError,initialError:TUNING.deadeyeInitialError,powerError:TUNING.deadeyePowerError,correction:TUNING.deadeyeCorrection,limit:TUNING.deadeyeCorrectionLimit},
]);
class Terrain {
  constructor(){this.cols=TUNING.width/TUNING.cell;this.rows=TUNING.height/TUNING.cell;this.data=new Uint8Array(this.cols*this.rows);this.version=0;this.originalTop=new Float32Array(this.cols).fill(Infinity);this.generate();}
  solid(x,y){const c=Math.floor(x/TUNING.cell),r=Math.floor(y/TUNING.cell);return c>=0&&c<this.cols&&r>=0&&r<this.rows&&!!this.data[r*this.cols+c];}
  generate(){const phase=random(0,Math.PI*2);for(let c=0;c<this.cols;c++){
    const x=c*TUNING.cell;if(x<TUNING.islandLeft||x>TUNING.islandRight)continue;
    let top=TUNING.surface+Math.sin(x*TUNING.hillFrequency+phase)*TUNING.hillAmplitude+Math.sin(x*TUNING.detailFrequency+phase)*TUNING.detailAmplitude;
    for(const spawn of [TUNING.spawnLeft,TUNING.spawnRight]){const mix=clamp((Math.abs(x-spawn)-TUNING.padHalfWidth)/TUNING.padHalfWidth,0,1);top=TUNING.surface+(top-TUNING.surface)*mix;}
    const edge=Math.min(x-TUNING.islandLeft,TUNING.islandRight-x),bottom=TUNING.bottom-TUNING.taper*Math.exp(-edge/TUNING.taper);
    this.originalTop[c]=Math.ceil(top/TUNING.cell)*TUNING.cell;
    for(let r=Math.ceil(top/TUNING.cell);r*TUNING.cell<bottom;r++)this.data[r*this.cols+c]=1;
  }this.version++;}
  crater(x,y,radius=TUNING.craterRadius){for(let r=Math.max(0,Math.floor((y-radius)/TUNING.cell));r<Math.min(this.rows,Math.ceil((y+radius)/TUNING.cell));r++)for(let c=Math.max(0,Math.floor((x-radius)/TUNING.cell));c<Math.min(this.cols,Math.ceil((x+radius)/TUNING.cell));c++)if(Math.hypot((c+.5)*TUNING.cell-x,(r+.5)*TUNING.cell-y)<radius)this.data[r*this.cols+c]=0;this.version++;}
  mound(x,y){
    for(let c=Math.max(0,Math.floor((x-TUNING.dirtRadius)/TUNING.cell));c<Math.min(this.cols,Math.ceil((x+TUNING.dirtRadius)/TUNING.cell));c++){
      const dx=((c+.5)*TUNING.cell-x)/TUNING.dirtRadius;
      const top=y-TUNING.dirtHeight*Math.sqrt(Math.max(0,1-dx*dx));
      for(let r=Math.max(0,Math.floor(top/TUNING.cell));r<Math.min(this.rows,Math.ceil((y+TUNING.dirtDepth)/TUNING.cell));r++)this.data[r*this.cols+c]=1;
    }this.version++;
  }
  floor(x,from){for(let y=Math.max(0,Math.floor(from/TUNING.cell)*TUNING.cell);y<TUNING.height;y+=TUNING.cell)if(this.solid(x,y))return y;return Infinity;}
}
function makeTank(x,color,angle){return {x,y:TUNING.surface,vx:0,vy:0,tilt:0,color,angle,power:TUNING.initialPower,grounded:true,hp:TUNING.maxHP,buried:false,turretBlocked:false,fallStart:null,ammo:{},weapon:'standard',recoil:0,cause:''};}
function checkBurial(t,terrain){
  t.turretBlocked=terrain.solid(t.x,t.y-TUNING.tankHeight);
  t.embedded=t.turretBlocked||terrain.solid(t.x,t.y-TUNING.tankHeight/2);
  t.buried=t.turretBlocked&&[-TUNING.burialProbeWidth,TUNING.burialProbeWidth].every(dx=>terrain.solid(t.x+dx,t.y-TUNING.tankHeight/2));
}
function fallDamage(distance){return Math.min(TUNING.maxFallDamage,Math.max(0,Math.ceil((distance-TUNING.freeFall)/TUNING.fallPixelsPerHP)));}
function moveTank(t,terrain,dt,onDamage=()=>{}){
  checkBurial(t,terrain);
  // A deposited mound pins the hull; do not teleport it up to the new surface.
  if(t.embedded){t.grounded=true;t.vx=0;t.vy=0;t.fallStart=null;return;}
  const oldY=t.y;t.vy+=TUNING.tankGravity*dt;t.x+=t.vx*dt;t.y+=t.vy*dt;
  const floor=terrain.floor(t.x,oldY-TUNING.cell);
  t.grounded=Number.isFinite(floor)&&t.y>=floor&&oldY<=floor+TUNING.cell;
  if(t.grounded){
    t.y=floor;t.vy=0;
    if(t.fallStart!==null){const damage=fallDamage(t.y-t.fallStart);if(damage)onDamage(t,damage,'fall');t.fallStart=null;}
    const left=terrain.floor(t.x-TUNING.tankHalfWidth,t.y-TUNING.tankHalfWidth),right=terrain.floor(t.x+TUNING.tankHalfWidth,t.y-TUNING.tankHalfWidth);
    const slope=Number.isFinite(left)&&Number.isFinite(right)?(right-left)/(TUNING.tankHalfWidth*2):(!Number.isFinite(left)?-2:2);
    t.tilt=Math.atan(slope);
    if(Math.abs(t.tilt)>TUNING.slideDegrees*Math.PI/180)t.vx+=Math.sign(slope)*TUNING.slideAcceleration*dt;
    else t.vx*=Math.exp(-TUNING.slideDrag*dt);
  }else if(t.fallStart===null)t.fallStart=oldY;
  checkBurial(t,terrain);
}
function correctRookie(power,landingX,targetX){return clamp(power+clamp((landingX-targetX)*TUNING.aiCorrection,-TUNING.aiCorrectionLimit,TUNING.aiCorrectionLimit),TUNING.minPower,TUNING.maxPower);}
class DuelGame {
  constructor(){this.clock=0;this.events=[];this.restart();}
  emit(type,detail={}){this.events.push({type,...detail});}
  restart(){this.scores=[0,0];this.round=1;this.rivalIndex=0;this.startMatch();}
  get rival(){return RIVALS[this.rivalIndex];}
  get rivalName(){return this.rival.name;}
  startMatch(){this.scores=[0,0];this.round=1;this.inventory=[{},{}];this.newRound();}
  newRound(){
    this.terrain=new Terrain();this.tanks=[makeTank(TUNING.spawnLeft,'#45c4ef',TUNING.initialAngle),makeTank(TUNING.spawnRight,this.rival.color,TUNING.aiAngle)];
    this.tanks.forEach((t,i)=>{t.y=this.terrain.floor(t.x,0);t.ammo=this.inventory[i];});
    this.projectiles=[];this.ghost=[];this.actionPaths=[];this.result='';this.winner=null;this.roundLoser=null;this.stable=0;this.actionLandings=[];
    this.aiPower=clamp(TUNING.aiInitialPower*Math.sqrt(Math.abs(this.tanks[1].x-this.tanks[0].x)/(TUNING.spawnRight-TUNING.spawnLeft))+random(-this.rival.initialError,this.rival.initialError),TUNING.minPower,TUNING.maxPower);
    this.aiElevation=TUNING.initialAngle;this.aiShots=0;this.aiObservation=null;this.aiAction=null;
    this.turn=(this.round-1)%2;this.beginTurn(false);this.emit('round');
  }
  beginTurn(chargeBurial=true){
    this.phase='aim';this.wind=Math.round(random(-TUNING.windMax,TUNING.windMax));this.timer=TUNING.aiDelay;
    const tank=this.tanks[this.turn];checkBurial(tank,this.terrain);
    if(chargeBurial&&tank.buried)this.damage(tank,TUNING.burialDamage,'burial');
    this.checkRoundEnd();this.emit('state');
  }
  canFire(){return this.phase==='aim';}
  selectWeapon(id){if(this.phase==='aim'&&WEAPONS[id]&&(id==='standard'||this.tanks[this.turn].ammo[id]>0))this.tanks[this.turn].weapon=id;}
  damage(t,amount,cause){if(t.hp<=0)return;const n=Math.min(t.hp,Math.round(amount));if(n<=0)return;t.hp-=n;t.cause=cause;this.emit('damage',{x:t.x,y:t.y-TUNING.tankHeight,amount:n,cause});}
  shoot(){
    if(!this.canFire())return false;
    const t=this.tanks[this.turn];let id=t.weapon;
    if(id!=='standard'&&!(t.ammo[id]>0))id=t.weapon='standard';
    if(id!=='standard')t.ammo[id]--;
    const r=t.angle*Math.PI/180,s=TUNING.maxSpeed*t.power/TUNING.maxPower,pivot={x:t.x,y:t.y-TUNING.tankHeight};
    let distance=TUNING.barrel;
    for(let d=0;d<=TUNING.barrel;d+=TUNING.cell/2)if(this.terrain.solid(pivot.x+Math.cos(r)*d,pivot.y-Math.sin(r)*d)){distance=d;break;}
    const p={x:pivot.x+Math.cos(r)*distance,y:pivot.y-Math.sin(r)*distance,vx:Math.cos(r)*s,vy:-Math.sin(r)*s,age:0,path:[],owner:this.turn,weapon:id,alive:true};
    if(this.turn===1)this.aiAction={power:t.power,angle:t.angle,originX:t.x,targetX:this.aiTargetX??this.tanks[0].x,wind:this.wind};
    this.projectiles=[p];this.actionOwner=this.turn;this.actionPaths=[];this.actionLandings=[];this.phase='flight';t.recoil=TUNING.recoilTime;this.emit('fire',{x:p.x,y:p.y});
    if(distance<TUNING.barrel)this.contact(p,null);
    this.emit('state');return true;
  }
  impact(p,hit,directTank=null){
    if(!p.alive)return;p.alive=false;this.actionPaths.push(p.path.slice());this.actionLandings.push(p.x);
    if(hit){const weapon=WEAPONS[p.weapon];
      if(p.weapon==='dirt'){this.terrain.mound(p.x,p.y);this.tanks.forEach(t=>checkBurial(t,this.terrain));}
      else {this.terrain.crater(p.x,p.y,weapon.radius);this.tanks.forEach((t,i)=>{const distance=Math.hypot(p.x-t.x,p.y-(t.y-TUNING.tankHeight/2));this.damage(t,i===directTank?weapon.damage:weapon.damage*Math.max(0,1-distance/weapon.splash),'explosion');});}
      this.emit('impact',{x:p.x,y:p.y,radius:weapon.radius,weapon:p.weapon});
    }
  }
  contact(p,directTank){
    if(p.weapon==='drill'&&directTank===null){
      p.mode='drill';p.drilled=0;const speed=Math.hypot(p.vx,p.vy)||1;p.vx=p.vx/speed*TUNING.drillSpeed;p.vy=p.vy/speed*TUNING.drillSpeed;
    }else if(p.weapon==='roller'&&directTank===null){
      p.mode='roll';p.rollAge=0;p.vx=Math.sign(p.vx||1)*TUNING.rollerSpeed;p.vy=0;p.y=this.terrain.floor(p.x,p.y-TUNING.cell)-TUNING.rollerClearance;
    }else this.impact(p,true,directTank);
  }
  stepDrill(p,dt){
    p.age+=dt;const distance=TUNING.drillSpeed*dt,steps=Math.max(1,Math.ceil(distance/(TUNING.cell/2)));
    for(let i=0;i<steps&&p.alive;i++){
      p.x+=p.vx*dt/steps;p.y+=p.vy*dt/steps;p.drilled+=distance/steps;p.path.push([p.x,p.y]);
      const solid=this.terrain.solid(p.x,p.y);
      if(!solid&&p.drilled>TUNING.drillExitDistance){this.impact(p,true);break;}
      if(p.drilled>=TUNING.drillMaxDistance){this.impact(p,false);break;}
      // Cut behind the nose so the next probe still sees untouched dirt.
      if(solid){const behind=TUNING.drillTunnel;this.terrain.crater(p.x-p.vx/TUNING.drillSpeed*behind,p.y-p.vy/TUNING.drillSpeed*behind,TUNING.drillTunnel);}
      if(p.x<0||p.x>TUNING.width||p.y>TUNING.height||p.age>TUNING.projectileLife)this.impact(p,false);
    }
  }
  stepRoller(p,dt){
    p.age+=dt;p.rollAge+=dt;
    const floor=this.terrain.floor(p.x,p.y-TUNING.rollerProbe);
    if(Number.isFinite(floor)&&p.y+TUNING.rollerClearance>=floor){
      p.y=floor-TUNING.rollerClearance;p.vy=0;
      const l=this.terrain.floor(p.x-TUNING.rollerProbe,floor-TUNING.rollerProbe*2),r=this.terrain.floor(p.x+TUNING.rollerProbe,floor-TUNING.rollerProbe*2);
      const slope=Number.isFinite(l)&&Number.isFinite(r)?(r-l)/(TUNING.rollerProbe*2):(!Number.isFinite(l)?-1:1);
      p.vx+=clamp(slope,-1,1)*TUNING.rollerAcceleration*dt;
      if(Math.abs(slope)<TUNING.rollerFlatSlope){p.vx*=Math.exp(-TUNING.rollerDrag*dt);if(p.rollAge>TUNING.rollerFuse){this.impact(p,true);return;}}
    }else p.vy+=TUNING.tankGravity*dt;
    p.x+=p.vx*dt;p.y+=p.vy*dt;p.path.push([p.x,p.y]);
    const direct=this.tanks.findIndex(t=>Math.hypot(p.x-t.x,p.y-(t.y-TUNING.tankHeight/2))<TUNING.directHitRadius);
    if(direct>=0||p.rollAge>=TUNING.rollerLife)this.impact(p,true,direct>=0?direct:null);
    else if(p.y>TUNING.height||p.x<0||p.x>TUNING.width)this.impact(p,false);
  }
  stepProjectile(p,dt){
    if(p.mode==='drill'){this.stepDrill(p,dt);return;}if(p.mode==='roll'){this.stepRoller(p,dt);return;}
    p.age+=dt;const oldVy=p.vy;p.vx+=this.wind*dt;p.vy+=TUNING.gravity*dt;
    if(p.weapon==='splitter'&&!p.child&&oldVy<0&&p.vy>=0){
      p.alive=false;
      for(let i=0;i<TUNING.splitterCount;i++)this.projectiles.push({...p,alive:true,child:true,vx:p.vx+(i-(TUNING.splitterCount-1)/2)*TUNING.splitterSpread,vy:TUNING.splitterDownSpeed,path:p.path.slice()});
      this.emit('split',{x:p.x,y:p.y});return;
    }
    const dx=p.vx*dt,dy=p.vy*dt,steps=Math.max(1,Math.ceil(Math.hypot(dx,dy)/(TUNING.cell/2)));
    for(let i=0;i<steps&&p.alive;i++){
      p.x+=dx/steps;p.y+=dy/steps;p.path.push([p.x,p.y]);
      const direct=this.tanks.findIndex(t=>Math.hypot(p.x-t.x,p.y-(t.y-TUNING.tankHeight/2))<TUNING.directHitRadius);
      if(this.terrain.solid(p.x,p.y)||direct>=0){this.contact(p,direct>=0?direct:null);break;}
      else if(p.y>TUNING.height||p.x<0||p.x>TUNING.width||p.age>TUNING.projectileLife)this.impact(p,false);
    }
  }
  finishAction(){
    if(this.actionOwner===0)this.ghost=this.actionPaths.slice();
    else if(this.actionLandings.length)this.observeAI(this.actionLandings.reduce((a,b)=>a+b,0)/this.actionLandings.length);
    const t=this.tanks[this.actionOwner];if(t.weapon!=='standard'&&t.ammo[t.weapon]===0)t.weapon='standard';
    this.phase='settle';this.stable=0;this.emit('state');
  }
  observeAI(landingX){
    const shot=this.aiAction;if(!shot)return;
    const error=landingX-shot.targetX,direction=Math.sign(shot.targetX-shot.originX)||-1;
    if(this.rivalIndex===0){this.aiPower=clamp(this.aiPower-direction*clamp(error*TUNING.aiCorrection,-this.rival.limit,this.rival.limit),TUNING.minPower,TUNING.maxPower);}
    else {
      // Estimate a correction from observed range, never from simulated shots.
      const observed=direction*(landingX-shot.originX),wanted=Math.abs(shot.targetX-shot.originX);
      const estimate=observed>TUNING.aiMinObservedRange?shot.power*Math.sqrt(wanted/observed):this.aiPower-direction*error*this.rival.correction;
      this.aiPower=clamp(this.aiPower+clamp(estimate-this.aiPower,-this.rival.limit,this.rival.limit),TUNING.minPower,TUNING.maxPower);
      if(observed<TUNING.aiMinObservedRange)this.aiElevation=Math.min(TUNING.aiMaxElevation,this.aiElevation+TUNING.aiClearanceStep);
    }
    this.aiObservation={...shot,landingX};
  }
  chooseAIWeapon(){
    const t=this.tanks[1],target=this.tanks[0],available=id=>t.ammo[id]>0;
    if(this.rivalIndex===0)return 'standard';
    if(t.turretBlocked)return available('heavy')&&t.hp>TUNING.heavyDamage?'heavy':'standard';
    if(this.rivalIndex===1){if(this.aiShots%2===0)return 'standard';return ['heavy','splitter','roller','drill','dirt'].find(available)||'standard';}
    let depth=0;for(let y=target.y;y<TUNING.height&&this.terrain.solid(target.x,y);y+=TUNING.cell)depth+=TUNING.cell;
    if(available('heavy')&&depth<TUNING.heavyCrater*TUNING.aiThinGroundFactor)return 'heavy';
    if(available('dirt')&&!target.buried)return 'dirt';
    if(available('heavy'))return 'heavy';
    const left=this.terrain.floor(target.x-TUNING.aiValleyProbe,0),right=this.terrain.floor(target.x+TUNING.aiValleyProbe,0);
    if(available('roller')&&Math.min(left,right)<target.y-TUNING.aiValleyDepth)return 'roller';
    const cover=this.terrain.floor((target.x+t.x)/2,0);
    if(available('drill')&&cover<Math.min(t.y,target.y)-TUNING.aiCoverHeight)return 'drill';
    return ['splitter','roller','drill'].find(available)||'standard';
  }
  chooseAIDraft(){
    if(this.rivalIndex===0)return pick(this.offer);
    const order=this.rivalIndex===2?['dirt','heavy','drill','roller','splitter']:['heavy','splitter','roller','dirt','drill'];
    return order.find(id=>this.offer.includes(id));
  }
  aiTurn(){
    const tank=this.tanks[1],target=this.tanks[0],direction=Math.sign(target.x-tank.x)||-1;tank.weapon=this.chooseAIWeapon();
    const elevation=this.aiElevation+random(-this.rival.angleError,this.rival.angleError);
    tank.angle=Math.round(clamp(direction<0?TUNING.maxAngle-elevation:elevation,TUNING.minAngle,TUNING.maxAngle));
    // Deadeye targets the downhill shoulder with heavy shots to remove support.
    const offset=this.rivalIndex===2&&tank.weapon==='heavy'?Math.sign(target.tilt||direction)*TUNING.aiStrategyOffset:0;
    this.aiTargetX=target.x+offset;
    const offsetPower=direction*offset*TUNING.aiCorrection;
    let windPower=0;
    if(this.aiObservation&&this.rivalIndex>0)windPower=-direction*(this.wind-this.aiObservation.wind)*TUNING.aiWindLearning;
    tank.power=Math.round(clamp(this.aiPower+offsetPower+windPower+random(-this.rival.powerError,this.rival.powerError),TUNING.minPower,TUNING.maxPower));
    this.aiShots++;this.shoot();
  }
  checkRoundEnd(){
    if(['roundOver','matchOver','draft'].includes(this.phase))return;
    const dead=this.tanks.map(t=>t.hp<=0||t.y>TUNING.killY||t.x<-TUNING.tankHalfWidth||t.x>TUNING.width+TUNING.tankHalfWidth);
    if(!dead.some(Boolean))return;
    if(this.phase==='flight'&&this.actionOwner===0)this.ghost=this.actionPaths.concat(this.projectiles.filter(p=>p.alive).map(p=>p.path.slice()));
    this.projectiles=[];
    const winner=dead.every(Boolean)?null:dead[0]?1:0;this.winner=winner;this.roundLoser=winner===null?null:1-winner;
    if(winner!==null)this.scores[winner]++;
    const loser=this.tanks[this.roundLoser];const cause=loser&&(loser.y>TUNING.killY?'ring-out':loser.cause||'ring-out');
    this.result=winner===null?'Both tanks fell — round drawn':`${winner===0?'You win':this.rivalName+' wins'} · ${cause}`;
    this.phase=this.scores.some(n=>n>=TUNING.winsToMatch)?'matchOver':'roundOver';this.emit('state');
  }
  advance(){
    if(this.phase==='matchOver'){if(this.scores[0]>=TUNING.winsToMatch){if(this.rivalIndex<RIVALS.length-1)this.rivalIndex++;else this.rivalIndex=0;}this.startMatch();return;}
    if(this.phase!=='roundOver')return;
    if(this.winner===null){this.newRound();return;}
    this.phase='draft';this.draftOrder=[this.roundLoser,this.winner];this.draftStep=0;this.draftTaken=[];this.offer=shuffled(DRAFT_POOL).slice(0,TUNING.draftChoices);this.draftActor=this.draftOrder[0];this.timer=TUNING.aiDelay;this.emit('state');
  }
  draft(id){
    if(this.phase!=='draft'||!this.offer.includes(id))return false;
    const actor=this.draftActor;this.inventory[actor][id]=(this.inventory[actor][id]||0)+TUNING.draftAmmo;this.draftTaken.push(id);this.offer=this.offer.filter(w=>w!==id);
    const refill=shuffled(DRAFT_POOL.filter(w=>!this.offer.includes(w)&&!this.draftTaken.includes(w)));while(this.offer.length<TUNING.draftChoices&&refill.length)this.offer.push(refill.pop());
    this.draftStep++;
    if(this.draftStep===this.draftOrder.length){this.round++;this.newRound();}
    else {this.draftActor=this.draftOrder[this.draftStep];this.timer=TUNING.aiDelay;this.emit('state');}return true;
  }
  update(dt){
    this.clock+=dt;this.tanks.forEach(t=>{t.recoil=Math.max(0,t.recoil-dt);moveTank(t,this.terrain,dt,(...args)=>this.damage(...args));});
    if(this.phase==='flight'){
      this.projectiles.slice().forEach(p=>{if(p.alive)this.stepProjectile(p,dt);});this.projectiles=this.projectiles.filter(p=>p.alive);
      if(!this.projectiles.length)this.finishAction();
    }
    this.checkRoundEnd();
    if(this.phase==='settle'){
      if(this.tanks.every(t=>t.grounded&&Math.abs(t.vx)<TUNING.settleSpeed))this.stable+=dt;else this.stable=0;
      if(this.stable>=TUNING.settleTime){this.turn=1-this.turn;this.beginTurn();}
    }
    if(this.phase==='aim'&&this.turn===1){this.timer-=dt;if(this.timer<=0)this.aiTurn();}
    if(this.phase==='draft'&&this.draftActor===1){this.timer-=dt;if(this.timer<=0)this.draft(this.chooseAIDraft());}
  }
}
if(typeof module!=='undefined')module.exports={TUNING,WEAPONS,DRAFT_POOL,RIVALS,Terrain,makeTank,moveTank,checkBurial,fallDamage,correctRookie,DuelGame};
if(typeof document!=='undefined'){
const game=new DuelGame();
const canvas=document.querySelector('canvas'),ctx=canvas.getContext('2d');
const terrainCanvas=document.createElement('canvas');terrainCanvas.width=TUNING.width;terrainCanvas.height=TUNING.height;const tc=terrainCanvas.getContext('2d');
const litTerrain=document.createElement('canvas');litTerrain.width=TUNING.width;litTerrain.height=TUNING.height;const litBrush=litTerrain.getContext('2d');
const angle=document.querySelector('#angle'),power=document.querySelector('#power'),fire=document.querySelector('#fire'),status=document.querySelector('#status'),windLabel=document.querySelector('#wind'),weaponSelect=document.querySelector('#weapon');
let terrain=game.terrain,tanks=game.tanks,shot=null,ghost=[],clock=0,particles=[],blast=null,blasts=[],floatTexts=[],shake=0,terrainVersion=-1,terrainRef=null,accumulator=0,last=0,uiStamp='';
const keys=new Map();
// Scenery assets never consume the gameplay RNG or mutate the terrain model.
// The existing sky is retained as a synchronous/offline-safe fallback.
const paintedSky=new Image();
paintedSky.src='assets/scorched-sunset-v1.webp';
const skyPlate=document.createElement('canvas');skyPlate.width=TUNING.width;skyPlate.height=TUNING.height;
const skyBrush=skyPlate.getContext('2d');let skyReady=false;
paintedSky.onload=()=>{
 skyBrush.drawImage(paintedSky,0,0,TUNING.width,TUNING.height);
 const veil=skyBrush.createLinearGradient(0,0,0,142);veil.addColorStop(0,'#ffe7d333');veil.addColorStop(1,'#ffe7d300');skyBrush.fillStyle=veil;skyBrush.fillRect(0,0,TUNING.width,142);
 skyReady=true;
};
// Cached, softly feathered wisps drift below the island; all hard geometry
// remains in the original collision cells. No new platforms or obstacles.
const mistPlate=document.createElement('canvas');mistPlate.width=840;mistPlate.height=150;
const mistBrush=mistPlate.getContext('2d');
for(let i=0;i<21;i++){
 const x=30+i*39,y=77+Math.sin(i*1.9)*18,r=40+Math.sin(i*2.7)*10;
 const puff=mistBrush.createRadialGradient(x,y,0,x,y,r);
 puff.addColorStop(0,'#fff0d134');puff.addColorStop(.5,'#fce9d719');puff.addColorStop(1,'#e5daeb00');
 mistBrush.fillStyle=puff;mistBrush.fillRect(x-r,y-r,r*2,r*2);
}
const soilPlate=document.createElement('canvas');soilPlate.width=TUNING.width;soilPlate.height=TUNING.height;
const soilBrush=soilPlate.getContext('2d');
const earth=soilBrush.createLinearGradient(0,270,0,590);
earth.addColorStop(0,'#dba66c');earth.addColorStop(.22,'#ba8052');earth.addColorStop(.55,'#986442');earth.addColorStop(.84,'#775047');earth.addColorStop(1,'#513c45');
soilBrush.fillStyle=earth;soilBrush.fillRect(0,0,TUNING.width,TUNING.height);
// Broad curving mineral seams, rather than a repeated grid pattern.
for(let layer=0;layer<8;layer++){
 const base=302+layer*36;soilBrush.beginPath();soilBrush.moveTo(0,base);
 for(let x=0;x<=TUNING.width;x+=16){const y=base+Math.sin(x*.008+layer*.8)*11+Math.sin(x*.019-layer)*3;soilBrush.lineTo(x,y);}
 soilBrush.lineTo(TUNING.width,base+22);soilBrush.lineTo(0,base+22);soilBrush.closePath();
 soilBrush.fillStyle=layer%2?'#382f371c':'#edb77524';soilBrush.fill();
}
const sceneryHash=(x,y)=>{const n=Math.sin(x*12.9898+y*78.233)*43758.5453;return n-Math.floor(n);};
// Stable fine grain and sparse embedded rock facets, baked only once.
for(let y=272;y<590;y+=4)for(let x=0;x<TUNING.width;x+=5){
 const n=sceneryHash(x,y);if(n>.64){soilBrush.fillStyle=n>.87?'#ffe0a317':'#382c3116';soilBrush.fillRect(x,y,1+n*2,1);}
}
for(let y=305;y<580;y+=31)for(let x=106;x<1180;x+=37){
 const n=sceneryHash(x,y);if(n<.63)continue;
 const px=x+(n-.5)*18,py=y+Math.sin(x*.03)*9,w=3+n*6,h=2+n*3;
 soilBrush.fillStyle='#352d3a36';soilBrush.beginPath();soilBrush.ellipse(px+1,py+2,w+1,h+1,.2,0,Math.PI*2);soilBrush.fill();
 soilBrush.fillStyle=n>.85?'#d3a472':'#8f7061';soilBrush.beginPath();soilBrush.moveTo(px-w,py);soilBrush.lineTo(px-w*.4,py-h);soilBrush.lineTo(px+w*.7,py-h*.5);soilBrush.lineTo(px+w,py+h*.4);soilBrush.lineTo(px-w*.2,py+h);soilBrush.closePath();soilBrush.fill();
 soilBrush.strokeStyle='#ffd6a24a';soilBrush.lineWidth=1;soilBrush.beginPath();soilBrush.moveTo(px-w,py);soilBrush.lineTo(px-w*.4,py-h);soilBrush.lineTo(px+w*.7,py-h*.5);soilBrush.stroke();
}
function rebuildTerrain(){
 tc.clearRect(0,0,TUNING.width,TUNING.height);
 // The visible silhouette is exactly the original dirt occupancy mask.
 tc.fillStyle='#fff';
 for(let r=0;r<terrain.rows;r++)for(let c=0;c<terrain.cols;c++)if(terrain.data[r*terrain.cols+c])tc.fillRect(c*TUNING.cell,r*TUNING.cell,TUNING.cell,TUNING.cell);
 tc.globalCompositeOperation='source-in';tc.drawImage(soilPlate,0,0);tc.globalCompositeOperation='source-over';
 // Light catches the top and right of every exposed cut; the underside
 // stays shaded. This treatment also follows tunnels and through-holes.
 for(let r=0;r<terrain.rows;r++)for(let c=0;c<terrain.cols;c++)if(terrain.data[r*terrain.cols+c]){
  const x=c*TUNING.cell,y=r*TUNING.cell;
  if(!terrain.solid(x,y-TUNING.cell)){tc.fillStyle='#f2c18b';tc.fillRect(x,y,TUNING.cell,1);}
  if(!terrain.solid(x,y+TUNING.cell)){tc.fillStyle='#362d3f80';tc.fillRect(x,y+TUNING.cell-2,TUNING.cell,2);}
  if(!terrain.solid(x-TUNING.cell,y)){tc.fillStyle='#40303f55';tc.fillRect(x,y,1,TUNING.cell);}
 }
 tc.save();tc.globalCompositeOperation='source-atop';tc.strokeStyle='#694a3f66';tc.lineWidth=1;
 for(let c=0;c<terrain.cols;c+=19){
  const x=c*TUNING.cell,top=terrain.originalTop[c];if(!Number.isFinite(top)||terrain.floor(x,0)!==top)continue;
  tc.beginPath();tc.moveTo(x,top+2);tc.bezierCurveTo(x+3,top+11,x-5,top+20,x+2,top+34);tc.moveTo(x,top+15);tc.lineTo(x+9,top+23);tc.stroke();
 }tc.restore();
 // Existing grass only: freshly excavated craters and added mounds stay bare.
 for(let c=0;c<terrain.cols;c++){
  const x=c*TUNING.cell,y=terrain.floor(x,0);if(!Number.isFinite(y))continue;
  const intact=y===terrain.originalTop[c];
  tc.fillStyle=intact?'#666b3c':'#ae774d';tc.fillRect(x,y,TUNING.cell,intact?5:2);
  tc.fillStyle=intact?'#bfc57b':'#ecc08d';tc.fillRect(x,y,TUNING.cell,1);
  if(intact&&c%7===0&&terrain.solid(x,y+12)){
   tc.strokeStyle=c%2?'#bdc676':'#8c9b57';tc.lineWidth=1.5;tc.beginPath();tc.moveTo(x+2,y);tc.lineTo(x-1,y-5);tc.moveTo(x+2,y);tc.lineTo(x+5,y-3);tc.stroke();
  }
 }
 // Bake expensive soft lighting only when dirt actually changes.
 litBrush.clearRect(0,0,TUNING.width,TUNING.height);litBrush.save();
 litBrush.shadowColor='#42334766';litBrush.shadowBlur=24;litBrush.shadowOffsetY=15;
 litBrush.drawImage(terrainCanvas,0,0);litBrush.restore();
}
function rounded(x,y,w,h,r,color){ctx.fillStyle=color;ctx.beginPath();ctx.roundRect(x,y,w,h,r);ctx.fill();}
function ellipse(x,y,rx,ry,color){ctx.fillStyle=color;ctx.beginPath();ctx.ellipse(x,y,rx,ry,0,0,Math.PI*2);ctx.fill();}
function drawTank(t){
 const player=t===tanks[0],light=player?'#a2efff':game.rival.light,dark=player?'#177f9e':game.rival.dark;
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
 const recoil=t.recoil/TUNING.recoilTime*TUNING.recoilPixels;
 rounded(-recoil,-6,TUNING.barrel,12,3,'#303b48');rounded(-recoil,-4,TUNING.barrel,8,2,dark);rounded(2-recoil,-4,TUNING.barrel-5,3,1,light);rounded(TUNING.barrel-6-recoil,-7,9,14,3,'#35424c');rounded(TUNING.barrel-4-recoil,-5,6,10,2,t.color);
 ctx.restore();
}
function drawFallbackSky(){
 const sky=ctx.createLinearGradient(0,0,0,TUNING.height);sky.addColorStop(0,'#df8978');sky.addColorStop(.48,'#ffd995');sky.addColorStop(.78,'#f4d6af');sky.addColorStop(1,'#9faec7');ctx.fillStyle=sky;ctx.fillRect(0,0,TUNING.width,TUNING.height);
 const halo=ctx.createRadialGradient(920,188,20,920,188,230);halo.addColorStop(0,'#fff6b9ae');halo.addColorStop(1,'#fff6b900');ctx.fillStyle=halo;ctx.fillRect(650,0,540,450);
 ellipse(920,188,63,63,'#fff2ba');
 // Soft high haze, then low cloudbanks beneath the finite island.
 ctx.fillStyle='#fff5dc22';ctx.beginPath();ctx.ellipse(530,190,220,6,-.04,0,Math.PI*2);ctx.fill();
 for(let i=0;i<9;i++){const x=((i*193+clock*(3+i%3))%1500)-110,y=592+(i%3)*37;
  for(let j=0;j<4;j++){ellipse(x+j*34,y+9,61,21+j%2*8,'#c7bfd066');ellipse(x+j*34,y,58,18+j%2*9,'#fff1db');}
 }
}
function drawSky(){
 if(!skyReady){drawFallbackSky();return;}
 ctx.drawImage(skyPlate,0,0);
 // Slow atmospheric motion entirely below the gameplay surface. These
 // wisps are translucent: a falling tank stays visible past the clouds.
 const drift=(clock*4)%1900;
 ctx.drawImage(mistPlate,drift-840,575,840,150);
 ctx.globalAlpha=.52;ctx.drawImage(mistPlate,1060-drift*.45,607,1100,150);ctx.globalAlpha=1;
}
function render(){
 drawSky();ctx.save();if(shake>0)ctx.translate(Math.sin(clock*93)*TUNING.shakePixels*shake/TUNING.shakeTime,Math.cos(clock*81)*TUNING.shakePixels*shake/TUNING.shakeTime);ctx.drawImage(litTerrain,0,0);
 for(const path of ghost){ctx.setLineDash([4,10]);ctx.beginPath();path.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));ctx.strokeStyle='#49384b26';ctx.lineWidth=5;ctx.stroke();ctx.strokeStyle=`rgba(255,255,255,${TUNING.ghostOpacity})`;ctx.lineWidth=3;ctx.stroke();ctx.setLineDash([]);}
 tanks.forEach(drawTank);
 for(const p of game.projectiles){ellipse(p.x,p.y,9,9,'#ffefbd22');ellipse(p.x,p.y,p.weapon==='heavy'?7:4,p.weapon==='heavy'?7:4,p.weapon==='dirt'?'#b4c570':p.weapon==='roller'?'#e2bb7d':p.weapon==='drill'?'#b7d4df':'#fff4c9');}
 for(const p of particles){ctx.save();ctx.translate(p.x,p.y);ctx.rotate(p.age*9);rounded(-3,-3,6,6,1,'#945537');ctx.restore();}
 for(const blast of blasts){const k=blast.age/TUNING.explosionLife;ctx.strokeStyle=`rgba(255,240,176,${1-k})`;ctx.lineWidth=6*(1-k);ctx.beginPath();ctx.arc(blast.x,blast.y,blast.radius*(.4+k*1.3),0,Math.PI*2);ctx.stroke();
  for(let i=0;i<8;i++){const a=i*Math.PI/4,spread=k*blast.radius*.7;ellipse(blast.x+Math.cos(a)*spread,blast.y+Math.sin(a)*spread,blast.radius*(1-k)*.55,blast.radius*(1-k)*.55,blast.weapon==='dirt'?`rgba(172,141,91,${1-k})`:`rgba(255,${125+i*12},65,${1-k})`);}
  ellipse(blast.x,blast.y,blast.radius*(1-k)*.6,blast.radius*(1-k)*.6,`rgba(255,249,204,${1-k})`);
 }
 ctx.font='800 12px system-ui';ctx.textAlign='center';tanks.forEach((t,i)=>{rounded(t.x-37,t.y-89,74,20,9,'#3b3a4b');ctx.fillStyle=i===0?'#a2efff':game.rival.light;ctx.fillText(i===0?'YOU':(game.rivalName||'Rookie').toUpperCase(),t.x,t.y-75);rounded(t.x-32,t.y-65,64,6,3,'#3b3a4b');rounded(t.x-31,t.y-64,62*t.hp/TUNING.maxHP,4,2,t.hp>30?t.color:'#ff7564');ctx.font='700 11px system-ui';ctx.fillStyle='#453b4c';ctx.fillText(t.buried?'BURIED':t.hp+' HP',t.x,t.y-50);});
 ctx.restore();
 for(const text of floatTexts){ctx.globalAlpha=Math.max(0,1-text.age/TUNING.floatTextTime);ctx.font='900 19px system-ui';ctx.fillStyle=text.cause==='burial'?'#f9e1a7':'#fff5d7';ctx.strokeStyle='#633d46';ctx.lineWidth=3;const label='−'+text.amount;ctx.strokeText(label,text.x,text.y-text.age*28);ctx.fillText(label,text.x,text.y-text.age*28);ctx.globalAlpha=1;}
}
function updateUI(){
 const t=game.tanks[0],human=game.phase==='aim'&&game.turn===0;
 angle.disabled=power.disabled=fire.disabled=weaponSelect.disabled=!human;
 angle.value=t.angle;power.value=t.power;
 document.querySelector('#angleValue').textContent=t.angle+'°';document.querySelector('#powerValue').textContent=t.power;
 windLabel.textContent=`${game.wind<0?'←':game.wind>0?'→':'•'} ${Math.abs(game.wind)}`;
 document.querySelector('#score').textContent=`YOU ${game.scores[0]} : ${game.scores[1]} ${ (game.rivalName||'Rookie').toUpperCase()}`;
 document.querySelector('#round').textContent=`RIVAL ${game.rivalIndex+1}/${RIVALS.length} · ROUND ${game.round} · FIRST TO ${TUNING.winsToMatch}`;
 status.textContent=game.result||(game.phase==='aim'?(human?(t.buried?'Buried! Fire to dig yourself out':t.turretBlocked?'Turret blocked · blast a way out':'Your turn · make the ground move'):(game.rivalName||'Rookie')+' is aiming…'):game.phase==='flight'?WEAPONS[game.projectiles[0]?.weapon||'standard'].name+' away':'Let the dirt settle…');
 document.querySelector('#hint').textContent=WEAPONS[t.weapon].description+(t.turretBlocked?' · Your muzzle is blocked by dirt.':'');
 const stamp=JSON.stringify([game.phase,game.draftActor,game.offer,t.ammo,t.weapon,game.scores,game.rivalIndex]);
 if(uiStamp===stamp)return;uiStamp=stamp;
 weaponSelect.replaceChildren(...Object.keys(WEAPONS).filter(id=>id==='standard'||t.ammo[id]>0).map(id=>{const o=document.createElement('option');o.value=id;o.textContent=`${WEAPONS[id].name} · ${id==='standard'?'∞':t.ammo[id]}`;return o;}));weaponSelect.value=t.weapon in WEAPONS&&t.ammo[t.weapon]!==0?t.weapon:'standard';
 const overlay=document.querySelector('#overlay'),title=document.querySelector('#panelTitle'),copy=document.querySelector('#panelCopy'),choices=document.querySelector('#choices'),advance=document.querySelector('#advance');
 const show=['roundOver','matchOver','draft'].includes(game.phase);overlay.hidden=!show;choices.replaceChildren();advance.hidden=game.phase==='draft';
 if(game.phase==='draft'){
  title.textContent=game.draftActor===0?'Choose your terrain tool':'Rival is drafting…';copy.textContent=`Loser picks first · each weapon gives ${TUNING.draftAmmo} shots · unused ammo carries through this match.`+(game.draftTaken.length?` ${game.draftOrder[0]===0?'You':game.rivalName} chose ${WEAPONS[game.draftTaken[0]].name}.`:'');
  for(const id of game.offer){const w=WEAPONS[id],b=document.createElement('button');b.className='weapon-card';b.disabled=game.draftActor!==0;const icon=document.createElement('span');icon.className='weapon-symbol';icon.textContent=w.symbol;const name=document.createElement('strong');name.textContent=w.name;const desc=document.createElement('small');desc.textContent=w.description;const ammo=document.createElement('em');ammo.textContent=`${TUNING.draftAmmo} SHOTS`;b.append(icon,name,desc,ammo);b.onclick=()=>{game.draft(id);consumeEvents();updateUI();};choices.append(b);}
 }else if(game.phase==='roundOver'){
  title.textContent=game.result;copy.textContent=`You ${game.scores[0]} — ${game.scores[1]} ${game.rivalName||'Rookie'}. Next round gets a fresh island.`;advance.textContent=game.winner===null?'Replay round':'Draft weapons →';
 }else if(game.phase==='matchOver'){
  const won=game.scores[0]>=TUNING.winsToMatch,champion=won&&game.rivalIndex===RIVALS.length-1;
  title.textContent=champion?'Sky champion!':won?game.rivalName+' defeated!':'Match lost';
  copy.textContent=champion?'Rookie, Regular, Deadeye — you cleared the ladder.':`You ${game.scores[0]} — ${game.scores[1]} ${game.rivalName}. `+(won?RIVALS[game.rivalIndex+1].title:'A fresh match and island await.');
  advance.textContent=champion?'Climb again':won?'Face '+RIVALS[game.rivalIndex+1].name+' →':'Retry '+game.rivalName;
 }
}
function consumeEvents(){
 for(const event of game.events.splice(0)){
  if(event.type==='impact'){
   blasts.push({...event,age:0});if(event.weapon==='heavy')shake=TUNING.shakeTime;
   for(let i=0;i<TUNING.particles;i++)particles.push({x:event.x,y:event.y,vx:random(-TUNING.particleSpeed,TUNING.particleSpeed),vy:random(-TUNING.particleSpeed,0),age:0});
  }else if(event.type==='damage')floatTexts.push({...event,age:0});
  else if(event.type==='round'){particles=[];blasts=[];floatTexts=[];shake=0;}
 }
}
function tick(dt){
 game.update(dt);consumeEvents();
 for(const p of particles){p.age+=dt;p.x+=p.vx*dt;p.y+=p.vy*dt;p.vy+=TUNING.tankGravity*dt;}particles=particles.filter(p=>p.age<TUNING.particleLife);
 for(const b of blasts)b.age+=dt;blasts=blasts.filter(b=>b.age<TUNING.explosionLife);
 for(const text of floatTexts)text.age+=dt;floatTexts=floatTexts.filter(t=>t.age<TUNING.floatTextTime);shake=Math.max(0,shake-dt);
 for(const [key,k] of keys){k.time+=dt;if(k.time>=k.next){adjust(key);k.next+=TUNING.keyRepeat;}}
}
function adjust(key){if(game.phase!=='aim'||game.turn!==0)return;const t=game.tanks[0];if(key==='ArrowUp')t.angle=clamp(t.angle+TUNING.aimStep,TUNING.minAngle,TUNING.maxAngle);if(key==='ArrowDown')t.angle=clamp(t.angle-TUNING.aimStep,TUNING.minAngle,TUNING.maxAngle);if(key==='ArrowRight')t.power=clamp(t.power+TUNING.aimStep,TUNING.minPower,TUNING.maxPower);if(key==='ArrowLeft')t.power=clamp(t.power-TUNING.aimStep,TUNING.minPower,TUNING.maxPower);updateUI();}
angle.oninput=()=>{if(!angle.disabled)game.tanks[0].angle=+angle.value;updateUI();};power.oninput=()=>{if(!power.disabled)game.tanks[0].power=+power.value;updateUI();};weaponSelect.onchange=()=>{if(!weaponSelect.disabled)game.selectWeapon(weaponSelect.value);updateUI();};fire.onclick=()=>{if(game.turn===0)game.shoot();consumeEvents();updateUI();};
document.querySelector('#restart').onclick=()=>{game.restart();keys.clear();consumeEvents();updateUI();};document.querySelector('#advance').onclick=()=>{game.advance();keys.clear();consumeEvents();updateUI();};
window.addEventListener('keydown',e=>{if(e.target instanceof HTMLSelectElement)return;if(e.code==='Space'||e.key.startsWith('Arrow')){e.preventDefault();if(e.repeat)return;if(e.code==='Space'){if(game.turn===0&&game.phase==='aim')game.shoot();}else{adjust(e.key);keys.set(e.key,{time:0,next:TUNING.keyDelay});}}});window.addEventListener('keyup',e=>keys.delete(e.key));window.addEventListener('blur',()=>keys.clear());document.addEventListener('visibilitychange',()=>{keys.clear();last=0;accumulator=0;});
function frame(ms){if(!last)last=ms;accumulator+=Math.min((ms-last)/1000,TUNING.maxFrame);last=ms;while(accumulator>=TUNING.step){tick(TUNING.step);accumulator-=TUNING.step;}
 terrain=game.terrain;tanks=game.tanks;shot=game.projectiles[0];ghost=game.ghost;clock=game.clock;
 if(terrainRef!==terrain||terrainVersion!==terrain.version){rebuildTerrain();terrainRef=terrain;terrainVersion=terrain.version;}
 updateUI();render();requestAnimationFrame(frame);
}
consumeEvents();updateUI();requestAnimationFrame(frame);
// Test inspection only. Gameplay/AI never call a hidden trajectory predictor.
window.scorchedDebug={game,getState:()=>({...game,shot:game.projectiles[0]}),restart:()=>game.restart(),update:dt=>{tick(dt);updateUI();}};
}
