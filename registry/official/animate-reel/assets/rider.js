// Our horse + faceless rider (from reels/2026-11-01-khalid-part-3/index.html, lines 47-132), drawn on a 2D canvas.
// Needs ../stick-rig.js loaded first.
const clamp=(v,a=0,b=1)=>Math.min(b,Math.max(a,v)),lerp=(a,b,k)=>a+(b-a)*k;
const ease=k=>1-Math.pow(1-clamp(k),3);
let x=null;const GOLD='#B8934E';
function glow(cx,cy,r,col,a){const g=x.createRadialGradient(cx,cy,0,cx,cy,r);g.addColorStop(0,col.replace('A',a));g.addColorStop(1,col.replace('A',0));x.fillStyle=g;x.fillRect(cx-r,cy-r,r*2,r*2)}
const RIGF=RIG.drawFigure,rshade=RIG.shade,rseg=RIG.seg;RIG.E.W=1080;RIG.E.H=1920;RIG.setStyle('golden');
const RIM='#FFF1D6',RIMD=[.9,-.45],K_ROBE='#7A2E24',Z_ROBE='#2F3D5A',K_TURB='#ECDFC3',Z_TURB='#F4EEE2';
function hLeg(top,angs,lens,ws,col){
  let p=top;const pts=[p];for(let i=0;i<angs.length;i++){p=[p[0]+Math.sin(angs[i])*lens[i],p[1]+Math.cos(angs[i])*lens[i]];pts.push(p)}
  for(let i=0;i<angs.length;i++)rseg(x,[pts[i],pts[i+1]],ws[i],col);
  const f=pts[pts.length-1];x.save();x.translate(f[0],f[1]);x.rotate(-angs[angs.length-1]);x.fillStyle=col;
  x.beginPath();x.moveTo(-8,-4);x.lineTo(9,-4);x.lineTo(12,8);x.lineTo(-9,8);x.closePath();x.fill();x.restore()}
function legsAt(u,far,amp){
  // rotary gallop: far hind, near hind, far fore, near fore
  const off=far?{h:0,f:.42}:{h:.12,f:.56},bh=(u+off.h)*Math.PI*2,bf=(u+off.f)*Math.PI*2;
  const fa=.62*Math.sin(bf)*amp,ha=(-.2+.55*Math.sin(bh))*amp;
  return {f:[fa,fa-1.5*amp*Math.pow(Math.max(0,Math.cos(bf)),1.4),fa+(-.4*Math.max(0,Math.cos(bf))+.25)*amp],
          h:[ha,ha+(.35+1.0*Math.pow(Math.max(0,-Math.cos(bh)),1.3))*amp,ha+.1*amp]}}
function horseShape(col,mane,flow,pass){
  const gr=pass?5:0;
  x.fillStyle=mane;x.beginPath();x.moveTo(-136,-196-gr);x.bezierCurveTo(-180,-214-gr,-226,-196+flow*6,-262,-150+flow*10);
  x.bezierCurveTo(-236,-168+flow*8,-196,-170,-150,-164+gr);x.closePath();x.fill();
  x.fillStyle=col;x.beginPath();x.moveTo(130,-160);
  x.bezierCurveTo(136,-196,112,-222,78,-224);x.bezierCurveTo(50,-224,30,-204,6,-206);
  x.bezierCurveTo(-30,-208,-50,-224,-86,-222);x.bezierCurveTo(-130,-220,-152,-190,-148,-152);
  x.bezierCurveTo(-146,-126,-130,-108,-102,-104);x.bezierCurveTo(-60,-92,30,-90,74,-100);
  x.bezierCurveTo(108,-108,126,-130,130,-160);x.fill();
  x.beginPath();x.moveTo(60,-220);x.bezierCurveTo(96,-266,130,-304,170,-318);x.lineTo(204,-282);
  x.bezierCurveTo(176,-246,150,-196,132,-150);x.lineTo(96,-160);x.closePath();x.fill();
  x.beginPath();x.moveTo(166,-322);x.bezierCurveTo(200,-312,228,-278,246,-238);
  x.bezierCurveTo(254,-220,246,-206,230,-206);x.bezierCurveTo(214,-206,206,-214,198,-222);
  x.bezierCurveTo(176,-232,162,-252,170,-280);x.closePath();x.fill();
  x.beginPath();x.arc(188,-268,30+gr,0,7);x.fill();
  x.beginPath();x.moveTo(160,-318);x.lineTo(156,-350);x.lineTo(176,-322);x.fill();
  x.beginPath();x.moveTo(170,-320);x.lineTo(172,-348);x.lineTo(184,-318);x.fill();
  x.fillStyle=mane;x.beginPath();x.moveTo(170,-322);x.bezierCurveTo(130,-306,96,-268,62,-222);
  x.lineTo(40,-218-flow*4);x.bezierCurveTo(78,-262,110,-310,150,-334);x.closePath();x.fill();
  x.strokeStyle=mane;x.lineCap='round';
  for(let k=0;k<4;k++){const v=(k+.5)/4,mx=lerp(150,64,v),my=lerp(-320,-232,v);x.lineWidth=(pass?12:8)-k;
    x.beginPath();x.moveTo(mx,my);x.quadraticCurveTo(mx-26,my-12,mx-46-flow*6,my-2+k*3);x.stroke()}
}
function horse(ph,stand,col,colD,walk=0,cloth){
  const u=ph,mv=1-stand,amp=(walk?.45:1)*mv,flow=Math.sin(u*Math.PI*2)*mv;
  const bob=-Math.abs(Math.sin(u*Math.PI*2))*10*mv*(walk?.4:1),pitch=.035*Math.sin(u*Math.PI*2+.6)*mv*(walk?.4:1);
  x.save();x.translate(0,bob);x.rotate(pitch);
  const Lf=legsAt(u,true,amp),Ln=legsAt(u,false,amp),mane=rshade(colD,-.2);
  const legs=(L,c,w)=>{hLeg([92,-150],L.f,[66,58,18],[24*w,15*w,13*w],c);hLeg([-104,-156],L.h,[70,60,18],[30*w,15*w,13*w],c)};
  x.save();x.translate(RIMD[0]*5,RIMD[1]*5);legs(Lf,RIM,1.25);horseShape(RIM,RIM,flow,1);legs(Ln,RIM,1.25);x.restore();
  legs(Lf,colD,1);horseShape(col,mane,flow,0);
  // saddle cloth in the rider's colour
  x.fillStyle=cloth;x.beginPath();x.moveTo(-40,-210);x.quadraticCurveTo(8,-200,46,-214);x.lineTo(54,-150);x.quadraticCurveTo(8,-138,-46,-148);x.closePath();x.fill();
  x.fillStyle=rshade(cloth,.35);x.fillRect(-46,-152,100,5);
  legs(Ln,col,1);x.restore();return bob}
// ---------- the rider: a faceless rim-light stick figure in a thobe and turban, with a cape ----------
const MOUTH=[236,-212],FS=1.22,FY=-120;   // figure scale and origin in horse space (hip lands on the saddle)
function arm(sx,sy,ang,len=90){return [sx+Math.cos(ang)*len,sy+Math.sin(ang)*len]}
function blade(hx,hy,ang,len=112){x.save();x.translate(hx,hy);x.rotate(ang);x.fillStyle='#2a1e15';x.fillRect(-14,-5,16,10);x.fillRect(0,-14,6,28);
  x.fillStyle='#FFF6E2';x.beginPath();x.moveTo(6,-9);x.lineTo(len,-6);x.lineTo(len+18,0);x.lineTo(len,6);x.lineTo(6,9);x.fill();
  x.fillStyle='#C9CED4';x.beginPath();x.moveTo(6,-5);x.lineTo(len,-3);x.lineTo(len+12,0);x.lineTo(len,3);x.lineTo(6,5);x.fill();x.restore()}
function rider(o,bob,robe){
  // o: {left:{ang,item,tilt}, right:{ang,item,tilt}, reinSlack, legGlow, child, wave, spear}; left = near arm, right = far arm
  x.save();x.translate(0,bob);if(o.child){x.translate(0,-175);x.scale(.7,.7);x.translate(0,175)}
  const wave=o.wave||0,toF=(p)=>[p[0]/FS,(p[1]-FY)/FS],toH=(p)=>[p[0]*FS,FY+p[1]*FS];
  const pose={head:[16,-184],sh:[8,-150],hip:[0,-72],kF:[34,-46],fF:[20,0],kB:[30,-48],fB:[16,-2]};
  const shH=toH(pose.sh),nr=arm(shH[0]+4,shH[1]+8,o.left.ang),far=arm(shH[0]-4,shH[1]+6,o.right.ang);
  const elbow=(h,side)=>{const m=[(pose.sh[0]+h[0])/2,(pose.sh[1]+h[1])/2],dx=h[0]-pose.sh[0],dy=h[1]-pose.sh[1],L=Math.hypot(dx,dy)||1;return [m[0]-dy/L*8*side,m[1]+dx/L*8*side]};
  pose.hF=toF(nr);pose.eF=elbow(pose.hF,1);pose.hB=toF(far);pose.eB=elbow(pose.hB,1);
  // cape: flows back from the shoulders, behind the body
  const w=Math.sin(wave)*6;
  const cape=(col,dx,dy)=>{x.save();x.translate(dx,dy+FY);x.scale(FS,FS);const sh=pose.sh,hp=pose.hip;x.fillStyle=col;x.beginPath();
    x.moveTo(sh[0]+6,sh[1]+2);x.quadraticCurveTo(sh[0]-50,sh[1]+4+w*.5,sh[0]-104,sh[1]+52+w);
    x.quadraticCurveTo(sh[0]-70,sh[1]+70,hp[0]-30,hp[1]+8);x.lineTo(hp[0]+10,hp[1]);x.closePath();x.fill();x.restore()};
  if(o.right.item==='sword')blade(far[0],far[1],o.right.ang+(o.right.tilt||-.35));
  cape(RIM,RIMD[0]*5,RIMD[1]*5);cape(rshade(robe,-.25),0,0);
  const turb=robe===Z_ROBE?Z_TURB:K_TURB;
  RIGF(x,{x:0,y:FY,s:FS,facing:1,pose,outfit:{top:'thobe',color:robe,head:'turban',color2:turb},faceless:true,shadow:false,rim:{color:RIM,dir:RIMD,w:5}});
  if(o.legGlow>0){x.save();x.globalCompositeOperation='screen';glow(40,-160,90,'rgba(255,214,140,A)',.85*o.legGlow);x.restore();
    x.strokeStyle=`rgba(197,168,112,${o.legGlow})`;x.lineWidth=5;for(const s of [-1,1]){x.beginPath();x.arc(40,-150,58,s<0?2.4:-.7,s<0?3.4:.3);x.stroke()}}
  if(o.left.item==='sword')blade(nr[0],nr[1],o.left.ang+(o.left.tilt||-.5));
  if(o.left.item==='bow'){x.strokeStyle='#2a1e15';x.lineWidth=6;x.beginPath();x.arc(nr[0]-34,nr[1],52,-1.05,1.05);x.stroke();
    x.strokeStyle='rgba(63,52,36,.8)';x.lineWidth=2;x.beginPath();x.moveTo(nr[0]-34+Math.cos(-1.05)*52,nr[1]+Math.sin(-1.05)*52);x.lineTo(far[0],far[1]);x.lineTo(nr[0]-34+Math.cos(1.05)*52,nr[1]+Math.sin(1.05)*52);x.stroke()}
  if(o.left.item==='reins'||o.reinSlack>=0){const hx=o.left.item==='reins'?nr[0]:MOUTH[0]-60,hy=o.left.item==='reins'?nr[1]:-196;
    x.strokeStyle='#2a1e15';x.lineWidth=3;x.beginPath();x.moveTo(MOUTH[0],MOUTH[1]);x.quadraticCurveTo((MOUTH[0]+hx)/2,(MOUTH[1]+hy)/2+lerp(4,60,clamp(o.reinSlack)),hx,hy);x.stroke()}
  if(o.spear){x.save();x.translate(o.spear[0],o.spear[1]);x.rotate(o.spear[2]);x.strokeStyle='#2a1e15';x.lineWidth=7;x.beginPath();x.moveTo(-150,0);x.lineTo(130,0);x.stroke();
    x.fillStyle=P.steel;x.beginPath();x.moveTo(130,-9);x.lineTo(172,0);x.lineTo(130,9);x.fill();x.restore()}
  x.restore();
}
function mount(px,py,s,ph,stand,o,robe=K_ROBE,hcol='#3A2A1E',hcolD='#2A1E15',halo=.55,walk=0){
  x.save();x.translate(px,py);x.scale(s,s);
  x.save();x.globalAlpha=.18;x.fillStyle='#6b5434';x.beginPath();x.ellipse(10,4,170,14,0,0,7);x.fill();x.restore();
  const bob=horse(ph,stand,hcol,hcolD,walk,rshade(robe,.05));rider(o,bob,robe);x.restore()}
// window.drawRiderCard(t, o): a 2D card for 3D pages (styles/ink-3d-world.html). Canvas 1200x900, hooves at y 870,
// mount scale 1.6, so the card is 5.36 x 4.0 m in the world (withers ~1.6 m). Faceless rider, never a prophet.
// o: robe (K_ROBE Khalid, Z_ROBE ...), horse / horseD colours, leftAng / rightAng arm angles, letter (gold lines by his hand), wave
window.drawRiderCard = function (t, o = {}) {
  const robe = o.robe || K_ROBE, c = document.createElement('canvas'); c.width = 1200; c.height = 900; x = c.getContext('2d');
  x.save(); x.translate(590, 870); x.scale(1.6, 1.6);
  const bob = horse(o.ph || 0, o.stand ?? 1, o.horse || '#3A2A1E', o.horseD || '#2A1E15', 0, rshade(robe, .05));
  rider({ left: { ang: o.leftAng ?? .7, item: 'reins' }, right: { ang: o.rightAng ?? .1 }, reinSlack: 0, wave: o.wave ?? t * 2 }, bob, robe);
  if (o.letter !== false) {
    x.translate(132, -300); x.rotate(-.08);
    x.fillStyle = '#FFF8EA'; x.fillRect(-48, -32, 96, 64);
    x.strokeStyle = 'rgba(142,114,64,.45)'; x.lineWidth = 1.5; x.strokeRect(-41, -25, 82, 50);
    x.fillStyle = GOLD; for (let i = 0; i < 4; i++) x.fillRect(-34, -18 + i * 11, [62, 50, 66, 38][i], 2.5);
  }
  x.restore(); return c;
};
