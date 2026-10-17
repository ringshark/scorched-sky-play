'use strict';
// First portrait prototype. All gameplay values live here; the side-view engines are unchanged.
const TACTICS_TUNING=Object.freeze({
 cols:9,rows:12,cell:48,deployRows:3,tankHP:100,gunnerHP:60,rocketHP:55,
 tankMove:3,gunnerMove:4,rocketMove:3,tankRange:6,gunnerRange:5,rocketRange:6,
 tankDamage:30,gunnerDamage:30,gunnerArmorDamage:6,rocketDamage:45,rocketInfantryDamage:28,
 buildingHP:60,rockHP:70,treeHP:20,sandbagHP:25,gunCoverDamage:9,
 coverMultiplier:.6,roughCost:2,splashMultiplier:.3,airCalls:1,airDamage:24,
 actionDelay:.65,moveDelay:.12,aiDelay:.7,traceStep:.08,
 aiShotWeight:12,aiCoverWeight:2,aiMovePenalty:.12,aiAdvanceThreshold:.1,
 friendlyRow:10,enemyRow:1,spawnColumns:[1,4,7,7,4,1],airOffsets:[-1,0,1],blastRadius:1,
 coverLayout:[['building',2,4],['building',6,7],['rock',6,4],['rock',2,7],['tree',1,5],['tree',7,6],['tree',7,3],['tree',1,8],['sandbag',4,4],['sandbag',4,7],['sandbag',2,3],['sandbag',6,8]],
});
const TT=TACTICS_TUNING;
const TACTICS_TYPES=Object.freeze({
 tank:{name:'Tank',short:'TANK',hp:TT.tankHP,move:TT.tankMove,range:TT.tankRange},
 gunner:{name:'Machine guns',short:'MG SQUAD',hp:TT.gunnerHP,move:TT.gunnerMove,range:TT.gunnerRange},
 rocket:{name:'Rocket squad',short:'ROCKETS',hp:TT.rocketHP,move:TT.rocketMove,range:TT.rocketRange},
});
const tileKey=(x,y)=>x+','+y,tdist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
class TacticsGame {
 constructor(){this.restart();}
 restart(){
  this.phase='deploy';this.side=0;this.round=1;this.selected=0;this.committed=false;this.air=[TT.airCalls,TT.airCalls];this.events=[];this.wait=0;this.aiMoved=false;this.result='';this.winner=null;
  this.units=['tank','gunner','rocket','tank','gunner','rocket'].map((kind,i)=>({id:i,kind,side:i<3?0:1,x:TT.spawnColumns[i],y:i<3?TT.friendlyRow:TT.enemyRow,hp:TACTICS_TYPES[kind].hp,left:TACTICS_TYPES[kind].move,used:false,facing:i<3?0:Math.PI}));
  this.tiles=Array.from({length:TT.rows},(_,y)=>Array.from({length:TT.cols},(_,x)=>({x,y,kind:'field',hp:0,crater:false})));
  for(const [kind,x,y] of TT.coverLayout){this.tile(x,y).kind=kind;this.tile(x,y).hp=TT[kind==='sandbag'?'sandbagHP':kind+'HP'];}
  this.emit('restart');
 }
 emit(type,data={}){this.events.push({type,...data});}
 inside(x,y){return Number.isInteger(x)&&Number.isInteger(y)&&x>=0&&x<TT.cols&&y>=0&&y<TT.rows;}
 tile(x,y){return this.inside(x,y)?this.tiles[y][x]:null;}
 unitAt(x,y){return this.units.find(u=>u.hp>0&&u.x===x&&u.y===y);}
 solid(tile){return !!tile&&tile.hp>0&&['building','rock'].includes(tile.kind);}
 cost(tile){return tile.kind==='tree'&&tile.hp>0||tile.kind==='rubble'||tile.crater?TT.roughCost:1;}
 get active(){return this.units[this.selected];}
 ready(side){return this.units.filter(u=>u.side===side&&u.hp>0&&!u.used);}
 select(id){const u=this.units[id];if(!u||u.side!==0||u.hp<=0)return false;if(this.phase==='deploy'||this.phase==='aim'&&this.side===0&&!this.committed&&!u.used){this.selected=id;return true;}return false;}
 deploy(x,y){if(this.phase!=='deploy'||!this.inside(x,y)||y<TT.rows-TT.deployRows||this.solid(this.tile(x,y)))return false;const other=this.unitAt(x,y);if(other&&other!==this.active)return false;this.active.x=x;this.active.y=y;this.emit('deploy',{id:this.selected,x,y});return true;}
 start(){if(this.phase!=='deploy')return false;this.phase='aim';this.side=0;this.selected=0;this.emit('turn');return true;}
 reachable(u=this.active){
  const found=new Map([[tileKey(u.x,u.y),{x:u.x,y:u.y,cost:0,path:[]}]]),queue=[found.values().next().value];
  while(queue.length){queue.sort((a,b)=>a.cost-b.cost);const node=queue.shift();for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){
   const x=node.x+dx,y=node.y+dy,tile=this.tile(x,y);if(!tile||this.solid(tile)||this.unitAt(x,y)&&this.unitAt(x,y)!==u)continue;
   const cost=node.cost+this.cost(tile),key=tileKey(x,y);if(cost>u.left||found.has(key)&&found.get(key).cost<=cost)continue;const next={x,y,cost,path:[...node.path,{x,y}]};found.set(key,next);queue.push(next);
  }}return found;
 }
 move(x,y){
  if(this.phase!=='aim'||this.active.hp<=0)return false;const route=this.reachable().get(tileKey(x,y));if(!route||!route.path.length)return false;
  const u=this.active,from={x:u.x,y:u.y};u.facing=Math.atan2(x-u.x,u.y-y);u.x=x;u.y=y;u.left-=route.cost;this.committed=true;
  this.emit('move',{id:u.id,from,path:route.path});this.phase='moving';this.wait=route.path.length*TT.moveDelay;return true;
 }
 lineTo(x,y,u=this.active){
  if(!this.inside(x,y))return {clear:false,reason:'Outside battlefield'};
  const dx=x-u.x,dy=y-u.y,n=Math.ceil(Math.max(Math.abs(dx),Math.abs(dy))/TT.traceStep),visited=new Set();
  for(let i=1;i<=n;i++){
   const tx=Math.floor(u.x+.5+dx*i/n),ty=Math.floor(u.y+.5+dy*i/n),key=tileKey(tx,ty);if(tx===u.x&&ty===u.y||tx===x&&ty===y||visited.has(key))continue;visited.add(key);
   if(this.solid(this.tile(tx,ty)))return {clear:false,reason:'Solid cover blocks the shot',x:tx,y:ty};
   const body=this.unitAt(tx,ty);if(body&&body.id!==u.id)return {clear:false,reason:body.side===u.side?'Friendly squad blocks the shot':'Another enemy blocks the shot',x:tx,y:ty};
   // Corner crossings cannot thread between touching solid obstacles.
   const px=Math.floor(u.x+.5+dx*(i-1)/n),py=Math.floor(u.y+.5+dy*(i-1)/n);
   if(px!==tx&&py!==ty&&(this.solid(this.tile(px,ty))||this.solid(this.tile(tx,py))))return {clear:false,reason:'Cover blocks the corner',x:tx,y:ty};
  }return {clear:true,reason:'Clear line of fire'};
 }
 covered(target,attacker){
  const tile=this.tile(target.x,target.y);if(tile.crater||tile.hp>0&&['tree','sandbag'].includes(tile.kind))return true;
  const dx=Math.sign(attacker.x-target.x),dy=Math.sign(attacker.y-target.y);
  return [[target.x+dx,target.y],[target.x,target.y+dy]].some(([x,y])=>{if(x===target.x&&y===target.y)return false;const t=this.tile(x,y);return t?.hp>0&&['tree','sandbag'].includes(t.kind);});
 }
 damageValue(attacker,target){const base=attacker.kind==='gunner'?(target.kind==='tank'?TT.gunnerArmorDamage:TT.gunnerDamage):attacker.kind==='rocket'?(target.kind==='tank'?TT.rocketDamage:TT.rocketInfantryDamage):TT.tankDamage;return Math.max(1,Math.round(base*(this.covered(target,attacker)?TT.coverMultiplier:1)));}
 attackInfo(x,y,u=this.active){
  if(!this.inside(x,y)||u.hp<=0)return {ok:false,reason:'Choose a target'};
  const target=this.unitAt(x,y),tile=this.tile(x,y);if(target?.side===u.side)return {ok:false,reason:'That is a friendly unit'};
  if(!target&&tile.hp<=0)return {ok:false,reason:'Choose an enemy or standing cover'};
  const distance=tdist(u,{x,y});if(distance>TACTICS_TYPES[u.kind].range)return {ok:false,reason:'Out of range'};
  const line=this.lineTo(x,y,u);if(!line.clear)return {ok:false,reason:line.reason,block:line};
  const damage=target?this.damageValue(u,target):u.kind==='gunner'?TT.gunCoverDamage:u.kind==='rocket'?TT.rocketDamage:TT.tankDamage;
  return {ok:true,reason:target?(this.covered(target,u)?'Target has cover':'Target exposed'):'Destructible cover',target,tile,damage};
 }
 damage(u,amount){if(u.hp<=0)return;const dealt=Math.min(u.hp,Math.round(amount));u.hp-=dealt;this.emit('damage',{id:u.id,x:u.x,y:u.y,amount:dealt});}
 damageCover(tile,amount){if(tile.hp<=0)return;tile.hp=Math.max(0,tile.hp-amount);if(tile.hp===0){tile.kind='rubble';this.emit('collapse',{x:tile.x,y:tile.y});}}
 attack(x,y){
  if(this.phase!=='aim')return false;const u=this.active,info=this.attackInfo(x,y);if(!info.ok)return false;
  u.facing=Math.atan2(x-u.x,u.y-y);this.emit('shot',{from:{x:u.x,y:u.y},x,y,kind:u.kind,side:u.side});
  if(info.target)this.damage(info.target,info.damage);else this.damageCover(info.tile,info.damage);
  if(u.kind!=='gunner'){
   const center=this.tile(x,y);center.crater=true;
   // Blast fragments affect adjacent units, including friendlies; cover still applies.
   for(const other of this.units)if(other.hp>0&&other!==info.target&&tdist(other,{x,y})<=TT.blastRadius)this.damage(other,this.damageValue(u,other)*TT.splashMultiplier);
   if(info.target)this.damageCover(center,info.damage);
  }
  this.finishAction();return true;
 }
 airFootprint(x,y){return TT.airOffsets.map(dx=>({x:x+dx,y})).filter(p=>this.inside(p.x,p.y));}
 callAir(x,y){
  if(this.phase!=='aim'||this.air[this.side]<=0||!this.inside(x,y))return false;this.air[this.side]--;const cells=this.airFootprint(x,y);this.emit('air',{cells,side:this.side});
  for(const p of cells){const unit=this.unitAt(p.x,p.y);if(unit)this.damage(unit,TT.airDamage);const tile=this.tile(p.x,p.y);this.damageCover(tile,TT.airDamage);tile.crater=true;}
  this.finishAction();return true;
 }
 hold(){if(this.phase!=='aim')return false;this.emit('hold',{id:this.selected});this.finishAction();return true;}
 finishAction(){this.active.used=true;this.committed=true;this.phase='resolve';this.wait=TT.actionDelay;}
 checkEnd(){const living=[0,1].map(side=>this.units.some(u=>u.side===side&&u.hp>0));if(living.every(Boolean))return false;this.winner=living[0]?0:living[1]?1:null;this.result=this.winner===0?'Battlefield secured':this.winner===1?'Force defeated':'Battle drawn';this.phase='over';this.emit('over');return true;}
 next(){
  if(this.checkEnd())return;
  if(!this.ready(0).length&&!this.ready(1).length){this.round++;for(const u of this.units){u.used=false;u.left=TACTICS_TYPES[u.kind].move;}}
  this.side=1-this.side;if(!this.ready(this.side).length)this.side=1-this.side;this.selected=this.ready(this.side)[0].id;this.phase='aim';this.committed=false;this.aiMoved=false;this.wait=TT.aiDelay;this.emit('turn');
 }
 ai(){
  const u=this.active,enemies=this.units.filter(t=>t.side===0&&t.hp>0),targets=enemies.map(t=>({t,info:this.attackInfo(t.x,t.y,u)})).filter(t=>t.info.ok).sort((a,b)=>(b.info.damage/Math.max(1,b.t.hp))-(a.info.damage/Math.max(1,a.t.hp)));
  if(this.air[1]>0&&this.round>=2){let best=null;for(const t of enemies){const cells=this.airFootprint(t.x,t.y),score=cells.reduce((sum,p)=>{const unit=this.unitAt(p.x,p.y);return sum+(unit?unit.side===0?Math.min(unit.hp,TT.airDamage):-TT.airDamage:0);},0);if(!best||score>best.score)best={...t,score};}if(best&&best.score>=TT.airDamage){this.callAir(best.x,best.y);return;}}
  if(!this.aiMoved){
   this.aiMoved=true;let best=null;
   for(const tile of this.reachable().values()){
    if(!tile.path.length)continue;const proposed={...u,x:tile.x,y:tile.y},nearest=Math.min(...enemies.map(t=>tdist(proposed,t))),canHit=enemies.some(t=>this.attackInfo(t.x,t.y,proposed).ok),cover=this.covered(proposed,enemies[0]);
    const score=(canHit?TT.aiShotWeight:0)-nearest+(cover?TT.aiCoverWeight:0)-tile.cost*TT.aiMovePenalty;if(!best||score>best.score)best={...tile,score};
   }
   const stay=(targets.length?TT.aiShotWeight:0)-Math.min(...enemies.map(t=>tdist(u,t)))+(this.covered(u,enemies[0])?TT.aiCoverWeight:0);
   if(best&&best.score>stay+TT.aiAdvanceThreshold&&this.move(best.x,best.y))return;
  }
  const shots=enemies.map(t=>({t,info:this.attackInfo(t.x,t.y)})).filter(t=>t.info.ok).sort((a,b)=>b.info.damage/Math.max(1,b.t.hp)-a.info.damage/Math.max(1,a.t.hp));if(shots.length){this.attack(shots[0].t.x,shots[0].t.y);return;}
  // Breach nearby cover toward the opposing force instead of wasting a turn.
  const foe=enemies.sort((a,b)=>tdist(u,a)-tdist(u,b))[0],block=this.lineTo(foe.x,foe.y);
  if(block.x!==undefined&&this.attackInfo(block.x,block.y).ok){this.attack(block.x,block.y);return;}this.hold();
 }
 update(dt){
  if(this.phase==='over'||this.phase==='deploy')return;
  if(this.phase==='moving'){this.wait-=dt;if(this.wait<=0){this.phase='aim';this.wait=TT.aiDelay;}return;}
  if(this.phase==='resolve'){this.wait-=dt;if(this.wait<=0)this.next();return;}
  if(this.side===1&&this.phase==='aim'){this.wait-=dt;if(this.wait<=0)this.ai();}
 }
}
if(typeof module!=='undefined')module.exports={TACTICS_TUNING,TACTICS_TYPES,TacticsGame};
