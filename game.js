import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js';
const canvas=document.querySelector('#scene'),renderer=new THREE.WebGLRenderer({canvas,antialias:true});renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.shadowMap.enabled=true;renderer.outputColorSpace=THREE.SRGBColorSpace;
const scene=new THREE.Scene();scene.background=new THREE.Color(0x132638);scene.fog=new THREE.Fog(0x132638,18,55);
const camera=new THREE.PerspectiveCamera(62,1,.1,100);camera.position.set(0,10,10);
scene.add(new THREE.HemisphereLight(0xbce8ff,0x4d3a28,2.1));const light=new THREE.PointLight(0xffb35a,55,28);light.position.set(0,7,0);scene.add(light);
const mat=(c,rough=.8,metal=0,em=0)=>new THREE.MeshStandardMaterial({color:c,roughness:rough,metalness:metal,emissive:em});
const floorMat=mat(0x65594b),wallMat=mat(0x53687a),topMat=mat(0x263c50),goldMat=mat(0xffc928,.25,.75,0x9c5600),exitMat=mat(0x21ff83,.25,.1,0x0b9b48);
let N=13;const cell=2;let offset=(N-1)*cell/2,level=1;let maze=[],coins3d=[],walls=[],features=[],running=false,paused=false,player={x:1,z:1},coinCount=0,hasKey=false,startAt=0,elapsed=0,best=Number(localStorage.getItem('mazeBest')||0),penalty=0;
document.querySelector('#bestStart').textContent=best?format(best):'—';
function format(s){return Math.floor(s/60)+':'+String(Math.floor(s%60)).padStart(2,'0')}
function pos(x,z){return {x:x*cell-offset,z:z*cell-offset}}
const floor=new THREE.Mesh(new THREE.PlaneGeometry(70,70),mat(0x172e32));floor.rotation.x=-Math.PI/2;floor.position.y=-.25;scene.add(floor);
const mazeGroup=new THREE.Group();scene.add(mazeGroup);const itemGroup=new THREE.Group();scene.add(itemGroup);
function carve(){
 maze=Array.from({length:N},()=>Array(N).fill(1));const stack=[[1,1]];maze[1][1]=0;
 while(stack.length){const [x,z]=stack[stack.length-1],dirs=[[0,-2],[2,0],[0,2],[-2,0]].sort(()=>Math.random()-.5);let moved=false;
 for(const [dx,dz] of dirs){const nx=x+dx,nz=z+dz;if(nx>0&&nz>0&&nx<N-1&&nz<N-1&&maze[nz][nx]===1){maze[z+dz/2][x+dx/2]=0;maze[nz][nx]=0;stack.push([nx,nz]);moved=true;break}}
 if(!moved)stack.pop();
 }
 maze[N-2][N-2]=0;
 // create some loops so navigation stays interesting
 for(let i=0;i<10;i++){let x=1+Math.floor(Math.random()*(N-2)),z=1+Math.floor(Math.random()*(N-2));if(x%2===1&&z%2===1){let d=[[1,0],[-1,0],[0,1],[0,-1]][Math.floor(Math.random()*4)];maze[z+d[1]][x+d[0]]=0}}
}
function build(){
 N=[13,15,17,19,21][Math.min(level-1,4)];offset=(N-1)*cell/2;scene.fog=new THREE.Fog(0x132638,18,N*cell*2.8);
 while(mazeGroup.children.length){const o=mazeGroup.children.pop();o.geometry?.dispose();}while(itemGroup.children.length){const o=itemGroup.children.pop();o.geometry?.dispose()}
 walls=[];coins3d=[];features=[];hasKey=false;penalty=0;carve();
 const floorTile=new THREE.Mesh(new THREE.BoxGeometry(N*cell,.2,N*cell),floorMat);floorTile.position.y=-.12;mazeGroup.add(floorTile);
 for(let z=0;z<N;z++)for(let x=0;x<N;x++){const p=pos(x,z);if(maze[z][x]){const w=new THREE.Mesh(new THREE.BoxGeometry(cell,2.2,cell),wallMat);w.position.set(p.x,1,p.z);w.castShadow=true;w.receiveShadow=true;mazeGroup.add(w);const cap=new THREE.Mesh(new THREE.BoxGeometry(cell*1.04,.15,cell*1.04),topMat);cap.position.set(p.x,2.1,p.z);mazeGroup.add(cap);walls.push([x,z])}else if((x+z)%3===0&&!(x===1&&z===1)&&!(x===N-2&&z===N-2)){const c=new THREE.Mesh(new THREE.TorusGeometry(.32,.1,8,16),goldMat);c.position.set(p.x,.85,p.z);c.rotation.x=Math.PI/2;itemGroup.add(c);coins3d.push({x,z,obj:c,taken:false})}}
 // Coloca llave, trampas y una puerta secreta en casillas transitables.
 const candidates=[];for(let z=1;z<N-1;z++)for(let x=1;x<N-1;x++)if(maze[z][x]===0&&!((x===1&&z===1)||(x===N-2&&z===N-2)))candidates.push({x,z});
 const pick=()=>candidates.splice(Math.floor(Math.random()*candidates.length),1)[0];
 const kp=pick();if(kp){const p=pos(kp.x,kp.z);const key=new THREE.Group();const ring=new THREE.Mesh(new THREE.TorusGeometry(.22,.07,8,14),goldMat);ring.position.y=.95;key.add(ring);const shaft=new THREE.Mesh(new THREE.CylinderGeometry(.055,.055,.48,8),goldMat);shaft.position.set(.23,.95,0);shaft.rotation.z=Math.PI/2;key.add(shaft);key.position.set(p.x,0,p.z);itemGroup.add(key);features.push({...kp,type:'key',obj:key,used:false})}
 for(let i=0;i<Math.min(2+level,6);i++){const t=pick();if(!t)break;const p=pos(t.x,t.z);const kind=i%3===0?'dart':i%3===1?'mud':'trap';const pad=new THREE.Mesh(new THREE.CylinderGeometry(.55,.55,.08,16),mat(kind==='mud'?0x57442e:0x9b2f39,.55,0,kind==='mud'?0x251507:0x4b0810));pad.position.set(p.x,.05,p.z);itemGroup.add(pad);if(kind!=='mud'){for(let j=0;j<4;j++){const spike=new THREE.Mesh(new THREE.ConeGeometry(.12,.38,5),mat(0xb9c7d3,.35,.6));const a=j*Math.PI/2;spike.position.set(p.x+Math.cos(a)*.28,.24,p.z+Math.sin(a)*.28);itemGroup.add(spike)}}features.push({...t,type:kind,obj:pad,used:false})}
 // Cofres de tesoro: dan monedas extra al encontrarlos.
 for(let i=0;i<Math.min(1+Math.floor(level/2),3);i++){const t=pick();if(!t)break;const p=pos(t.x,t.z);const chest=new THREE.Group();const base=new THREE.Mesh(new THREE.BoxGeometry(.72,.42,.5),mat(0x8b4a1d,.45,.25));base.position.y=.25;chest.add(base);const lid=new THREE.Mesh(new THREE.BoxGeometry(.76,.18,.54),mat(0xe6ad36,.35,.45,0x5d3200));lid.position.set(0,.53,0);chest.add(lid);const lock=new THREE.Mesh(new THREE.BoxGeometry(.12,.18,.07),goldMat);lock.position.set(0,.4,.29);chest.add(lock);chest.position.set(p.x,0,p.z);itemGroup.add(chest);features.push({...t,type:'chest',obj:chest,used:false})}
 const sp=pick();if(sp){const p=pos(sp.x,sp.z);const door=new THREE.Group();const frame=new THREE.Mesh(new THREE.BoxGeometry(1.2,1.7,.18),mat(0x643a9b,.4,.2,0x2d1055));frame.position.y=.85;door.add(frame);const rune=new THREE.Mesh(new THREE.TorusGeometry(.25,.06,8,16),mat(0x65e8ff,.3,.1,0x0d7eaa));rune.position.set(0,.95,.12);door.add(rune);door.position.set(p.x,0,p.z);itemGroup.add(door);features.push({...sp,type:'secret',obj:door,used:false})}
 const ep=pos(N-2,N-2);const portal=new THREE.Mesh(new THREE.TorusGeometry(.75,.14,12,28),exitMat);portal.position.set(ep.x,1.25,ep.z);portal.rotation.y=Math.PI/2;itemGroup.add(portal);const glow=new THREE.PointLight(0x18ff78,30,9);glow.position.set(ep.x,2,ep.z);itemGroup.add(glow);
}
const hero=new THREE.Group();scene.add(hero);
const body=new THREE.Mesh(new THREE.CapsuleGeometry(.34,.65,4,8),mat(0x171e32));body.position.y=.72;hero.add(body);
const head=new THREE.Mesh(new THREE.SphereGeometry(.27,14,10),mat(0xc98352));head.position.y=1.4;hero.add(head);
const hair=new THREE.Mesh(new THREE.SphereGeometry(.29,12,8),mat(0x422116));hair.scale.set(1,1.05,.8);hair.position.set(0,1.55,-.08);hero.add(hair);
const backpack=new THREE.Mesh(new THREE.BoxGeometry(.42,.48,.22),mat(0x9a6038));backpack.position.set(0,.86,-.32);hero.add(backpack);
function resize(){const w=innerWidth<650?innerWidth:480;renderer.setSize(w,innerHeight,false);camera.aspect=w/innerHeight;camera.updateProjectionMatrix()}addEventListener('resize',resize);resize();
function walk(dx,dz){if(!running||paused)return;const nx=player.x+dx,nz=player.z+dz;if(nx<0||nz<0||nx>=N||nz>=N||maze[nz][nx]===1)return;player.x=nx;player.z=nz;updatePlayer();const c=coins3d.find(c=>!c.taken&&c.x===nx&&c.z===nz);if(c){c.taken=true;c.obj.visible=false;coinCount++;document.querySelector('#coins').textContent=coinCount}const f=features.find(f=>!f.used&&f.x===nx&&f.z===nz);if(f){if(f.type==='key'){hasKey=true;f.used=true;f.obj.visible=false;document.querySelector('.controls-hint').textContent='¡LLAVE CONSEGUIDA! BUSCA LA SALIDA';}else if(f.type==='trap'||f.type==='dart'||f.type==='mud'){f.used=true;penalty+=f.type==='mud'?4:8;coinCount=Math.max(0,coinCount-(f.type==='mud'?1:2));document.querySelector('#coins').textContent=coinCount;document.querySelector('.controls-hint').textContent=f.type==='mud'?'¡BARRO! PIERDES TIEMPO Y UNA MONEDA':f.type==='dart'?'¡TRAMPA DE PINCHOS! +8 SEGUNDOS':'¡PLACA TRAMPA! +8 SEGUNDOS';}else if(f.type==='secret'){f.used=true;f.obj.visible=false;coinCount+=5+level;document.querySelector('#coins').textContent=coinCount;document.querySelector('.controls-hint').textContent='¡PUERTA SECRETA! +'+(5+level)+' MONEDAS';}else if(f.type==='chest'){f.used=true;f.obj.visible=false;coinCount+=10+level*2;document.querySelector('#coins').textContent=coinCount;document.querySelector('.controls-hint').textContent='¡COFRE ABIERTO! +'+(10+level*2)+' MONEDAS';}}if(nx===N-2&&nz===N-2){if(hasKey)win();else document.querySelector('.controls-hint').textContent='SALIDA CERRADA: ENCUENTRA LA LLAVE';}}
function updatePlayer(){const p=pos(player.x,player.z);hero.position.set(p.x,0,p.z);camera.position.set(p.x,10,p.z+8);camera.lookAt(p.x,0,p.z-1)}
function start(){level=1;coinCount=0;build();player={x:1,z:1};coinCount=0;hasKey=false;penalty=0;document.querySelector('.controls-hint').textContent='BUSCA LLAVES, MONEDAS Y LA SALIDA';elapsed=0;startAt=performance.now();running=true;paused=false;document.querySelector('#coins').textContent='0';document.querySelector('#level').textContent=level;document.querySelector('#time').textContent='0:00';document.querySelector('#start').classList.add('hidden');document.querySelector('#message').classList.add('hidden');updatePlayer()}
function win(){const secs=(performance.now()-startAt)/1000+penalty;if(level<5){level++;build();player={x:1,z:1};hasKey=false;document.querySelector('#level').textContent=level;document.querySelector('.controls-hint').textContent='NIVEL '+level+': ¡ENCUENTRA LA LLAVE Y LA SALIDA!';updatePlayer();return;}running=false;const totalSecs=secs;if(!best||totalSecs<best){best=totalSecs;localStorage.setItem('mazeBest',best);document.querySelector('#bestStart').textContent=format(best)}document.querySelector('#retry').textContent='JUGAR DE NUEVO';document.querySelector('#msgTitle').textContent='¡MAESTRO DEL LABERINTO!';document.querySelector('#msgText').textContent=`¡Completaste 5 niveles! Tiempo final: ${format(totalSecs)} · Monedas: ${coinCount}`;document.querySelector('#message').classList.remove('hidden')}
function pause(){if(!running&&!paused)return;if(!paused){elapsed=(performance.now()-startAt)/1000+penalty;paused=true;running=false;document.querySelector('#msgTitle').textContent='PAUSA';document.querySelector('#msgText').textContent='Tu laberinto te espera.';document.querySelector('#retry').textContent='REINICIAR';document.querySelector('#message').classList.remove('hidden')}else{paused=false;running=true;startAt=performance.now()-(elapsed-penalty)*1000;document.querySelector('#retry').textContent='VOLVER A JUGAR';document.querySelector('#message').classList.add('hidden')}}
document.querySelector('#play').onclick=start;document.querySelector('#retry').onclick=start;document.querySelector('#home').onclick=()=>{running=false;paused=false;document.querySelector('#message').classList.add('hidden');document.querySelector('#start').classList.remove('hidden')};document.querySelector('#pause').onclick=pause;
const joystick=document.querySelector('#joystick'), stick=document.querySelector('#stick');
let joyActive=false, joyPointer=null, joyX=0, joyY=0, lastJoyMove=0;
function resetStick(){joyActive=false;joyPointer=null;joyX=0;joyY=0;stick.style.transform='translate(0px,0px)'}
joystick.addEventListener('pointerdown',e=>{
  if(!running||paused)return;
  e.preventDefault();joyActive=true;joyPointer=e.pointerId;joystick.setPointerCapture(e.pointerId);updateJoy(e);
});
joystick.addEventListener('pointermove',e=>{if(joyActive&&e.pointerId===joyPointer){e.preventDefault();updateJoy(e)}});
joystick.addEventListener('pointerup',e=>{if(e.pointerId===joyPointer)resetStick()});
joystick.addEventListener('pointercancel',resetStick);
function updateJoy(e){
 const r=joystick.querySelector('.joy-ring').getBoundingClientRect();
 const cx=r.left+r.width/2,cy=r.top+r.height/2, max=31;
 let dx=e.clientX-cx,dy=e.clientY-cy,dist=Math.hypot(dx,dy);
 if(dist>max){dx=dx/dist*max;dy=dy/dist*max}
 stick.style.transform=`translate(${dx}px,${dy}px)`;
 joyX=dx/max;joyY=dy/max;
 const now=performance.now();
 if(Math.hypot(joyX,joyY)>.42&&now-lastJoyMove>190){
   if(Math.abs(joyX)>Math.abs(joyY))walk(joyX>0?1:-1,0);
   else walk(0,joyY>0?1:-1);
   lastJoyMove=now;
 }
}
let sx=0,sy=0;
canvas.addEventListener('touchstart',e=>{sx=e.changedTouches[0].clientX;sy=e.changedTouches[0].clientY},{passive:true});
canvas.addEventListener('touchend',e=>{const dx=e.changedTouches[0].clientX-sx,dy=e.changedTouches[0].clientY-sy;if(Math.max(Math.abs(dx),Math.abs(dy))<25)return;if(Math.abs(dx)>Math.abs(dy))walk(dx>0?1:-1,0);else walk(0,dy>0?1:-1)},{passive:true});
addEventListener('keydown',e=>{if(e.key==='ArrowLeft'||e.key==='a')walk(-1,0);if(e.key==='ArrowRight'||e.key==='d')walk(1,0);if(e.key==='ArrowUp'||e.key==='w')walk(0,-1);if(e.key==='ArrowDown'||e.key==='s')walk(0,1)});
const clock=new THREE.Clock();function loop(){requestAnimationFrame(loop);const dt=clock.getDelta();if(running){elapsed=(performance.now()-startAt)/1000+penalty;document.querySelector('#time').textContent=format(elapsed);for(const c of coins3d)if(!c.taken)c.obj.rotation.z+=dt*2.5;for(const f of features)if(!f.used&&f.type==='key')f.obj.rotation.y+=dt*1.7;for(const f of features)if(!f.used&&f.type==='chest')f.obj.rotation.y+=Math.sin(performance.now()*.001+f.x)*.004}renderer.render(scene,camera)}build();player={x:1,z:1};updatePlayer();loop();