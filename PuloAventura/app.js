(() => {
  const canvas=document.getElementById('gameCanvas'),ctx=canvas.getContext('2d'),$=id=>document.getElementById(id);
  const targets=[200,500,800,1200,1600,2100,2700,3400,4200,5000];
  const stageNames=['Floresta','Deserto','Selva','Montanhas geladas','Vulcão','Ruínas antigas','Cidade futurista','Céu e nuvens','Terra dos desafios','Desafio final'];
  const SAVE='puloAventuraSaveV2';
  let saved={unlocked:1,best:0,bonus:false};try{saved={...saved,...JSON.parse(localStorage.getItem(SAVE)||'{}')}}catch(e){}
  let level=1,score=0,lives=3,running=false,paused=false,mode='campaign',frame=0,speed=5,spawnTimer=0,lastTime=0,invulnerable=0,scoreMilestone=0;
  let obstacles=[],coins=[],platforms=[],bonusGoal=null;
  const groundY=344,player={x:140,y:groundY-72,w:48,h:72,vy:0,jumping:false,face:1};
  let soundOn=false;
  function save(){localStorage.setItem(SAVE,JSON.stringify(saved));}
  function target(){return targets[level-1]||5000;}
  function campaignSpeed(){return 4.5+Math.min(level-1,9)*.52;}
  function updateHUD(){
    $('levelNum').textContent=mode==='bonus'?'★':level;
    $('score').textContent=score;$('target').textContent=mode==='bonus'?'TESOUROS':target();
    $('lives').textContent=('♥ '.repeat(lives)).trim()+(lives<3?' '+'♡ '.repeat(3-lives):'');
    $('progressText').textContent=mode==='bonus'?`${coins.filter(c=>c.got).length} tesouros`:`${Math.min(score,target())} / ${target()}`;
    $('progressFill').style.width=mode==='bonus'?`${coins.filter(c=>c.got).length/Math.max(1,coins.length)*100}%`:`${Math.min(100,score/target()*100)}%`;
    $('bestScore').textContent=saved.best;
    for(let i=2;i<=4;i++){const el=$('journey'+i);if(el)el.classList.toggle('unlocked',saved.unlocked>=i);}
    $('bonusLock').textContent=saved.bonus?'✓':'?';$('bonusTitle').textContent=saved.bonus?'Fase bônus desbloqueada!':'Uma fase bônus espera por você';
    $('bonusCopy').textContent=saved.bonus?'Você conquistou acesso ao Reino Perdido. Entre e descubra os tesouros!':'Conclua as 10 fases da campanha para descobrir um novo modo de plataforma, com movimento livre e tesouros escondidos.';
    $('bonusTag').textContent=saved.bonus?'DESBLOQUEADA':'10 FASES';
  }
  function rounded(x,y,w,h,r,fill,stroke){ctx.beginPath();ctx.roundRect(x,y,w,h,r);if(fill){ctx.fillStyle=fill;ctx.fill()}if(stroke){ctx.strokeStyle=stroke;ctx.stroke()}}
  function background(){
    if(mode==='bonus'){drawBonusBackground();return}
    const palettes=[['#80d9ff','#e0f7ff','#2b9c61','#186143'],['#ffc77a','#ffe9bd','#d99b4a','#9a5c29'],['#6dd7c4','#c8ffe8','#178b71','#0d574f'],['#b9e6ff','#f4fcff','#86c9ed','#4d8bbf'],['#ffb47b','#ffe0a3','#e76a42','#8f352c']];
    const p=palettes[(level-1)%palettes.length],g=ctx.createLinearGradient(0,0,0,groundY);g.addColorStop(0,p[0]);g.addColorStop(1,p[1]);ctx.fillStyle=g;ctx.fillRect(0,0,canvas.width,canvas.height);
    ctx.fillStyle='#fff6c7';ctx.beginPath();ctx.arc(790,75,34,0,Math.PI*2);ctx.fill();
    ctx.fillStyle='#ffffffaa';for(let i=0;i<4;i++){let x=((i*260-frame*.25)%(canvas.width+160)+canvas.width+160)%(canvas.width+160)-70,y=45+(i%2)*45;ctx.beginPath();ctx.ellipse(x,y,38,13,0,0,Math.PI*2);ctx.ellipse(x+20,y-8,23,17,0,0,Math.PI*2);ctx.ellipse(x+39,y,30,12,0,0,Math.PI*2);ctx.fill()}
    ctx.fillStyle=p[2];for(let i=0;i<6;i++){let x=((i*210-frame*.55)%(canvas.width+230)+canvas.width+230)%(canvas.width+230)-100;ctx.beginPath();ctx.moveTo(x,groundY);ctx.quadraticCurveTo(x+55,155,x+115,groundY);ctx.fill()}
    for(let i=0;i<7;i++){let x=((i*175-frame*.9)%(canvas.width+120)+canvas.width+120)%(canvas.width+120)-50;ctx.fillStyle=p[3];ctx.fillRect(x,groundY-86,12,86);ctx.beginPath();ctx.arc(x+6,groundY-93,34,0,Math.PI*2);ctx.fill()}
    ctx.fillStyle=p[2];ctx.fillRect(0,groundY,canvas.width,canvas.height-groundY);ctx.fillStyle='#5de08a';ctx.fillRect(0,groundY,canvas.width,11);ctx.fillStyle='#ffffff22';for(let i=0;i<24;i++){let x=((i*49-frame*1.5)%(canvas.width+50)+canvas.width+50)%(canvas.width+50)-25;ctx.fillRect(x,groundY+25+(i%3)*15,24,4)}
  }
  function drawBonusBackground(){
    const g=ctx.createLinearGradient(0,0,0,420);g.addColorStop(0,'#15154b');g.addColorStop(.6,'#39246e');g.addColorStop(1,'#121a3d');ctx.fillStyle=g;ctx.fillRect(0,0,960,420);
    for(let i=0;i<65;i++){let x=(i*137)%960,y=(i*67)%300;ctx.fillStyle=i%4===0?'#ffd166':'#d8dfff';ctx.fillRect(x,y,2,2)}
    ctx.fillStyle='#5e3aa7';ctx.fillRect(0,390,960,30);
    platforms.forEach(p=>{rounded(p.x,p.y,p.w,p.h,7,'#2674a9','#79e4ff');ctx.fillStyle='#7ef2d0';ctx.fillRect(p.x+4,p.y+3,p.w-8,4)});
    if(bonusGoal){ctx.fillStyle='#ffd166';ctx.beginPath();ctx.arc(bonusGoal.x,bonusGoal.y,19,0,Math.PI*2);ctx.fill();ctx.fillStyle='#fff4b0';ctx.beginPath();ctx.arc(bonusGoal.x-5,bonusGoal.y-5,6,0,Math.PI*2);ctx.fill()}
  }
  function drawPlayer(){
    const bob=running&&!player.jumping&&mode==='campaign'?Math.sin(frame*.22)*2:0,x=player.x,y=player.y+bob;
    if(invulnerable>0&&Math.floor(frame/5)%2===0)ctx.globalAlpha=.45;
    ctx.strokeStyle='#17244b';ctx.lineWidth=8;ctx.lineCap='round';
    ctx.beginPath();ctx.moveTo(x+19,y+54);ctx.lineTo(x+14+(running?Math.sin(frame*.35)*7:0),y+67);ctx.stroke();ctx.beginPath();ctx.moveTo(x+32,y+54);ctx.lineTo(x+37-(running?Math.sin(frame*.35)*7:0),y+67);ctx.stroke();
    rounded(x+4,y+63,19,8,4,'#ff784f');rounded(x+29,y+63,19,8,4,'#ff784f');rounded(x+11,y+32,29,27,9,'#ff7b48');
    ctx.strokeStyle='#ffbd91';ctx.lineWidth=7;ctx.beginPath();ctx.moveTo(x+12,y+39);ctx.lineTo(x+3,y+48);ctx.stroke();ctx.beginPath();ctx.moveTo(x+39,y+39);ctx.lineTo(x+47,y+45);ctx.stroke();
    ctx.fillStyle='#ffc49a';ctx.beginPath();ctx.ellipse(x+26,y+22,23,24,0,0,Math.PI*2);ctx.fill();ctx.fillStyle='#63351f';ctx.beginPath();ctx.arc(x+25,y+15,21,Math.PI,Math.PI*2);ctx.fill();ctx.fillRect(x+6,y+14,7,13);
    ctx.fillStyle='#ffc49a';ctx.beginPath();ctx.arc(x+4,y+24,5,0,Math.PI*2);ctx.fill();ctx.fillStyle='#17244b';ctx.beginPath();ctx.ellipse(x+19,y+23,2.5,4,0,0,Math.PI*2);ctx.ellipse(x+34,y+23,2.5,4,0,0,Math.PI*2);ctx.fill();
    ctx.strokeStyle='#a64c36';ctx.lineWidth=2;ctx.beginPath();ctx.arc(x+27,y+29,7,.15,Math.PI-.15);ctx.stroke();
    ctx.fillStyle='#2563ff';ctx.beginPath();ctx.ellipse(x+25,y+7,23,10,0,Math.PI,Math.PI*2);ctx.fill();ctx.beginPath();ctx.moveTo(x+6,y+7);ctx.quadraticCurveTo(x+7,y-3,x+26,y+1);ctx.quadraticCurveTo(x+39,y+1,x+42,y+9);ctx.lineTo(x+8,y+13);ctx.fill();ctx.fillStyle='#00d4ff';ctx.fillRect(x+19,y+1,7,5);ctx.globalAlpha=1;
  }
  function drawObstacle(o){if(o.type==='crate'){rounded(o.x,o.y,o.w,o.h,5,'#a65c2d','#6e351e');ctx.strokeStyle='#e6a45e';ctx.lineWidth=5;ctx.beginPath();ctx.moveTo(o.x+5,o.y+5);ctx.lineTo(o.x+o.w-5,o.y+o.h-5);ctx.moveTo(o.x+o.w-5,o.y+5);ctx.lineTo(o.x+5,o.y+o.h-5);ctx.stroke()}else if(o.type==='rock'){ctx.fillStyle='#69758c';ctx.beginPath();ctx.moveTo(o.x,o.y+o.h);ctx.lineTo(o.x+5,o.y+10);ctx.lineTo(o.x+o.w*.5,o.y);ctx.lineTo(o.x+o.w-4,o.y+8);ctx.lineTo(o.x+o.w,o.y+o.h);ctx.fill()}else{ctx.fillStyle='#f4f8ff';ctx.beginPath();ctx.moveTo(o.x,o.y+o.h);ctx.lineTo(o.x+o.w/2,o.y);ctx.lineTo(o.x+o.w,o.y+o.h);ctx.fill()}}
  function spawn(){const type=level>=3&&Math.random()<.22?'spike':Math.random()<.5?'crate':'rock',h=type==='crate'?44:type==='rock'?34:30,w=type==='crate'?42:type==='rock'?40:34;obstacles.push({x:970,y:groundY-h,w,h,type,passed:false})}
  function jump(){if(!running||paused)return;if(mode==='campaign'){if(!player.jumping){player.vy=-13.5;player.jumping=true}}else if(!player.jumping){player.vy=-14;player.jumping=true}}
  function collision(a,b){return a.x+10<b.x+b.w-4&&a.x+a.w-8>b.x+4&&a.y+8<b.y+b.h&&a.y+a.h-3>b.y+3}
  function showOverlay(title,text,button,actions=[]){$('overlay').classList.remove('hidden');$('overlayTitle').textContent=title;$('overlayText').textContent=text;$('mainBtn').textContent=button;$('choiceActions').innerHTML='';actions.forEach(a=>{const b=document.createElement('button');b.className='choice-btn';b.innerHTML=`${a.title}<small>${a.detail}</small>`;b.onclick=a.action;$('choiceActions').appendChild(b)});}
  function updateBest(){if(score>saved.best){saved.best=score;save()}}
  function finishGame(){running=false;paused=false;$('pauseBtn').disabled=true;$('pauseBtn').textContent='Ⅱ Pausar';updateBest();showOverlay('Fim de jogo!',`Você fez ${score} pontos nesta sessão e chegou à fase ${level}. Sua progressão desbloqueada foi preservada.`,'Escolha como continuar',[
    {title:'↻ Recomeçar do início',detail:'Fase 1 · 3 vidas · pontuação zerada',action:()=>startCampaign(1)},
    {title:`→ Continuar da fase ${saved.unlocked}`,detail:'Retomar da última fase desbloqueada · 3 vidas · pontuação zerada',action:()=>startCampaign(saved.unlocked)}
  ]);updateHUD()}
  function winCampaign(){running=false;paused=false;saved.unlocked=10;saved.bonus=true;save();updateBest();updateHUD();showOverlay('Você venceu a campanha!',`Parabéns! Você concluiu as 10 fases com ${score} pontos e ${lives} vida(s). A fase bônus secreta foi desbloqueada.`,'Entrar na fase bônus →',[{title:'★ Jogar fase bônus',detail:'Novo modo: movimento livre, plataformas e tesouros',action:startBonus},{title:'↻ Jogar campanha novamente',detail:'Começar da fase 1 com três vidas',action:()=>startCampaign(1)}])}
  function completeLevel(){running=false;paused=false;$('pauseBtn').disabled=true;if(level>=10){winCampaign();return}saved.unlocked=Math.max(saved.unlocked,level+1);save();showOverlay(`Fase ${level} concluída!`,`Meta alcançada: ${score} pontos. ${stageNames[level]} está liberada. Você continua com ${lives} vida(s).`,'Próxima fase →');updateHUD()}
  function startCampaign(startLevel=1){mode='campaign';level=Math.max(1,Math.min(10,startLevel));score=0;lives=3;scoreMilestone=0;obstacles=[];coins=[];platforms=[];spawnTimer=0;speed=campaignSpeed();player.x=140;player.y=groundY-player.h;player.vy=0;player.jumping=false;invulnerable=0;running=true;paused=false;lastTime=0;$('pauseBtn').disabled=false;$('pauseBtn').textContent='Ⅱ Pausar';$('gameHint')?.remove();updateHUD();$('overlay').classList.add('hidden')}
  function continueLevel(){level=Math.min(10,level+1);obstacles=[];spawnTimer=0;player.x=140;player.y=groundY-player.h;player.vy=0;player.jumping=false;invulnerable=0;speed=campaignSpeed();running=true;paused=false;lastTime=0;$('pauseBtn').disabled=false;$('pauseBtn').textContent='Ⅱ Pausar';$('overlay').classList.add('hidden');updateHUD();}
  function startBonus(){mode='bonus';level=10;score=0;lives=3;obstacles=[];coins=[];platforms=[{x:0,y:390,w:960,h:30},{x:175,y:320,w:150,h:16},{x:380,y:260,w:145,h:16},{x:575,y:205,w:140,h:16},{x:760,y:280,w:130,h:16},{x:650,y:340,w:110,h:16},{x:420,y:350,w:120,h:16}];coins=[{x:230,y:286,got:false},{x:430,y:225,got:false},{x:630,y:170,got:false},{x:815,y:245,got:false},{x:700,y:305,got:false},{x:465,y:315,got:false}];bonusGoal={x:900,y:245};player.x=55;player.y=groundY-player.h;player.vy=0;player.jumping=false;running=true;paused=false;lastTime=0;$('pauseBtn').disabled=false;$('pauseBtn').textContent='Ⅱ Pausar';showBonusControls();updateHUD();$('overlay').classList.add('hidden')}
  function showBonusControls(){let controls=$('bonusControls');if(!controls){controls=document.createElement('div');controls.id='bonusControls';controls.className='controls bonus-controls';controls.innerHTML='<button class="secondary-btn" id="leftBtn">← ESQUERDA</button><button class="jump-btn" id="bonusJump">PULAR ↑</button><button class="secondary-btn" id="rightBtn">DIREITA →</button>';document.querySelector('.game-card').insertBefore(controls,document.querySelector('.progress-block'));$('leftBtn').addEventListener('pointerdown',e=>{e.preventDefault();if(mode==='bonus'&&running&&!paused){player.x=Math.max(0,player.x-24);player.face=-1}});$('rightBtn').addEventListener('pointerdown',e=>{e.preventDefault();if(mode==='bonus'&&running&&!paused){player.x=Math.min(910,player.x+24);player.face=1}});$('bonusJump').addEventListener('pointerdown',e=>{e.preventDefault();jump()})}controls.style.display=mode==='bonus'?'flex':'none'}
  function tick(t){if(!lastTime)lastTime=t;const dt=Math.min(2,(t-lastTime)/16.67||1);lastTime=t;frame+=dt;background();
    if(running&&!paused){
      if(mode==='campaign'){
        speed=campaignSpeed();spawnTimer-=dt;if(spawnTimer<=0){spawn();spawnTimer=Math.max(48,92-level*3)+Math.random()*28}
        player.vy+=.66*dt;player.y+=player.vy*dt;if(player.y>=groundY-player.h){player.y=groundY-player.h;player.vy=0;player.jumping=false}
        obstacles.forEach(o=>{o.x-=speed*dt;if(!o.passed&&o.x+o.w<player.x){o.passed=true;score+=25}});obstacles=obstacles.filter(o=>o.x+o.w>-20);
        if(invulnerable>0)invulnerable-=dt;
        for(const o of obstacles){if(collision(player,o)&&invulnerable<=0){lives--;invulnerable=70;o.x=-100;if(lives<=0){updateHUD();finishGame();break}}}
        if(Math.floor(frame)%24===0)score+=1;
        const milestone=Math.floor(score/1000);if(milestone>scoreMilestone){const earned=milestone-scoreMilestone;scoreMilestone=milestone;lives=Math.min(3,lives+earned)}
        updateBest();updateHUD();if(running&&score>=target())completeLevel();
      }else{
        // Mario-style movement: horizontal input and gravity with platform landing.
        player.vy+=.62*dt;const prevY=player.y;player.y+=player.vy*dt;
        if(player.y+player.h>=390){player.y=390-player.h;player.vy=0;player.jumping=false}
        platforms.forEach(p=>{if(player.vy>=0&&prevY+player.h<=p.y+5&&player.y+player.h>=p.y&&player.x+player.w-5>p.x&&player.x+5<p.x+p.w){player.y=p.y-player.h;player.vy=0;player.jumping=false}});
        coins.forEach(c=>{if(!c.got&&Math.abs((player.x+24)-c.x)<30&&Math.abs((player.y+30)-c.y)<38){c.got=true;score+=100;updateBest()}});
        if(bonusGoal&&player.x+player.w>bonusGoal.x&&player.y<bonusGoal.y+30&&player.y+player.h>bonusGoal.y-30){running=false;saved.bonus=true;save();showOverlay('Tesouro encontrado!',`Você concluiu a fase bônus com ${score} pontos e coletou ${coins.filter(c=>c.got).length} tesouro(s).`,'Jogar bônus novamente →',[{title:'↻ Repetir fase bônus',detail:'Tente encontrar todos os tesouros',action:startBonus},{title:'🏆 Voltar à campanha',detail:'A campanha principal continua desbloqueada',action:()=>startCampaign(10)}])}
        updateHUD();
      }
    }
    if(mode==='campaign')obstacles.forEach(drawObstacle);else{coins.forEach(c=>{if(!c.got){ctx.fillStyle='#ffd166';ctx.beginPath();ctx.arc(c.x,c.y,10,0,Math.PI*2);ctx.fill();ctx.strokeStyle='#fff0a6';ctx.lineWidth=3;ctx.stroke()}});if(bonusGoal){ctx.fillStyle='#42e695';ctx.fillRect(bonusGoal.x,bonusGoal.y-30,8,80);ctx.fillStyle='#fff';ctx.beginPath();ctx.moveTo(bonusGoal.x+8,bonusGoal.y-28);ctx.lineTo(bonusGoal.x+42,bonusGoal.y-16);ctx.lineTo(bonusGoal.x+8,bonusGoal.y-4);ctx.fill()}}
    drawPlayer();if(paused){ctx.fillStyle='#08112c99';ctx.fillRect(0,0,960,420);ctx.fillStyle='#fff';ctx.font='900 34px Nunito,sans-serif';ctx.textAlign='center';ctx.fillText('JOGO PAUSADO',480,210)}
    requestAnimationFrame(tick)}
  $('mainBtn').addEventListener('click',()=>{const title=$('overlayTitle').textContent.toLowerCase();if(mode==='bonus')startBonus();else if(title.includes('fase ')&&title.includes('concluída')&&level<10)continueLevel();else if(title.includes('você venceu'))startBonus();else startCampaign(1)});
  $('jumpBtn').addEventListener('pointerdown',e=>{e.preventDefault();jump()});canvas.addEventListener('pointerdown',()=>{if(running&&mode==='campaign')jump()});
  window.addEventListener('keydown',e=>{if(['Space','ArrowUp','KeyW'].includes(e.code)){e.preventDefault();jump()}if(mode==='bonus'&&running&&!paused){if(e.code==='ArrowLeft'||e.code==='KeyA'){player.x=Math.max(0,player.x-15);player.face=-1}if(e.code==='ArrowRight'||e.code==='KeyD'){player.x=Math.min(910,player.x+15);player.face=1}}});
  $('pauseBtn').addEventListener('click',()=>{if(!running)return;paused=!paused;$('pauseBtn').textContent=paused?'▶ Continuar':'Ⅱ Pausar'});
  $('restartBtn').addEventListener('click',()=>mode==='bonus'?startBonus():startCampaign(1));
  $('soundBtn').addEventListener('click',()=>{soundOn=!soundOn;$('soundBtn').textContent=soundOn?'♫':'♪';$('soundBtn').style.color=soundOn?'#00d4ff':'#f8faff'});
  updateHUD();showBonusControls();requestAnimationFrame(tick);
  if('serviceWorker'in navigator&&location.protocol!=='file:')window.addEventListener('load',()=>navigator.serviceWorker.register('./sw.js').catch(()=>{}));
})();