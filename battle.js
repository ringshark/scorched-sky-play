'use strict';
// Battle-mode playtest numbers. Shared ballistics/falls/bedrock use TUNING
// in game.js; this block contains all Battle-specific design values.
const BATTLE_TUNING=Object.freeze({
 width:2560,surface:400,hills:24,detail:9,pad:34,hillFrequency:.009,detailFrequency:.021,
 spawns:[600,1020,820,1960,1540,1740],buildings:[440,1160,1400,2120],
 tankHP:100,gunnerHP:60,rocketHP:55,tankMove:110,gunnerMove:150,rocketMove:125,
 speed:78,tankDamage:30,rocketDamage:45,rocketInfantryDamage:28,
 tankCrater:46,rocketCrater:38,tankSplash:70,rocketSplash:62,
 gunRange:850,gunShots:6,gunDamage:5,gunArmorDamage:1,gunBuildingDamage:3,
 gunSpread:.018,gunInterval:.11,gunTraceLife:.18,
 airCalls:1,airBombs:3,airSpacing:42,airDelay:.32,airStartY:-20,airSpeed:120,airDamage:24,airCrater:36,airSplash:58,
 aiDelay:1,aiMove:100,aiAngle:48,aiAngleError:4,aiPowerError:3,aiGuessError:10,
 aiCorrectionLimit:12,aiMinRange:90,aiAdvanceRange:680,aiAvoidanceGap:5,
 settleTimeout:4,initialPower:70,border:30,cameraSpeed:8,cameraLead:220,
 debrisCount:26,debrisSpeed:180,debrisLife:1.8,blastLife:.5,
});
const BC=typeof module!=='undefined'?require('./game.js'):{TUNING,Terrain,DuelGame,makeTank,moveTank,checkBurial,clamp,random};
// Node imports don't export small helpers; browser shares the classic script's lexical scope.
const BT=BATTLE_TUNING,CT=BC.TUNING;
const bClamp=(n,a,b)=>Math.max(a,Math.min(b,n)),bRandom=(a,b)=>a+Math.random()*(b-a);
const UNIT_TYPES=Object.freeze({
 tank:{name:'Tank',short:'TANK',hp:BT.tankHP,move:BT.tankMove,description:'Arcing shell · heavy armor · terrain destruction'},
 gunner:{name:'Machine guns',short:'MG SQUAD',hp:BT.gunnerHP,move:BT.gunnerMove,description:'Select a target · direct burst · best against troops'},
 rocket:{name:'Rocket squad',short:'ROCKETS',hp:BT.rocketHP,move:BT.rocketMove,description:'Arcing rocket · strong against tanks and buildings'},
});
class BattleTerrain extends BC.Terrain {
 constructor(){super(BT.width);}
 generate(){const phase=bRandom(0,Math.PI*2);for(let c=0;c<this.cols;c++){
  const x=c*CT.cell;let top=BT.surface+Math.sin(x*BT.hillFrequency+phase)*BT.hills+Math.sin(x*BT.detailFrequency+phase)*BT.detail;
  for(const spawn of [...BT.spawns,...BT.buildings]){const mix=bClamp((Math.abs(x-spawn)-BT.pad)/BT.pad,0,1);top=BT.surface+(top-BT.surface)*mix;}
  this.originalTop[c]=Math.ceil(top/CT.cell)*CT.cell;
  for(let r=this.originalTop[c]/CT.cell;r<this.rows;r++)this.data[r*this.cols+c]=1;
 }this.version++;}
}
class BattleGame extends BC.DuelGame {
 restart(){
  this.clock=0;this.events=[];this.terrain=new BattleTerrain();
  this.tanks=BT.spawns.map((x,i)=>Object.assign(BC.makeTank(x,i<3?'#4fc9ed':'#f58273',i<3?45:135),{id:i,side:i<3?0:1,kind:['tank','gunner','rocket'][i%3],hp:UNIT_TYPES[['tank','gunner','rocket'][i%3]].hp,y:this.terrain.floor(x,0),used:false,power:BT.initialPower,driveLeft:UNIT_TYPES[['tank','gunner','rocket'][i%3]].move,ghost:[],aiPower:BT.initialPower+bRandom(-BT.aiGuessError,BT.aiGuessError),observation:null}));
  this.buildings=BT.buildings.map((x,i)=>({id:i,x,y:this.terrain.floor(x,0),width:CT.buildingWidth,height:CT.buildingHeight,hp:CT.buildingHP}));
  this.rubble=[];this.air=[BT.airCalls,BT.airCalls];this.round=1;this.side=0;this.turn=0;this.targetId=4;this.phase='aim';this.committed=false;this.driveDirection=0;
  this.projectiles=[];this.burst=null;this.actionPaths=[];this.actionLandings=[];this.result='';this.winner=null;this.stable=0;this.settleAge=0;this.rollWind();this.emit('battle');
 }
 get active(){return this.tanks[this.turn];}
 ready(side){return this.tanks.filter(t=>t.side===side&&t.hp>0&&!t.used);}
 rollWind(){this.wind=Math.round(bRandom(-CT.windMax,CT.windMax));this.timer=BT.aiDelay;this.aiMoveLeft=BT.aiMove;}
 select(id){const t=this.tanks[id];if(this.phase!=='aim'||this.side!==0||this.committed||!t||t.side!==0||t.used||t.hp<=0)return false;this.turn=id;this.driveDirection=0;return true;}
 setTarget(id){const t=this.tanks[id];if(t&&t.hp>0&&t.side!==this.side)this.targetId=id;}
 setDrive(direction){this.driveDirection=this.phase==='aim'&&this.side===0?Math.sign(direction):0;}
 commit(){
  if(this.committed)return this.active.hp>0;this.committed=true;BC.checkBurial(this.active,this.terrain);
  if(this.active.buried)this.damage(this.active,CT.burialDamage,'burial');
  if(this.active.hp<=0){this.finishAction();return false;}return true;
 }
 canFire(){return this.phase==='aim'&&this.active.hp>0&&this.active.grounded&&Math.abs(this.active.vx)<CT.settleSpeed;}
 drive(direction,dt){
  const t=this.active;BC.checkBurial(t,this.terrain);
  if(!direction||this.phase!=='aim'||!t.grounded||t.embedded||Math.abs(t.vx)>=CT.settleSpeed||t.driveLeft<=0)return 0;
  const distance=Math.min(BT.speed*dt,t.driveLeft),steps=Math.max(1,Math.ceil(distance/CT.cell));let moved=0;
  for(let i=0;i<steps;i++){
   const x=bClamp(t.x+Math.sign(direction)*distance/steps,BT.border,BT.width-BT.border),front=x+Math.sign(direction)*CT.tankHalfWidth;
   if(x===t.x||this.terrain.solid(front,t.y-CT.tankHalfWidth))break;
   const floor=this.terrain.floor(x,t.y-CT.driveMaxStep);if(!Number.isFinite(floor))break;
   if(this.buildings.some(b=>b.hp>0&&x+CT.tankHalfWidth>b.x-b.width/2&&x-CT.tankHalfWidth<b.x+b.width/2&&t.y>b.y-b.height&&t.y-CT.tankHeight<b.y))break;
   if(this.tanks.some(o=>o!==t&&o.hp>0&&Math.abs(o.x-x)<CT.tankHalfWidth*2&&Math.abs(o.y-t.y)<CT.tankHeight))break;
   if(!this.commit())return moved;const step=Math.abs(x-t.x);t.x=x;moved+=step;t.driveLeft=Math.max(0,t.driveLeft-step);if(t.driveLeft<1e-6)t.driveLeft=0;
   if(floor-t.y<=CT.driveMaxStep)t.y=floor;else {t.grounded=false;t.fallStart=t.y;break;}
  }return moved;
 }
 prepareAction(){this.actionOwner=this.turn;this.actionPaths=[];this.actionLandings=[];this.driveDirection=0;this.phase='flight';this.active.recoil=CT.recoilTime;this.shotOrigin={x:this.active.x,power:this.active.power,targetX:this.tanks[this.targetId]?.x??this.active.x};}
 shoot(){
  if(!this.canFire()||!this.commit())return false;
  const t=this.active;this.prepareAction();
  if(t.kind==='gunner'){
   const target=this.tanks[this.targetId];if(!target||target.hp<=0||target.side===t.side){this.finishAction();return false;}
   this.burst={left:BT.gunShots,timer:0,owner:t.id,target:target.id};return true;
  }
  const r=t.angle*Math.PI/180,s=CT.maxSpeed*t.power/100,pivot={x:t.x,y:t.y-CT.tankHeight};let distance=CT.barrel;
  for(let d=0;d<=CT.barrel;d+=CT.cell/2)if(this.solid(pivot.x+Math.cos(r)*d,pivot.y-Math.sin(r)*d)){distance=d;break;}
  const p={x:pivot.x+Math.cos(r)*distance,y:pivot.y-Math.sin(r)*distance,vx:Math.cos(r)*s,vy:-Math.sin(r)*s,owner:t.id,kind:t.kind,weapon:'standard',alive:true,age:0,path:[]};
  this.projectiles=[p];if(distance<CT.barrel)this.impact(p,true);this.emit('fire',{x:p.x,y:p.y});return true;
 }
 callAir(x){
  if(!Number.isFinite(x)||!this.canFire()||this.air[this.side]<=0||!this.commit())return false;
  this.air[this.side]--;this.prepareAction();this.shotOrigin=null;x=bClamp(x,BT.border,BT.width-BT.border);
  this.projectiles=Array.from({length:BT.airBombs},(_,i)=>({x:bClamp(x+(i-(BT.airBombs-1)/2)*BT.airSpacing,BT.border,BT.width-BT.border),y:BT.airStartY,vx:0,vy:BT.airSpeed,owner:this.turn,kind:'air',weapon:'standard',alive:true,age:0,delay:i*BT.airDelay,path:[]}));
  this.emit('air',{x,y:100,side:this.side});return true;
 }
 hold(){if(this.phase!=='aim'||!this.commit())return false;this.actionOwner=this.turn;this.finishAction();return true;}
 stepBurst(dt){
  const burst=this.burst;if(!burst)return;burst.timer-=dt;if(burst.timer>0)return;burst.timer=BT.gunInterval;
  const t=this.tanks[burst.owner],target=this.tanks[burst.target],ox=t.x,oy=t.y-CT.tankHeight;
  const angle=Math.atan2(target.y-CT.tankHeight/2-oy,target.x-ox)+bRandom(-BT.gunSpread,BT.gunSpread);
  let x=ox,y=oy;
  for(let d=CT.tankHalfWidth;d<=BT.gunRange;d+=CT.cell/2){
   x=ox+Math.cos(angle)*d;y=oy+Math.sin(angle)*d;
   const hit=this.tanks.find(o=>o.id!==t.id&&o.hp>0&&Math.hypot(o.x-x,o.y-CT.tankHeight/2-y)<CT.directHitRadius);
   if(hit){this.damage(hit,hit.kind==='tank'?BT.gunArmorDamage:BT.gunDamage,'machine guns');break;}
   const building=this.buildingAt(x,y);if(building){this.damageBuildings(x,y,{damage:BT.gunBuildingDamage,splash:1});break;}
   if(this.terrain.solid(x,y)||x<0||x>BT.width)break;
  }
  this.emit('tracer',{x:ox,y:oy,tx:x,ty:y});this.actionPaths.push([[ox,oy],[x,y]]);
  if(--burst.left<=0)this.burst=null;
 }
 stepProjectile(p,dt){
  if(p.delay>0){p.delay-=dt;return;}
  p.age+=dt;p.vx+=(p.kind==='air'?0:this.wind)*dt;p.vy+=CT.gravity*dt;
  const dx=p.vx*dt,dy=p.vy*dt,steps=Math.max(1,Math.ceil(Math.hypot(dx,dy)/(CT.cell/2)));
  for(let i=0;i<steps&&p.alive;i++){
   p.x+=dx/steps;p.y+=dy/steps;p.path.push([p.x,p.y]);
   const hit=this.tanks.find(t=>t.hp>0&&Math.hypot(p.x-t.x,p.y-(t.y-CT.tankHeight/2))<CT.directHitRadius);
   if(this.solid(p.x,p.y)||hit){this.impact(p,true,hit?.id??null);break;}
   if(p.x<0||p.x>BT.width||p.y>CT.height||p.age>CT.projectileLife)this.impact(p,false);
  }
 }
 impact(p,hit,direct=null){
  if(!p.alive)return;p.alive=false;this.actionPaths.push(p.path.slice());this.actionLandings.push(p.x);
  if(!hit)return;
  const air=p.kind==='air',rocket=p.kind==='rocket',radius=air?BT.airCrater:rocket?BT.rocketCrater:BT.tankCrater,splash=air?BT.airSplash:rocket?BT.rocketSplash:BT.tankSplash,base=air?BT.airDamage:rocket?BT.rocketDamage:BT.tankDamage;
  const shield=this.tanks.map(t=>this.shielded(p.x,p.y,t));
  for(const t of this.tanks){const d=Math.hypot(t.x-p.x,t.y-CT.tankHeight/2-p.y),damage=rocket&&t.kind!=='tank'?BT.rocketInfantryDamage:base;this.damage(t,t.id===direct?damage:damage*Math.max(0,1-d/splash)*(shield[t.id]?CT.buildingShield:1),'explosion');}
  this.terrain.crater(p.x,p.y,radius);this.damageBuildings(p.x,p.y,{damage:base,splash});this.checkBuildings();this.emit('impact',{x:p.x,y:p.y,radius,weapon:p.kind});
 }
 finishAction(){
  const t=this.active;t.ghost=this.actionPaths.slice();
  if(t.side===1&&t.kind!=='gunner'&&this.actionLandings.length&&this.shotOrigin){
   const landing=this.actionLandings.reduce((a,b)=>a+b,0)/this.actionLandings.length,origin=this.shotOrigin,wanted=Math.abs(origin.targetX-origin.x),actual=Math.abs(landing-origin.x);
   if(actual>BT.aiMinRange)t.aiPower=bClamp(t.aiPower+bClamp(origin.power*Math.sqrt(wanted/actual)-t.aiPower,-BT.aiCorrectionLimit,BT.aiCorrectionLimit),0,100);
   else t.aiPower=bClamp(t.aiPower+BT.aiCorrectionLimit,0,100);
   t.observation={originX:origin.x,targetX:origin.targetX};
  }
  this.shotOrigin=null;this.actionPaths=[];this.actionLandings=[];this.burst=null;this.projectiles=[];this.driveDirection=0;t.used=true;this.phase='settle';this.stable=0;this.settleAge=0;
 }
 nextActivation(){
  if(this.checkRoundEnd())return;
  if(!this.ready(0).length&&!this.ready(1).length){this.round++;this.tanks.forEach(t=>{t.used=false;t.driveLeft=UNIT_TYPES[t.kind].move;});}
  this.side=1-this.side;if(!this.ready(this.side).length)this.side=1-this.side;
  const available=this.ready(this.side);this.turn=available[0].id;this.committed=false;this.phase='aim';this.driveDirection=0;
  const enemy=this.tanks.filter(t=>t.side!==this.side&&t.hp>0).sort((a,b)=>Math.abs(a.x-this.active.x)-Math.abs(b.x-this.active.x))[0];this.targetId=enemy.id;this.rollWind();this.emit('activation',{id:this.turn,side:this.side});
 }
 checkRoundEnd(){
  if(this.phase==='over')return true;const alive=[0,1].map(side=>this.tanks.some(t=>t.side===side&&t.hp>0));
  if(alive.every(Boolean))return false;this.winner=alive[0]?0:alive[1]?1:null;this.result=this.winner===0?'Battle won':this.winner===1?'Battle lost':'Battle drawn';this.phase='over';this.driveDirection=0;this.projectiles=[];this.burst=null;return true;
 }
 aiAct(dt){
  const t=this.active,enemies=this.tanks.filter(o=>o.side!==t.side&&o.hp>0);
  const target=enemies.sort((a,b)=>Math.abs(a.x-t.x)-Math.abs(b.x-t.x))[0];this.targetId=target.id;
  if(this.aiMoveLeft>0){
   const gap=Math.abs(target.x-t.x);let direction=gap>BT.aiAdvanceRange?Math.sign(target.x-t.x):0;
   const cover=this.buildings.filter(b=>b.hp>0&&(b.x-t.x)*(target.x-t.x)>0&&Math.abs(b.x-t.x)<BT.aiAdvanceRange).sort((a,b)=>Math.abs(a.x-t.x)-Math.abs(b.x-t.x))[0];
   if(t.kind!=='gunner'&&cover&&Math.abs(cover.x-t.x)>cover.width/2+CT.tankHalfWidth+BT.aiAvoidanceGap)direction=Math.sign(cover.x-t.x);
   const moved=direction?this.drive(direction,dt):0;this.aiMoveLeft=moved?Math.max(0,this.aiMoveLeft-moved):0;return;
  }
  this.timer-=dt;if(this.timer>0||!this.canFire())return;
  if(this.air[this.side]>0&&(this.round>=2||enemies.some(o=>o!==target&&Math.abs(o.x-target.x)<BT.airSpacing*2))){this.callAir(target.x);return;}
  if(t.observation){const old=Math.abs(t.observation.targetX-t.observation.originX),now=Math.abs(target.x-t.x);if(old>BT.aiMinRange)t.aiPower=bClamp(t.aiPower*Math.sqrt(now/old),0,100);}
  const elevation=BT.aiAngle+bRandom(-BT.aiAngleError,BT.aiAngleError);t.angle=Math.round(target.x<t.x?180-elevation:elevation);t.power=Math.round(bClamp(t.aiPower+bRandom(-BT.aiPowerError,BT.aiPowerError),0,100));this.shoot();
 }
 update(dt){
  if(this.phase==='over')return;this.clock+=dt;
  if(this.phase==='aim'&&this.side===0&&this.driveDirection)this.drive(this.driveDirection,dt);
  for(const t of this.tanks){if(t.hp<=0)continue;const ox=t.x;t.recoil=Math.max(0,t.recoil-dt);BC.moveTank(t,this.terrain,dt,(...args)=>this.damage(...args));t.x=bClamp(t.x,BT.border,BT.width-BT.border);if(t.x===BT.border||t.x===BT.width-BT.border)t.vx=0;
   if(this.buildings.some(b=>b.hp>0&&t.x+CT.tankHalfWidth>b.x-b.width/2&&t.x-CT.tankHalfWidth<b.x+b.width/2&&t.y>b.y-b.height&&t.y-CT.tankHeight<b.y)||this.tanks.some(o=>o!==t&&o.hp>0&&Math.abs(o.x-t.x)<CT.tankHalfWidth*2&&Math.abs(o.y-t.y)<CT.tankHeight)){t.x=ox;t.vx=0;}
  }
  if(this.phase==='flight'){this.stepBurst(dt);for(const p of this.projectiles)if(p.alive)this.stepProjectile(p,dt);this.projectiles=this.projectiles.filter(p=>p.alive);if(!this.burst&&!this.projectiles.length)this.finishAction();}
  if(this.checkRoundEnd())return;
  if(this.phase==='aim'&&this.active.hp<=0)this.finishAction();
  if(this.phase==='settle'){this.settleAge+=dt;if(this.tanks.every(t=>t.hp<=0||(t.grounded&&Math.abs(t.vx)<CT.settleSpeed)))this.stable+=dt;else this.stable=0;if(this.stable>=CT.settleTime||this.settleAge>BT.settleTimeout)this.nextActivation();}
  if(this.phase==='aim'&&this.side===1)this.aiAct(dt);
 }
}
if(typeof module!=='undefined')module.exports={BATTLE_TUNING,UNIT_TYPES,BattleTerrain,BattleGame};
