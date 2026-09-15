'use strict';

const SAVE_KEY = 'bth_web_21_save_v1';
const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const hud = document.getElementById('hud');
const actions = document.getElementById('actions');
const message = document.getElementById('message');
const modal = document.getElementById('modal');
const sheet = document.getElementById('sheet');
const joystick = document.getElementById('joystick');
const stick = document.getElementById('stick');

const clamp = (v,a,b) => Math.max(a, Math.min(b,v));
const rand = (a,b) => a + Math.random() * (b-a);
const int = (a,b) => Math.floor(rand(a,b+1));
const fmt = m => String(Math.floor(m/60)).padStart(2,'0') + ':' + String(Math.floor(m%60)).padStart(2,'0');

let seed = int(1,999999999);

function defaults(){
  return {
    seed, day:1, min:7, temp:6.5, wind:3.2, humidity:.64, cloud:.3, rain:0,
    p:{x:50,y:56,hunger:18,thirst:15,fatigue:9,health:100,bodyTemp:36.7,cal:2300,water:1.5,bleeding:0,injury:0,infection:0,pain:0,wet:0,foodPoison:0},
    inv:{wood:3,stone:2,fiber:2,rawFood:2,cookedFood:0,dirtyWater:0,cleanWater:0,processedWood:0,medicine:0},
    tools:{axe:0,knife:0,firesteel:0,condition:{axe:0,knife:0,firesteel:0}},
    camp:{fire:0,hearth:0,shelter:0},
    knowledge:{water:0,fire:1,wood:0,stone:0,animal:0,medicine:0,shelter:0,navigation:0},
    world:{trees:[],rocks:[],berries:[],ponds:[],animals:[],ruins:[],tracks:[],waterQuality:.55,forestHealth:1},
    observations:[],discoveries:[],log:[],
    stats:{steps:0,days:0,itemsGathered:0,meals:0,waterTreated:0,injuries:0}
  };
}

let S = defaults();

function makeWorld(){
  const w = S.world;
  w.trees=[]; w.rocks=[]; w.berries=[]; w.ponds=[]; w.animals=[]; w.ruins=[]; w.tracks=[];
  for(let i=0;i<38;i++) w.trees.push({x:rand(3,97),y:rand(8,96),size:rand(.65,1.35),health:rand(.6,1)});
  for(let i=0;i<45;i++) w.rocks.push({x:rand(2,98),y:rand(8,97),size:rand(.6,1.3)});
  for(let i=0;i<26;i++) w.berries.push({x:rand(2,98),y:rand(10,97),ready:Math.random()<.7});
  for(let i=0;i<7;i++) w.ponds.push({x:rand(5,94),y:rand(15,90),rx:rand(3,7),ry:rand(2,4),quality:rand(.35,.9)});
  for(let i=0;i<8;i++) w.animals.push({id:i,x:rand(6,94),y:rand(12,94),energy:rand(.55,1),fear:0,hunger:rand(.1,.6),alive:true});
  for(let i=0;i<3;i++) w.ruins.push({x:rand(10,90),y:rand(15,90),kind:['stone','wood','metal'][int(0,2)],seen:false});
}
makeWorld();

const labels={wood:'древесина',stone:'камень',fiber:'волокно',rawFood:'сырая пища',cookedFood:'готовая пища',dirtyWater:'грязная вода',cleanWater:'чистая вода',processedWood:'обработанная древесина',medicine:'лекарство'};

function toast(text,kind=''){
  const d=document.createElement('div');
  d.className='toast ' + kind;
  d.textContent=text;
  message.appendChild(d);
  setTimeout(()=>d.remove(),4200);
}
function log(text){
  S.log.unshift({d:S.day,m:S.min,t:text});
  S.log=S.log.slice(0,80);
}
function near(arr,dist){
  return arr.filter(o=>Math.hypot(o.x-S.p.x,o.y-S.p.y)<dist);
}
function advance(minutes,why){
  minutes=Math.max(1,Math.round(minutes));
  for(let i=0;i<minutes;i++) tickMinute();
  if(why){log(why);toast(why);}
  render();
}
function tickMinute(){
  S.min++;
  if(S.min>=1440){S.min=0;S.day++;S.stats.days++;daily();}
  const p=S.p;
  const cold=clamp((8-S.temp)/14,0,1);
  const exposure=clamp(cold*(1-S.camp.shelter*.55)*(1-S.camp.fire*.012),0,1);
  p.hunger=clamp(p.hunger+.020,0,100);
  p.thirst=clamp(p.thirst+.040,0,100);
  p.fatigue=clamp(p.fatigue+.017,0,100);
  p.cal=clamp(p.cal-1.15,0,4000);
  if(p.wet>0) p.wet=Math.max(0,p.wet-.003);
  if(S.rain) p.wet=clamp(p.wet+.004,0,1);
  p.bodyTemp+=(36.55-p.bodyTemp)*.006;
  p.bodyTemp-=exposure*.006;
  if(S.camp.fire>0){
    S.camp.fire--;
    p.bodyTemp+=(36.8-p.bodyTemp)*.035;
    if(S.camp.fire%12===0 && S.inv.wood>0) S.inv.wood--;
  }
  if(p.bleeding>0){p.health-=p.bleeding*.045;p.bleeding=Math.max(0,p.bleeding-.003);}
  if(p.infection>0)p.health-=p.infection*.012;
  if(p.foodPoison>0){p.health-=.018;p.thirst=clamp(p.thirst+.02,0,100);p.foodPoison=Math.max(0,p.foodPoison-.004);}
  if(p.hunger>88)p.health-=.009;
  if(p.thirst>88)p.health-=.028;
  if(p.bodyTemp<35)p.health-=.035*(35-p.bodyTemp);
  p.health=clamp(p.health,0,100);

  S.world.animals.forEach(a=>{
    if(!a.alive)return;
    const d=Math.hypot(a.x-p.x,a.y-p.y);
    a.hunger=clamp(a.hunger+.001,0,1);
    a.energy=clamp(a.energy-(a.hunger>.75?.0012:.0005),0,1);
    if(d<10)a.fear=clamp(a.fear+.09,0,1); else a.fear=Math.max(0,a.fear-.006);
    const sp=a.fear>.35?rand(.12,.35):rand(.04,.12);
    a.x=clamp(a.x+rand(-sp,sp),2,98);
    a.y=clamp(a.y+rand(-sp,sp),7,97);
    if(a.energy<.15 && Math.random()<.0002)a.alive=false;
  });
  S.world.trees.forEach(t=>t.health=clamp(t.health+.00008,0,1));
  if(Math.random()<.0025) emergent();
}
function daily(){
  S.temp=rand(-3,12);
  S.wind=rand(1,9);
  S.humidity=clamp(S.humidity+rand(-.1,.1),.25,.95);
  S.cloud=clamp(S.cloud+rand(-.2,.2),0,1);
  S.rain=Math.random()<(.12+S.humidity*.12);
  S.world.trees.forEach(t=>t.health=clamp(t.health+.03,0,1));
  S.world.berries.forEach(b=>b.ready=Math.random()<.65);
  if(Math.random()<.18 && S.world.animals.length<12){
    S.world.animals.push({id:Date.now()+Math.random(),x:rand(4,96),y:rand(10,95),energy:1,fear:0,hunger:rand(.1,.4),alive:true});
  }
  log('Прошли сутки. Мир изменился без участия игрока.');
}
function emergent(){
  const a=int(0,3);
  if(a===0){S.cloud=clamp(S.cloud+.35,0,1);S.rain=1;log('На горизонте формируется шторм.');}
  else if(a===1){
    const alive=S.world.animals.filter(x=>x.alive);
    if(alive.length){const x=alive[int(0,alive.length-1)];S.world.tracks.push({x:x.x,y:x.y,age:0});log('Обнаружен свежий след животного.');}
  } else if(a===2){S.world.forestHealth=clamp(S.world.forestHealth-rand(.005,.02),0,1);log('Часть растительности повреждена природным фактором.');}
  else log('Где-то далеко произошло событие, которое пока неизвестно игроку.');
}
function move(vx,vy){
  const p=S.p;
  const s=.055*(p.fatigue>82?.5:1)*(p.injury>0?.72:1);
  p.x=clamp(p.x+vx*s,2,98);p.y=clamp(p.y+vy*s,7,97);S.stats.steps++;
  if(Math.random()<.05)advance(1);
  render();
}
function gather(){
  let got=0;
  const trees=near(S.world.trees,9);
  if(trees.length){
    const t=trees[0];
    const qty=S.tools.axe?int(1,3):int(0,1);
    if(qty){t.health=clamp(t.health-.07*qty,0,1);S.inv.wood+=qty;got+=qty;S.knowledge.wood=Math.max(S.knowledge.wood,1);}
  }
  const rocks=near(S.world.rocks,8);
  if(rocks.length){const q=int(0,2);S.inv.stone+=q;got+=q;}
  const berries=near(S.world.berries,7).filter(x=>x.ready);
  if(berries.length){S.inv.rawFood++;berries[0].ready=false;got++;}
  if(Math.random()<.12){S.inv.fiber++;got++;}
  S.stats.itemsGathered+=got;
  advance(got?5:3,got?'Собраны природные материалы.':'Рядом не найдено ничего полезного.');
}
function water(){
  const p=near(S.world.ponds,12)[0];
  if(!p){toast('Очевидного источника воды рядом нет.','warn');return;}
  S.inv.dirtyWater++;S.world.waterQuality=p.quality;S.knowledge.water=Math.max(S.knowledge.water,1);
  advance(4,'Набрана вода. Её безопасность ещё не доказана.');
}
function eat(){
  if(S.inv.cookedFood){S.inv.cookedFood--;S.p.hunger=clamp(S.p.hunger-32,0,100);S.p.cal+=650;S.stats.meals++;advance(5,'Съедена приготовленная пища.');return;}
  if(S.inv.rawFood){
    S.inv.rawFood--;S.p.hunger=clamp(S.p.hunger-16,0,100);S.p.cal+=320;
    if(Math.random()<.18){S.p.foodPoison=2;toast('Через некоторое время могут появиться симптомы пищевого отравления.','warn');}
    S.stats.meals++;advance(5,'Съедена сырая пища. Её качество неизвестно.');return;
  }
  toast('Еды нет.','warn');
}
function fire(){
  if(S.inv.wood<2){toast('Недостаточно топлива.','warn');return;}
  S.inv.wood-=2;S.camp.fire=Math.max(S.camp.fire,90+S.camp.hearth*45);S.knowledge.fire=1;
  advance(8,'Разведён огонь. Тепло и время ограничены топливом.');
}
function treatWater(){
  if(S.camp.fire>0 && S.inv.dirtyWater>0){
    S.inv.dirtyWater--;S.inv.cleanWater++;S.stats.waterTreated++;S.knowledge.water=3;
    advance(18,'Вода обработана кипячением. Это подтверждённый способ снизить часть биологических рисков.');
  } else toast('Нужны вода и действующий огонь.','warn');
}
function drink(){
  if(S.inv.cleanWater>0){S.inv.cleanWater--;S.p.thirst=clamp(S.p.thirst-45,0,100);advance(3,'Выпита очищенная вода.');return;}
  if(S.inv.dirtyWater>0){
    S.inv.dirtyWater--;S.p.thirst=clamp(S.p.thirst-40,0,100);
    if(Math.random()<S.world.waterQuality)S.p.foodPoison=Math.max(S.p.foodPoison,3);
    advance(3,'Выпита необработанная вода. Последствия неизвестны.');return;
  }
  toast('Воды нет.','warn');
}
function craft(){openSheet('craft');}
function craftItem(kind){
  if(kind==='axe'&&S.inv.wood>=2&&S.inv.stone>=2){
    S.inv.wood-=2;S.inv.stone-=2;S.tools.axe=1;S.tools.condition.axe=int(45,90);S.knowledge.wood=2;
    advance(28,'Изготовлен примитивный топор. Его качество определяется материалами и техникой.');closeSheet();
  } else if(kind==='knife'&&S.inv.stone>=2&&S.inv.wood>=1){
    S.inv.stone-=2;S.inv.wood--;S.tools.knife=1;S.tools.condition.knife=int(40,85);
    advance(24,'Изготовлен простой режущий инструмент.');closeSheet();
  } else if(kind==='shelter'&&S.inv.wood>=9&&S.inv.fiber>=5){
    S.inv.wood-=9;S.inv.fiber-=5;S.camp.shelter=1;S.knowledge.shelter=2;
    advance(100,'Построено простое укрытие. Оно меняет риск ночёвок, но не делает мир безопасным.');closeSheet();
  } else if(kind==='hearth'&&S.inv.stone>=6){
    S.inv.stone-=6;S.camp.hearth=1;advance(45,'Устроен каменный очаг. Огонь стал устойчивее.');closeSheet();
  } else toast('Недостаточно подходящих материалов.','warn');
}
function processMenu(){openSheet('process');}
function doProcess(kind){
  if(kind==='wood'&&S.inv.wood>=3){S.inv.wood-=3;S.inv.processedWood+=2;advance(180,'Древесина высушена и обработана.');closeSheet();}
  else if(kind==='cook'&&S.camp.fire>0&&S.inv.rawFood>0){S.inv.rawFood--;S.inv.cookedFood++;advance(22,'Пища приготовлена на огне.');closeSheet();}
  else if(kind==='water'){treatWater();closeSheet();}
  else toast('Условия обработки не выполнены.','warn');
}
function observe(){
  const a=S.world.animals.find(x=>x.alive&&Math.hypot(x.x-S.p.x,x.y-S.p.y)<15);
  const t=near(S.world.tracks,12)[0];
  const r=near(S.world.ruins,14)[0];
  const text=a?'Животное изменило направление при приближении. Причина пока неизвестна.':
    t?'След свежий; направление движения можно оценить, но вид не подтверждён.':
    r?'Обнаружены следы старого присутствия. Назначение неизвестно.':
    'Ветер, влажность и растительность дают несколько возможных объяснений происходящему.';
  S.observations.unshift({d:S.day,m:S.min,text});S.observations=S.observations.slice(0,100);
  if(a)S.knowledge.animal=Math.max(S.knowledge.animal,1);
  advance(12,'Наблюдение записано. Наблюдение не считается доказательством.');
}
function investigate(){
  const r=near(S.world.ruins,16)[0];
  if(!r){toast('В этом месте нечего исследовать.');return;}
  r.seen=true;S.discoveries.push({d:S.day,m:S.min,kind:r.kind,text:'Следы старого сооружения. Материал: '+r.kind+'. Назначение не установлено.'});
  if(r.kind==='metal')S.knowledge.navigation=Math.max(S.knowledge.navigation,1);
  advance(35,'Исследовано неизвестное место. Найденная информация неполна.');
}
function sleep(){
  const h=S.camp.shelter?7:4;
  S.p.fatigue=clamp(S.p.fatigue-55,0,100);S.p.hunger=clamp(S.p.hunger+h*1.2,0,100);S.p.thirst=clamp(S.p.thirst+h*1.7,0,100);
  S.p.health=clamp(S.p.health+(S.p.infection?1:3),0,100);
  advance(h*60,'Сон завершён. За это время мир продолжал развиваться.');
}
function heal(){
  if(S.inv.medicine&&S.p.injury>0){
    S.inv.medicine--;S.p.injury=Math.max(0,S.p.injury-1);S.p.bleeding=Math.max(0,S.p.bleeding-.2);S.p.infection=Math.max(0,S.p.infection-.5);S.p.health=clamp(S.p.health+12,0,100);
    advance(20,'Оказана первая помощь.');
  } else toast('Нет подходящего лечения. Некоторые травмы требуют времени, покоя и чистоты.','warn');
}
function save(){localStorage.setItem(SAVE_KEY,JSON.stringify(S));toast('Мир сохранён в памяти устройства.','good');}
function load(){
  const raw=localStorage.getItem(SAVE_KEY);
  if(!raw){toast('Сохранения нет.');return;}
  try{S=JSON.parse(raw);seed=S.seed;closeSheet();toast('Состояние мира восстановлено.','good');render();}
  catch(e){toast('Сохранение повреждено.','bad');}
}
function newLife(){
  if(confirm('Начать новую жизнь? Текущее сохранение будет удалено.')){
    localStorage.removeItem(SAVE_KEY);location.reload();
  }
}
function openSheet(type){
  let title='',body='';
  if(type==='inventory'){
    title='Инвентарь · состояние';
    body='<div class="grid">'+Object.keys(labels).map(k=>'<div class="card"><b>'+labels[k]+'</b>'+(S.inv[k]||0)+'</div>').join('')+
      '<div class="card"><b>Топор</b>'+(S.tools.axe?'есть · '+S.tools.condition.axe+'%':'нет')+'</div>'+
      '<div class="card"><b>Нож</b>'+(S.tools.knife?'есть · '+S.tools.condition.knife+'%':'нет')+'</div>'+
      '<div class="card"><b>Огонь</b>'+(S.camp.fire?'горит · '+S.camp.fire+' мин':'нет')+'</div>'+
      '<div class="card"><b>Укрытие</b>'+(S.camp.shelter?'есть':'нет')+'</div></div>';
  } else if(type==='craft'){
    title='Создание и строительство';
    body='<div class="note">Нет дерева уровней. Результат зависит от ресурсов, состояния инструментов, времени и полученного опыта.</div>'+
      row('Примитивный топор','2 древесины + 2 камня',"craftItem('axe')")+
      row('Простой нож','1 древесина + 2 камня',"craftItem('knife')")+
      row('Каменный очаг','6 камней',"craftItem('hearth')")+
      row('Простое укрытие','9 древесины + 5 волокна',"craftItem('shelter')");
  } else if(type==='process'){
    title='Обработка';
    body=row('Высушить древесину','3 древесины → 2 обработанной',"doProcess('wood')")+
      row('Приготовить пищу','нужны огонь и сырая пища',"doProcess('cook')")+
      row('Кипятить воду','нужны огонь и грязная вода',"doProcess('water')");
  } else if(type==='world'){
    title='Мир · карта · память';
    const obs=S.observations.slice(0,8).map(o=>'<div class="row"><span>Д'+o.d+' '+fmt(o.m)+'</span><span class="muted">'+o.text+'</span></div>').join('')||'<div class="muted">Наблюдений нет.</div>';
    const ev=S.log.slice(0,8).map(o=>'<div class="row"><span>Д'+o.d+' '+fmt(o.m)+'</span><span class="muted">'+o.t+'</span></div>').join('');
    body='<div class="grid"><div class="card"><b>Живые животные</b>'+S.world.animals.filter(a=>a.alive).length+'</div>'+
      '<div class="card"><b>Деревья</b>'+S.world.trees.length+'</div>'+
      '<div class="card"><b>Неизвестные места</b>'+S.world.ruins.filter(r=>!r.seen).length+'</div>'+
      '<div class="card"><b>Открытия</b>'+S.discoveries.length+'</div>'+
      '<div class="card"><b>Пройдено</b>'+S.stats.steps+' условных шагов</div>'+
      '<div class="card"><b>Сутки</b>'+S.stats.days+'</div></div>'+
      '<div class="note">Истина отделена от предположения. Некоторые события намеренно не сообщаются игроку.</div>'+
      '<h3>Наблюдения</h3>'+obs+'<h3>Память мира</h3>'+ev+
      '<h3>Система</h3><button class="sheetbtn" onclick="save()">Сохранить</button> <button class="sheetbtn" onclick="load()">Загрузить</button> <button class="sheetbtn" onclick="newLife()">Новая жизнь</button>';
  } else if(type==='status'){
    title='Состояние организма';
    body='<div class="grid"><div class="card"><b>Температура тела</b>'+S.p.bodyTemp.toFixed(1)+'°C</div>'+
      '<div class="card"><b>Калории</b>'+Math.round(S.p.cal)+'</div>'+
      '<div class="card"><b>Боль</b>'+S.p.pain.toFixed(1)+'</div>'+
      '<div class="card"><b>Травма</b>'+S.p.injury+'</div>'+
      '<div class="card"><b>Кровотечение</b>'+S.p.bleeding.toFixed(2)+'</div>'+
      '<div class="card"><b>Инфекция</b>'+S.p.infection.toFixed(2)+'</div></div>';
  } else return;
  sheet.innerHTML='<div class="sheethead"><h2>'+title+'</h2><button class="x" onclick="closeSheet()">Закрыть</button></div>'+body;
  modal.classList.remove('hidden');
}
function row(a,b,action){
  return '<div class="row"><div><b>'+a+'</b><div class="muted">'+b+'</div></div><button class="sheetbtn" onclick="'+action+'">Сделать</button></div>';
}
function closeSheet(){modal.classList.add('hidden');}
modal.addEventListener('click',e=>{if(e.target===modal)closeSheet();});

const acts=[
  ['Собрать',gather],['Вода',water],['Пить',drink],['Еда',eat],['Огонь',fire],
  ['Обработать',processMenu],['Крафт',craft],['Наблюдать',observe],['Исследовать',investigate],
  ['Лечение',heal],['Инвентарь',()=>openSheet('inventory')],['Мир',()=>openSheet('world')],['Сон',sleep]
];
acts.forEach(([text,fn])=>{
  const b=document.createElement('button');b.className='action';b.textContent=text;b.addEventListener('click',fn);actions.appendChild(b);
});

let vx=0,vy=0,drag=false;
function joyPos(e){
  const q=e.touches?e.touches[0]:e;
  const r=joystick.getBoundingClientRect();
  let x=q.clientX-r.left-r.width/2,y=q.clientY-r.top-r.height/2;
  const max=r.width*.34,l=Math.hypot(x,y);
  if(l>max){x=x/l*max;y=y/l*max;}
  stick.style.transform='translate('+x+'px,'+y+'px)';
  vx=x/max;vy=y/max;
}
function joyEnd(){vx=0;vy=0;stick.style.transform='translate(0,0)';}
joystick.addEventListener('touchstart',e=>{drag=true;joyPos(e);},{passive:true});
joystick.addEventListener('touchmove',e=>{if(drag)joyPos(e);},{passive:true});
joystick.addEventListener('touchend',()=>{drag=false;joyEnd();},{passive:true});
setInterval(()=>{if(vx||vy)move(vx,vy);},60);

window.addEventListener('keydown',e=>{
  if(e.key==='i')openSheet('inventory');
  if(e.key==='m')openSheet('world');
  if(e.key==='e')gather();
  if(e.key==='f')fire();
  if(e.key===' ')sleep();
  if(e.key==='w')water();
});

function resize(){
  const dpr=Math.min(devicePixelRatio||1,2);
  canvas.width=Math.floor(innerWidth*dpr);canvas.height=Math.floor(innerHeight*dpr);
  canvas.style.width=innerWidth+'px';canvas.style.height=innerHeight+'px';
  ctx.setTransform(dpr,0,0,dpr,0,0);
}
addEventListener('resize',resize);
resize();

function worldToScreen(x,y){return{x:x/100*innerWidth,y:y/100*innerHeight};}

function draw(){
  const w=innerWidth,h=innerHeight;
  const night=Math.max(0,Math.sin((S.min/1440*Math.PI*2)-Math.PI/2)*-1);
  ctx.clearRect(0,0,w,h);
  const grd=ctx.createLinearGradient(0,0,0,h);
  grd.addColorStop(0,'hsl('+(150-10*night)+' '+(22-4*night)+'% '+(49-16*night)+'%)');
  grd.addColorStop(1,'hsl(105 16% '+(58-17*night)+'%)');
  ctx.fillStyle=grd;ctx.fillRect(0,0,w,h);
  S.world.ponds.forEach(p=>{const q=worldToScreen(p.x,p.y);ctx.fillStyle='#5e8089b8';ctx.beginPath();ctx.ellipse(q.x,q.y,p.rx*w/100,p.ry*h/100,0,0,Math.PI*2);ctx.fill();});
  S.world.ruins.forEach(r=>{const q=worldToScreen(r.x,r.y);ctx.fillStyle=r.seen?'#756d5d':'#625e53';ctx.fillRect(q.x-12,q.y-10,24,20);});
  S.world.trees.forEach(t=>{const q=worldToScreen(t.x,t.y),s=t.size;ctx.fillStyle='#394c3a';ctx.fillRect(q.x-5*s,q.y+7*s,10*s,22*s);ctx.fillStyle=t.health>.5?'#405941':'#53604a';ctx.beginPath();ctx.arc(q.x,q.y,22*s,0,Math.PI*2);ctx.fill();});
  S.world.rocks.forEach(r=>{const q=worldToScreen(r.x,r.y);ctx.fillStyle='#747b6c';ctx.beginPath();ctx.ellipse(q.x,q.y,13*r.size,8*r.size,0,0,Math.PI*2);ctx.fill();});
  S.world.berries.forEach(b=>{if(!b.ready)return;const q=worldToScreen(b.x,b.y);ctx.fillStyle='#806a4f';ctx.beginPath();ctx.arc(q.x,q.y,6,0,Math.PI*2);ctx.fill();});
  S.world.tracks.forEach(t=>{const q=worldToScreen(t.x,t.y);ctx.strokeStyle='#4b5148aa';ctx.lineWidth=2;ctx.beginPath();ctx.arc(q.x,q.y,7,0,Math.PI*2);ctx.stroke();});
  S.world.animals.forEach(a=>{if(!a.alive)return;const q=worldToScreen(a.x,a.y);ctx.fillStyle='#79583f';ctx.beginPath();ctx.ellipse(q.x,q.y,19,9,0,0,Math.PI*2);ctx.fill();});
  const p=worldToScreen(S.p.x,S.p.y);
  ctx.fillStyle='#eef0e8';ctx.strokeStyle='#303836';ctx.lineWidth=2;ctx.beginPath();ctx.arc(p.x,p.y,15,0,Math.PI*2);ctx.fill();ctx.stroke();
  if(S.camp.fire>0){ctx.fillStyle='#e2a36a';ctx.beginPath();ctx.arc(p.x+25,p.y+3,8,0,Math.PI*2);ctx.fill();}
  ctx.fillStyle='rgba(8,12,15,'+(.52*night)+')';ctx.fillRect(0,0,w,h);
}
function renderHud(){
  const p=S.p;
  hud.innerHTML='<div class="brand">BEYOND THE HORIZON · WEB 2.1</div>'+
    '<div class="sub">Проверенная базовая сборка · Day '+S.day+'</div>'+
    '<div class="statline"><span class="stat">'+fmt(S.min)+' · '+S.temp.toFixed(1)+'°C · ветер '+S.wind.toFixed(1)+' м/с</span>'+
    '<span class="stat">Голод '+Math.round(p.hunger)+' <span class="bar"><i style="width:'+(100-p.hunger)+'%"></i></span></span>'+
    '<span class="stat">Жажда '+Math.round(p.thirst)+' <span class="bar"><i style="width:'+(100-p.thirst)+'%"></i></span></span>'+
    '<span class="stat">Усталость '+Math.round(p.fatigue)+' <span class="bar"><i style="width:'+(100-p.fatigue)+'%"></i></span></span></div>'+
    '<div class="statline"><span>Здоровье '+Math.round(p.health)+'</span><span>T '+p.bodyTemp.toFixed(1)+'°C</span><span>Дрова '+S.inv.wood+'</span><span>Камень '+S.inv.stone+'</span><span>Еда '+(S.inv.rawFood+S.inv.cookedFood)+'</span><span>Вода '+(S.inv.cleanWater+S.inv.dirtyWater)+'</span></div>';
}
function render(){draw();renderHud();}
render();
log('Вы очнулись в незнакомой местности. Мир не назначил вам цель.');
