(() => {
"use strict";

const menuScreen=document.getElementById('menuScreen'), gameScreen=document.getElementById('gameScreen');
const levelSelectEl=document.getElementById('levelSelect'), startBtn=document.getElementById('startBtn');
const hudMapName=document.getElementById('hudMapName'), hudLevelName=document.getElementById('hudLevelName');
const scoreVal=document.getElementById('scoreVal'), timeVal=document.getElementById('timeVal'), livesVal=document.getElementById('livesVal');
const pauseBtn=document.getElementById('pauseBtn'), pauseOverlay=document.getElementById('pauseOverlay');
const resumeBtn=document.getElementById('resumeBtn'), menuFromPauseBtn=document.getElementById('menuFromPauseBtn');
const loseOverlay=document.getElementById('loseOverlay'), retryLevelBtn=document.getElementById('retryLevelBtn'), menuFromLoseBtn=document.getElementById('menuFromLoseBtn');
const winLevelOverlay=document.getElementById('winLevelOverlay'), winLevelSub=document.getElementById('winLevelSub'), winLevelScore=document.getElementById('winLevelScore');
const nextLevelBtn=document.getElementById('nextLevelBtn'), menuFromWinBtn=document.getElementById('menuFromWinBtn');
const winMapOverlay=document.getElementById('winMapOverlay'), winMapSub=document.getElementById('winMapSub'), winMapScore=document.getElementById('winMapScore');
const nextMapBtn=document.getElementById('nextMapBtn'), menuFromMapWinBtn=document.getElementById('menuFromMapWinBtn');
const canvas=document.getElementById('maze'), ctx=canvas.getContext('2d');
const touchControls=document.getElementById('touchControls');
const confettiLayer=document.getElementById('confettiLayer');

const MAPS = [
  { name:"Peta 1: Desa Merdeka", theme:"village", levels:[
    { name:"Level 1", size:11, hazards:2, time:60 },
    { name:"Level 2", size:13, hazards:3, time:75 },
    { name:"Level 3", size:15, hazards:4, time:90 },
  ]},
  { name:"Peta 2: Alun-Alun Kota", theme:"city", levels:[
    { name:"Level 1", size:15, hazards:5, time:95 },
    { name:"Level 2", size:17, hazards:6, time:110 },
    { name:"Level 3", size:19, hazards:7, time:125 },
  ]},
  { name:"Peta 3: Istana Kemerdekaan", theme:"palace", levels:[
    { name:"Level 1", size:19, hazards:8, time:130 },
    { name:"Level 2", size:21, hazards:9, time:150 },
    { name:"Level 3", size:23, hazards:10, time:170 },
  ]},
];

const THEME_COLORS = {
  village:{ wall:"#7a1220", path:"#3a0f16", accent:"#ffcc00" },
  city:{ wall:"#8f0b21", path:"#33121a", accent:"#ffffff" },
  palace:{ wall:"#a8102b", path:"#2a0a12", accent:"#ffd84d" },
};

let progress = { unlockedMap:0, unlockedLevel:0 };
let current = { mapIdx:0, levelIdx:0 };
let game = null;

function buildLevelSelect(){
  levelSelectEl.innerHTML="";
  MAPS.forEach((map, mi)=>{
    const group=document.createElement('div');
    group.className="map-group";
    const title=document.createElement('div');
    title.className="map-group-title";
    title.textContent=map.name;
    group.appendChild(title);
    const row=document.createElement('div');
    row.className="level-buttons";
    map.levels.forEach((lvl, li)=>{
      const locked = mi>progress.unlockedMap || (mi===progress.unlockedMap && li>progress.unlockedLevel);
      const btn=document.createElement('button');
      btn.className="level-btn"+(locked?" locked":"")+((mi===current.mapIdx&&li===current.levelIdx)?" active":"");
      btn.textContent=lvl.name;
      btn.disabled=locked;
      btn.addEventListener('click',()=>{
        current.mapIdx=mi; current.levelIdx=li;
        buildLevelSelect();
      });
      row.appendChild(btn);
    });
    group.appendChild(row);
    levelSelectEl.appendChild(group);
  });
}

// ---------------- MAZE GENERATOR (recursive backtracker) ----------------
function generateMaze(size){
  const grid=[];
  for(let y=0;y<size;y++){
    grid.push([]);
    for(let x=0;x<size;x++) grid[y].push({x,y,walls:{N:true,S:true,E:true,W:true},visited:false});
  }
  const stack=[grid[0][0]];
  grid[0][0].visited=true;
  const DIRS=[["N",0,-1],["S",0,1],["E",1,0],["W",-1,0]];
  const OPP={N:"S",S:"N",E:"W",W:"E"};
  while(stack.length){
    const cur=stack[stack.length-1];
    const neighbors=[];
    for(const [dir,dx,dy] of DIRS){
      const nx=cur.x+dx, ny=cur.y+dy;
      if(nx>=0&&nx<size&&ny>=0&&ny<size&&!grid[ny][nx].visited) neighbors.push([dir,grid[ny][nx]]);
    }
    if(neighbors.length===0){ stack.pop(); continue; }
    const [dir,next]=neighbors[Math.floor(Math.random()*neighbors.length)];
    cur.walls[dir]=false;
    next.walls[OPP[dir]]=false;
    next.visited=true;
    stack.push(next);
  }
  return grid;
}

function randomOpenCells(grid, size, count, exclude){
  const cells=[];
  let tries=0;
  while(cells.length<count && tries<2000){
    tries++;
    const x=Math.floor(Math.random()*size), y=Math.floor(Math.random()*size);
    const key=`${x},${y}`;
    if(exclude.has(key)) continue;
    if(cells.some(c=>c.x===x&&c.y===y)) continue;
    cells.push({x,y});
  }
  return cells;
}

// ---------------- GAME SETUP ----------------
function startLevel(mapIdx, levelIdx){
  const map=MAPS[mapIdx], lvl=map.levels[levelIdx];
  const size=lvl.size;
  const grid=generateMaze(size);
  const exclude=new Set(["0,0", `${size-1},${size-1}`]);

  const collectibleCount=Math.max(4, Math.floor(size/2));
  const collectibles=randomOpenCells(grid,size,collectibleCount,exclude).map(c=>({...c,taken:false}));
  collectibles.forEach(c=>exclude.add(`${c.x},${c.y}`));
  const hazards=randomOpenCells(grid,size,lvl.hazards,exclude);

  game={
    mapIdx, levelIdx, map, lvl, grid, size,
    player:{x:0,y:0,px:0,py:0,moving:false},
    goal:{x:size-1,y:size-1},
    collectibles, hazards,
    score:0, lives:3, timeLeft:lvl.time,
    running:true, paused:false,
    cellPx: canvas.width/size,
  };

  hudMapName.textContent=map.name;
  hudLevelName.textContent=lvl.name;
  scoreVal.textContent="0";
  livesVal.textContent="3";
  updateTimeDisplay();
  hideAllOverlays();
  draw();
}

function hideAllOverlays(){
  [pauseOverlay,loseOverlay,winLevelOverlay,winMapOverlay].forEach(o=>o.classList.add('overlay--hidden'));
}

function updateTimeDisplay(){
  const m=Math.floor(game.timeLeft/60).toString().padStart(2,'0');
  const s=Math.floor(game.timeLeft%60).toString().padStart(2,'0');
  timeVal.textContent=`${m}:${s}`;
}

// ---------------- MOVEMENT ----------------
function canMove(cell,dir){
  return !cell.walls[dir];
}
const DIR_DELTA={ up:[0,-1,"N"], down:[0,1,"S"], left:[-1,0,"W"], right:[1,0,"E"] };

function movePlayer(dir){
  if(!game||!game.running||game.paused) return;
  const [dx,dy,wallKey]=DIR_DELTA[dir];
  const {x,y}=game.player;
  const cell=game.grid[y][x];
  if(!canMove(cell,wallKey)) return;
  game.player.x=x+dx;
  game.player.y=y+dy;
  checkTile();
  draw();
}

function checkTile(){
  const {x,y}=game.player;
  const col=game.collectibles.find(c=>!c.taken&&c.x===x&&c.y===y);
  if(col){ col.taken=true; game.score+=10; scoreVal.textContent=game.score; }

  const haz=game.hazards.find(h=>h.x===x&&h.y===y);
  if(haz){
    game.hazards=game.hazards.filter(h=>h!==haz);
    game.lives-=1; livesVal.textContent=game.lives;
    if(game.lives<=0){ return loseLevel(); }
    // respawn ke start dengan sedikit toleransi
    game.player.x=0; game.player.y=0;
  }

  if(x===game.goal.x&&y===game.goal.y){
    winLevel();
  }
}

function loseLevel(){
  game.running=false;
  loseOverlay.classList.remove('overlay--hidden');
}

function winLevel(){
  game.running=false;
  const map=MAPS[game.mapIdx];
  const isLastLevel = game.levelIdx===map.levels.length-1;

  if(game.levelIdx>=progress.unlockedLevel && game.mapIdx===progress.unlockedMap){
    progress.unlockedLevel=game.levelIdx+1;
    if(progress.unlockedLevel>=map.levels.length){
      progress.unlockedLevel=0;
      if(progress.unlockedMap<MAPS.length-1) progress.unlockedMap+=1;
    }
  }

  spawnConfetti();

  if(isLastLevel){
    const isLastMap = game.mapIdx===MAPS.length-1;
    winMapSub.textContent = isLastMap
      ? "Seluruh peta berhasil ditaklukkan! Selamat, Pahlawan Kemerdekaan!"
      : `Semua level di ${map.name} selesai!`;
    winMapScore.textContent=game.score;
    nextMapBtn.style.display = isLastMap ? "none" : "inline-block";
    winMapOverlay.classList.remove('overlay--hidden');
  } else {
    winLevelSub.textContent=`${map.levels[game.levelIdx].name} selesai!`;
    winLevelScore.textContent=game.score;
    winLevelOverlay.classList.remove('overlay--hidden');
  }
}

function spawnConfetti(){
  const colors=["#c8102e","#ffffff","#ffcc00"];
  for(let i=0;i<60;i++){
    const el=document.createElement('div');
    el.className="confetti-piece";
    el.style.left=Math.random()*100+"%";
    el.style.background=colors[Math.floor(Math.random()*colors.length)];
    el.style.animationDuration=(2+Math.random()*2)+"s";
    el.style.animationDelay=(Math.random()*0.5)+"s";
    confettiLayer.appendChild(el);
    setTimeout(()=>el.remove(),4500);
  }
}

// ---------------- TIMER ----------------
let timerInterval=null;
function startTimer(){
  clearInterval(timerInterval);
  timerInterval=setInterval(()=>{
    if(!game||!game.running||game.paused) return;
    game.timeLeft-=1;
    updateTimeDisplay();
    if(game.timeLeft<=0){
      game.lives-=1; livesVal.textContent=game.lives;
      if(game.lives<=0) return loseLevel();
      game.timeLeft=Math.floor(game.lvl.time*0.5);
    }
  },1000);
}

// ---------------- DRAW ----------------
function draw(){
  if(!game) return;
  const {grid,size,cellPx}=game;
  const colors=THEME_COLORS[game.map.theme];
  ctx.clearRect(0,0,canvas.width,canvas.height);
  ctx.fillStyle=colors.path;
  ctx.fillRect(0,0,canvas.width,canvas.height);

  ctx.strokeStyle=colors.wall;
  ctx.lineWidth=Math.max(3, cellPx*0.12);
  ctx.lineCap="round";

  for(let y=0;y<size;y++){
    for(let x=0;x<size;x++){
      const cell=grid[y][x];
      const px=x*cellPx, py=y*cellPx;
      ctx.beginPath();
      if(cell.walls.N){ ctx.moveTo(px,py); ctx.lineTo(px+cellPx,py); }
      if(cell.walls.S){ ctx.moveTo(px,py+cellPx); ctx.lineTo(px+cellPx,py+cellPx); }
      if(cell.walls.W){ ctx.moveTo(px,py); ctx.lineTo(px,py+cellPx); }
      if(cell.walls.E){ ctx.moveTo(px+cellPx,py); ctx.lineTo(px+cellPx,py+cellPx); }
      ctx.stroke();
    }
  }

  // goal (tiang bendera)
  drawFlagPole(game.goal.x*cellPx+cellPx/2, game.goal.y*cellPx+cellPx/2, cellPx);

  // collectibles (merdeka point)
  game.collectibles.forEach(c=>{
    if(c.taken) return;
    drawStar(c.x*cellPx+cellPx/2, c.y*cellPx+cellPx/2, cellPx*0.22, colors.accent);
  });

  // hazards (bom / rintangan)
  game.hazards.forEach(h=>{
    drawHazard(h.x*cellPx+cellPx/2, h.y*cellPx+cellPx/2, cellPx*0.28);
  });

  // player
  drawPlayer(game.player.x*cellPx+cellPx/2, game.player.y*cellPx+cellPx/2, cellPx*0.32);
}

function drawFlagPole(cx,cy,cellPx){
  ctx.save();
  ctx.strokeStyle="#e8d9a0"; ctx.lineWidth=Math.max(2,cellPx*0.06);
  ctx.beginPath(); ctx.moveTo(cx,cy+cellPx*0.35); ctx.lineTo(cx,cy-cellPx*0.4); ctx.stroke();
  ctx.fillStyle="#c8102e";
  ctx.fillRect(cx, cy-cellPx*0.4, cellPx*0.28, cellPx*0.13);
  ctx.fillStyle="#ffffff";
  ctx.fillRect(cx, cy-cellPx*0.27, cellPx*0.28, cellPx*0.13);
  ctx.restore();
}
function drawStar(cx,cy,r,color){
  ctx.save();
  ctx.fillStyle=color;
  ctx.shadowColor=color; ctx.shadowBlur=8;
  ctx.beginPath();
  for(let i=0;i<5;i++){
    const a1=(Math.PI*2*i)/5 - Math.PI/2;
    const a2=a1+Math.PI/5;
    ctx.lineTo(cx+Math.cos(a1)*r, cy+Math.sin(a1)*r);
    ctx.lineTo(cx+Math.cos(a2)*r*0.45, cy+Math.sin(a2)*r*0.45);
  }
  ctx.closePath(); ctx.fill();
  ctx.restore();
}
function drawHazard(cx,cy,r){
  ctx.save();
  ctx.fillStyle="#1a1a1a";
  ctx.beginPath(); ctx.arc(cx,cy,r,0,Math.PI*2); ctx.fill();
  ctx.strokeStyle="#ff5a5a"; ctx.lineWidth=2;
  ctx.beginPath(); ctx.moveTo(cx,cy-r); ctx.lineTo(cx+r*0.4,cy-r*1.5); ctx.stroke();
  ctx.restore();
}
function drawPlayer(cx,cy,r){
  ctx.save();
  ctx.fillStyle="#ffffff";
  ctx.shadowColor="#ffcc00"; ctx.shadowBlur=10;
  ctx.beginPath(); ctx.arc(cx,cy,r,0,Math.PI*2); ctx.fill();
  ctx.fillStyle="#c8102e";
  ctx.beginPath(); ctx.arc(cx,cy,r*0.55,0,Math.PI*2); ctx.fill();
  ctx.restore();
}

// ---------------- INPUT ----------------
const KEY_MAP={ArrowUp:"up",ArrowDown:"down",ArrowLeft:"left",ArrowRight:"right",w:"up",s:"down",a:"left",d:"right",W:"up",S:"down",A:"left",D:"right"};
window.addEventListener('keydown',(e)=>{
  if(e.key==="Escape"){ togglePause(); return; }
  const dir=KEY_MAP[e.key];
  if(dir){ e.preventDefault(); movePlayer(dir); }
});
touchControls.addEventListener('click',(e)=>{
  const btn=e.target.closest('.touch-btn');
  if(btn) movePlayer(btn.dataset.dir);
});

function togglePause(){
  if(!game||!game.running) return;
  game.paused=!game.paused;
  pauseOverlay.classList.toggle('overlay--hidden',!game.paused);
}

// ---------------- BUTTONS ----------------
startBtn.addEventListener('click',()=>{
  menuScreen.classList.add('screen--hidden');
  gameScreen.classList.remove('screen--hidden');
  startLevel(current.mapIdx,current.levelIdx);
  startTimer();
});
pauseBtn.addEventListener('click',togglePause);
resumeBtn.addEventListener('click',togglePause);
menuFromPauseBtn.addEventListener('click',backToMenu);
menuFromLoseBtn.addEventListener('click',backToMenu);
menuFromWinBtn.addEventListener('click',backToMenu);
menuFromMapWinBtn.addEventListener('click',backToMenu);

retryLevelBtn.addEventListener('click',()=>{
  startLevel(current.mapIdx,current.levelIdx);
});
nextLevelBtn.addEventListener('click',()=>{
  current.levelIdx+=1;
  startLevel(current.mapIdx,current.levelIdx);
});
nextMapBtn.addEventListener('click',()=>{
  current.mapIdx+=1; current.levelIdx=0;
  startLevel(current.mapIdx,current.levelIdx);
});

function backToMenu(){
  game.running=false;
  gameScreen.classList.add('screen--hidden');
  menuScreen.classList.remove('screen--hidden');
  buildLevelSelect();
}

// ---------------- INIT ----------------
buildLevelSelect();

})();
