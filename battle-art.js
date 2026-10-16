'use strict';
// Battle renderer only. Every texture/effect uses deterministic visual noise;
// this file never changes units, collision terrain, turns or gameplay RNG.
class BattleArt {
 constructor(){
  this.unitsReady=false;this.plateReady=false;
  this.atlas=new Image();this.atlas.onload=()=>{this.unitsReady=true;};this.atlas.src='assets/battle-units-real-v1.webp';
  this.plate=new Image();this.plate.onload=()=>{this.plateReady=true;};this.plate.src='assets/scorched-sunset-v1.webp';
  this.crops=[[40,18,707,300],[792,19,710,300],[237,343,374,326],[987,344,378,326],[250,682,354,320],[1021,682,354,320]];
  this.soil=this.canvas(BT.width,720);const c=this.soil.getContext('2d');
  const earth=c.createLinearGradient(0,300,0,610);earth.addColorStop(0,'#8e7957');earth.addColorStop(.3,'#796248');earth.addColorStop(.68,'#55483a');earth.addColorStop(1,'#353437');c.fillStyle=earth;c.fillRect(0,0,BT.width,720);
  for(let layer=0;layer<13;layer++){const y=327+layer*19;c.beginPath();c.moveTo(0,y);for(let x=0;x<=BT.width;x+=8)c.lineTo(x,y+Math.sin(x*.009+layer)*6+Math.sin(x*.026-layer)*3);c.lineTo(BT.width,y+10);c.lineTo(0,y+10);c.closePath();c.fillStyle=layer%2?'#211e1b2d':'#c6ab7421';c.fill();}
  for(let y=300;y<720;y+=2)for(let x=0;x<BT.width;x+=3){const n=this.noise(x,y);c.fillStyle=n>.5?'#ead5a312':'#191a1d18';c.fillRect(x+n*2,y+this.noise(y,x)*1.5,.6+n,.7);}
  for(let y=340;y<540;y+=23)for(let x=0;x<BT.width;x+=31){const n=this.noise(x,y);if(n<.7)continue;this.rock(c,x+(n-.5)*20,y,2+n*4,n);}
  this.smoke=this.canvas(128,128);const s=this.smoke.getContext('2d'),g=s.createRadialGradient(64,64,5,64,64,62);g.addColorStop(0,'#393a3bd9');g.addColorStop(.35,'#55504b9c');g.addColorStop(.7,'#746a5e3d');g.addColorStop(1,'#756b6000');s.fillStyle=g;s.fillRect(0,0,128,128);
  this.flash=this.canvas(128,128);const f=this.flash.getContext('2d'),fl=f.createRadialGradient(64,64,0,64,64,64);fl.addColorStop(0,'#fffbeaff');fl.addColorStop(.13,'#fff0b9fa');fl.addColorStop(.4,'#f9a53dbb');fl.addColorStop(1,'#dd682000');f.fillStyle=fl;f.fillRect(0,0,128,128);
  this.mountains=[];for(let layer=0;layer<3;layer++){
   const plate=this.canvas(BT.width,720),m=plate.getContext('2d'),base=287+layer*39;m.beginPath();m.moveTo(0,720);
   for(let x=0;x<=BT.width;x+=5)m.lineTo(x,base+Math.sin(x*.004+layer*2)*35+Math.sin(x*.011+layer)*14+this.noise(Math.floor(x/20),layer)*4);
   m.lineTo(BT.width,720);m.closePath();const color=m.createLinearGradient(0,base-50,0,490);color.addColorStop(0,['#827f7d','#6b7169','#515e51'][layer]);color.addColorStop(1,['#b3a18a','#8d9078','#737c5f'][layer]);m.fillStyle=color;m.fill();
   m.save();m.globalCompositeOperation='source-atop';for(let i=0;i<350;i++){const x=i*9,y=base+this.noise(i,layer)*90;m.strokeStyle='#e6d3ad09';m.beginPath();m.moveTo(x,y);m.lineTo(x+18,y+35);m.stroke();}m.restore();this.mountains.push(plate);
  }
 }
 canvas(w,h){const c=document.createElement('canvas');c.width=w;c.height=h;return c;}
 noise(a,b){const n=Math.sin(a*12.9898+b*78.233)*43758.5453;return n-Math.floor(n);}
 polygon(c,points,color){c.fillStyle=color;c.beginPath();points.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));c.closePath();c.fill();}
 rock(c,x,y,r,n){this.polygon(c,[[x-r,y],[x-r*.5,y-r*.6],[x+r*.7,y-r*.4],[x+r,y+r*.4],[x-r*.3,y+r*.6]],'#877d69');this.polygon(c,[[x-r,y],[x-r*.5,y-r*.6],[x+r*.7,y-r*.4],[x,y+r*.1]],n>.85?'#c6b28b':'#ac9d7c');}
 background(c,camera){
  if(this.plateReady){c.drawImage(this.plate,0,0,1280,720);c.fillStyle='#a59a8c25';c.fillRect(0,0,1280,720);}else{const g=c.createLinearGradient(0,0,0,720);g.addColorStop(0,'#9dabad');g.addColorStop(.55,'#d9b18a');g.addColorStop(1,'#e7cd9f');c.fillStyle=g;c.fillRect(0,0,1280,720);}
  // Distant landscape only: every playable hill is still the dirt-cell mask.
  for(let i=0;i<3;i++){c.globalAlpha=.55+i*.16;c.drawImage(this.mountains[i],-camera*(.08+i*.12),0);}
  c.globalAlpha=1;const haze=c.createLinearGradient(0,290,0,415);haze.addColorStop(0,'#f5dcac00');haze.addColorStop(1,'#d3c19c35');c.fillStyle=haze;c.fillRect(0,290,1280,125);
 }
 terrain(terrain,c){
  c.clearRect(0,0,BT.width,720);c.fillStyle='#fff';for(let r=0;r<terrain.rows;r++)for(let col=0;col<terrain.cols;col++)if(terrain.data[r*terrain.cols+col])c.fillRect(col*CT.cell,r*CT.cell,CT.cell,CT.cell);
  c.globalCompositeOperation='source-in';c.drawImage(this.soil,0,0);c.globalCompositeOperation='source-atop';c.fillStyle='#373a3b';c.fillRect(0,CT.bedrock,BT.width,720);c.fillStyle='#8c89755c';c.fillRect(0,CT.bedrock,BT.width,2);
  c.globalCompositeOperation='source-over';
  for(let col=0;col<terrain.cols;col++){
   const x=col*CT.cell,y=terrain.floor(x,0),intact=y===terrain.originalTop[col];
   c.fillStyle=intact?'#353c24':'#46392f';c.fillRect(x,y,CT.cell,3);c.fillStyle=intact?'#7a8051':'#b29b75';c.fillRect(x,y,CT.cell,1);
   if(intact){for(let k=0;k<2;k++){const n=this.noise(col,k);c.strokeStyle=n>.5?'#9c9b64':'#505e37';c.lineWidth=1;c.beginPath();c.moveTo(x+k*2,y+1);c.lineTo(x+k*2+(n-.5)*4,y-2-n*5);c.stroke();}}
   if(intact&&col%23===0){c.strokeStyle='#2d281b88';c.lineWidth=1;c.beginPath();c.moveTo(x,y);c.lineTo(x+2,y+14);c.lineTo(x-2,y+23);c.stroke();}
  }c.globalCompositeOperation='source-over';
 }
 building(c,b){
  const x=b.x-b.width/2,y=b.y-b.height;
  const wall=c.createLinearGradient(x,y,x+b.width,b.y);wall.addColorStop(0,'#b2ac94');wall.addColorStop(.5,'#938b73');wall.addColorStop(1,'#686755');c.fillStyle=wall;c.fillRect(x,y,b.width,b.height);
  c.fillStyle='#2d302e66';c.fillRect(x+b.width-9,y+2,9,b.height-2);c.fillStyle='#c7b994';c.fillRect(x,y,2,b.height);
  for(let row=0;row<6;row++){const by=y+row*11;c.strokeStyle='#423f354d';c.lineWidth=.8;c.beginPath();c.moveTo(x,by);c.lineTo(x+b.width,by);c.stroke();for(let col=0;col<4;col++){const bx=x+col*19+(row%2)*9;if(bx<x+b.width){c.beginPath();c.moveTo(bx,by);c.lineTo(bx,by+11);c.stroke();}}}
  for(let i=0;i<90;i++){const n=this.noise(i,b.id+3),px=x+n*b.width,py=y+this.noise(i,b.id+9)*b.height;c.fillStyle=i%2?'#ebe1c02a':'#2e302728';c.fillRect(px,py,1+n*3,1+n*2);}
  this.polygon(c,[[x-3,y+2],[b.x,y-CT.buildingRoof],[x+b.width+3,y+2]],'#393d3a');c.strokeStyle='#a39373';c.lineWidth=1;c.beginPath();c.moveTo(x-3,y+2);c.lineTo(b.x,y-CT.buildingRoof);c.lineTo(x+b.width+3,y+2);c.stroke();
  for(let i=0;i<8;i++){const rx=x+i*8;c.strokeStyle='#141e1f55';c.beginPath();c.moveTo(rx,y+1);c.lineTo(b.x+(rx-b.x)*.45,y-CT.buildingRoof*.5);c.stroke();}
  for(const wx of [x+10,x+39]){c.fillStyle='#484b43';c.fillRect(wx-2,y+16,17,21);c.fillStyle='#242f32';c.fillRect(wx,y+18,13,17);c.fillStyle='#93aaa144';c.fillRect(wx+1,y+19,4,12);c.strokeStyle='#aaa68c';c.lineWidth=1;c.strokeRect(wx,y+18,13,17);c.beginPath();c.moveTo(wx+6,y+18);c.lineTo(wx+6,y+35);c.moveTo(wx,y+26);c.lineTo(wx+13,y+26);c.stroke();c.fillStyle='#beb294';c.fillRect(wx-2,y+35,17,2);}
  c.fillStyle='#514e40';c.fillRect(b.x-8,b.y-24,16,24);c.fillStyle='#242c29';c.fillRect(b.x-6,b.y-21,12,21);c.fillStyle='#a28b64';c.fillRect(b.x+3,b.y-11,2,2);c.fillStyle='#424138';c.fillRect(x-3,b.y-4,b.width+6,5);
  if(b.hp<CT.buildingHP){c.strokeStyle='#292d28';c.lineWidth=1.6;c.beginPath();c.moveTo(b.x+3,y+1);c.lineTo(b.x-3,y+20);c.lineTo(b.x+4,y+31);c.lineTo(b.x-4,y+47);c.lineTo(b.x+1,b.y);c.stroke();c.fillStyle='#31352f99';c.fillRect(x+6,y+12,2,4);}
 }
 sprite(c,t,row,x,y,w,h){
  const tile=this.crops?.[row*2+t.side];if(!tile)return false;
  c.save();c.translate(x,y);if(t.side)c.scale(-1,1);c.imageSmoothingEnabled=true;c.imageSmoothingQuality='high';c.drawImage(this.atlas,...tile,-w/2,-h,w,h);c.restore();return true;
 }
 tank(c,t,clock){
  c.save();c.translate(t.x,t.y);c.rotate(t.tilt);this.shadow(c,0,2,31,5);this.sprite(c,t,0,0,1,60,34);
  // Team marking stays clear even under dust; it does not change camouflage.
  c.fillStyle=t.side?'#c77e62':'#70b7c6';c.fillRect(-16,-17,4,7);c.fillStyle='#d1c9a6';c.font='600 4px monospace';c.fillText(t.side?'21':'07',7,-15);c.restore();
  c.save();c.translate(t.x,t.y-CT.tankHeight);c.rotate(-t.angle*Math.PI/180);const recoil=t.recoil/CT.recoilTime*CT.recoilPixels;c.translate(-recoil,0);
  const barrel=c.createLinearGradient(0,-3,0,3);barrel.addColorStop(0,'#c8c2a1');barrel.addColorStop(.35,'#767d68');barrel.addColorStop(1,'#282f2c');c.fillStyle=barrel;c.fillRect(0,-2.5,CT.barrel,5);c.fillStyle='#3d463e';c.fillRect(10,-3,4,6);c.fillRect(CT.barrel-5,-3,5,6);c.fillStyle='#171f1e';c.fillRect(CT.barrel-1,-2,1,4);c.restore();
 }
 infantry(c,t,clock){
  const moving=t.id===this.activeId&&this.moving;
  for(const [i,offset] of [-11,0,11].entries()){
   const bob=moving?Math.sin(clock*13+i*2)*.7:0,x=t.x+offset,y=t.y+bob;
   this.shadow(c,x,y+1,8,2);this.sprite(c,t,t.kind==='rocket'?2:1,x+(t.side?-7:7),y,38,35);
   c.fillStyle=t.side?'#c87f68':'#7fc4d1';c.fillRect(x+(t.side?3:-5),y-23,3,2);
  }
 }
 shadow(c,x,y,rx,ry){c.fillStyle='#171e1b55';c.beginPath();c.ellipse(x,y,rx,ry,0,0,Math.PI*2);c.fill();}
 puff(c,x,y,size,alpha=.5){c.save();c.globalAlpha=alpha;c.drawImage(this.smoke,x-size/2,y-size/2,size,size);c.restore();}
 blast(c,f){const age=f.age,k=age/BT.blastLife;c.save();c.globalAlpha=Math.max(0,1-k);c.drawImage(this.flash,f.x-f.radius*(.5+k),f.y-f.radius*(.5+k),f.radius*(1+k*2),f.radius*(1+k*2));c.restore();for(let i=0;i<6;i++){const n=this.noise(i,f.x),a=i*Math.PI/3,spread=k*f.radius*.6;this.puff(c,f.x+Math.cos(a)*spread,f.y+Math.sin(a)*spread-k*20,f.radius*(.4+k*.8),Math.max(0,.7-k*.7));}}
 smokeCloud(c,f){const k=f.age/2.8;this.puff(c,f.x+Math.sin(f.age+f.seed)*8,f.y-f.age*21,20+f.age*34,Math.max(0,.4-k*.4));}
 jet(c,p){c.save();c.translate(p.x,p.y);const body=c.createLinearGradient(0,-7,0,7);body.addColorStop(0,'#b0b4ac');body.addColorStop(.5,'#606e70');body.addColorStop(1,'#303c40');this.polygon(c,[[-39,0],[-30,-4],[-23,-15],[-16,-15],[-15,-5],[12,-6],[24,-2],[39,2],[13,6],[-30,5]],body);this.polygon(c,[[-12,1],[0,-2],[8,12],[-21,5]],'#48585a');this.polygon(c,[[5,-5],[15,-4],[23,-1],[5,-1]],'#32484f');c.fillStyle='#e3aa6d';c.fillRect(-40,0,5,3);c.restore();}
}
