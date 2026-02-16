// Wasteland Japan — Vault 811 (browser vertical slice)
// Three.js via CDN. No paid APIs. Placeholder geometry + WebAudio SFX.
// Runs best from a local server (ES modules).

import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.159.0/build/three.module.js";
import { NPCManager } from "./npc.js";
import { DialogueController } from "./dialogue.js";
import { DIALOGUE_CSS, buildDialogueUI, renderDialogueNode } from "./dialogueUI.js";
import { Quest } from "./quest.js";
import { buildOutpost, OUTPOST_CENTER, OUTPOST_SAFE_RADIUS, OUTPOST_DISCOVER_RADIUS, OUTPOST_KILL_RADIUS, SAFE_ZONE_CHECK_INTERVAL, RAIL_STATION_CENTER, RAIL_DISCOVER_RADIUS, isInSafeZone, enforceSafeZone } from "./outpost.js";

const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const lerp=(a,b,t)=>a+(b-a)*t;
const rand=(a=0,b=1)=>a+Math.random()*(b-a);
const v3=(x=0,y=0,z=0)=>new THREE.Vector3(x,y,z);

function mulberry32(seed){return function(){let t=seed+=0x6D2B79F5;t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);return ((t^(t>>>14))>>>0)/4294967296;};}

// ---------------- UI ----------------
function el(tag, cls, parent){const e=document.createElement(tag); if(cls)e.className=cls; if(parent)parent.appendChild(e); return e;}
function makeUI(){
  const root=el("div","ui-root",document.body);
  const style=el("style","",root);
  style.textContent=`
    .ui-root{position:fixed;inset:0;pointer-events:none;color:#e7f0ff;font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial}
    canvas{display:block}
    .hud{position:absolute;inset:0}
    .bar{position:absolute;left:18px;height:12px;width:220px;border:1px solid rgba(255,255,255,.35);background:rgba(0,0,0,.35)}
    .bar>.fill{height:100%;width:50%;background:rgba(255,255,255,.75)}
    .lbl{position:absolute;left:18px;font-size:12px;opacity:.9}
    .ammo{position:absolute;right:18px;bottom:18px;text-align:right;font-weight:800}
    .ammo .small{font-size:12px;opacity:.75;font-weight:650}
    .ret{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);width:10px;height:10px;opacity:.9}
    .ret:before,.ret:after{content:"";position:absolute;left:50%;top:50%;background:rgba(255,255,255,.9);transform:translate(-50%,-50%)}
    .ret:before{width:10px;height:2px}.ret:after{width:2px;height:10px}
    .hint{position:absolute;left:50%;bottom:64px;transform:translateX(-50%);font-size:14px;opacity:.85;padding:8px 10px;border-radius:10px;background:rgba(0,0,0,.35);border:1px solid rgba(255,255,255,.18);display:none}
    .toast{position:absolute;left:50%;top:18px;transform:translateX(-50%);font-size:14px;opacity:0;transition:opacity .2s; padding:10px 12px;border-radius:12px;background:rgba(0,0,0,.45);border:1px solid rgba(255,255,255,.18)}
    .toast.on{opacity:.95}
    .comp{position:absolute;left:50%;top:18px;transform:translateX(-50%);font-size:12px;opacity:.8;letter-spacing:1px}
    .obj{position:absolute;left:18px;bottom:18px;font-size:12px;opacity:.85;max-width:420px}
    .scrim{position:absolute;inset:0;background:radial-gradient(circle at 50% 45%, rgba(0,0,0,.45), rgba(0,0,0,.9));display:none;pointer-events:auto}
    .menu{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);width:min(720px, 92vw);max-height:85vh;overflow:auto;border-radius:18px;border:1px solid rgba(255,255,255,.18);background:rgba(10,12,18,.78);box-shadow:0 20px 80px rgba(0,0,0,.6);padding:18px}
    .menu h1{margin:0 0 6px 0;font-size:28px;letter-spacing:.4px}
    .menu p{margin:0 0 14px 0;opacity:.85;line-height:1.35}
    .btns{display:flex;gap:10px;flex-wrap:wrap}
    .btn{pointer-events:auto;cursor:pointer;user-select:none;padding:10px 14px;border-radius:12px;border:1px solid rgba(255,255,255,.22);background:rgba(255,255,255,.06)}
    .btn:hover{background:rgba(255,255,255,.12)}
    .row{display:flex;gap:14px;align-items:center;flex-wrap:wrap;margin-top:10px;opacity:.9}
    .row label{min-width:160px;opacity:.85}
    .row input{pointer-events:auto}
    .inv{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);width:min(860px,94vw);max-height:min(560px,85vh);overflow:auto;border-radius:18px;border:1px solid rgba(255,255,255,.18);background:rgba(10,12,18,.9);display:none;pointer-events:auto}
    .inv-head{display:flex;justify-content:space-between;align-items:flex-start;padding:14px 14px 10px;border-bottom:1px solid rgba(255,255,255,.12)}
    .inv-title{font-size:18px;font-weight:900}
    .inv-sub{font-size:12px;opacity:.8}
    .inv-body{display:grid;grid-template-columns:1.15fr .85fr;gap:12px;padding:12px}
    .inv-list{border:1px solid rgba(255,255,255,.12);border-radius:14px;overflow:hidden}
    .inv-item{display:flex;gap:10px;justify-content:space-between;align-items:center;padding:10px 12px;border-bottom:1px solid rgba(255,255,255,.08)}
    .inv-item:last-child{border-bottom:none}
    .inv-item .name{font-weight:800}
    .inv-item .meta{font-size:12px;opacity:.8}
    .actions{display:flex;gap:8px}
    .chip{padding:6px 10px;border-radius:999px;border:1px solid rgba(255,255,255,.18);background:rgba(255,255,255,.06);cursor:pointer;pointer-events:auto}
    .chip:hover{background:rgba(255,255,255,.12)}
    .panel{border:1px solid rgba(255,255,255,.12);border-radius:14px;padding:12px}
    .k{opacity:.75;font-size:12px}
    .cut{position:absolute;inset:0;display:none;pointer-events:auto}
    .letter{position:absolute;left:50%;bottom:14%;transform:translateX(-50%);width:min(900px,92vw);padding:14px 16px;border-radius:16px;border:1px solid rgba(255,255,255,.18);background:rgba(0,0,0,.55)}
    .ct{font-weight:950;font-size:16px;margin-bottom:6px;letter-spacing:.6px}
    .cb{opacity:.92;line-height:1.4}
    .cs{margin-top:8px;font-size:12px;opacity:.75}
    .enemybar{position:absolute;left:50%;top:22%;transform:translateX(-50%);width:320px;height:10px;border:1px solid rgba(255,255,255,.3);background:rgba(0,0,0,.35);display:none}
    .enemybar .fill{height:100%;width:50%;background:rgba(255,255,255,.75)}
    .enemyname{position:absolute;left:50%;top:20.5%;transform:translateX(-50%);font-size:12px;opacity:.85;display:none}
    .rad-bar{position:absolute;left:18px;height:12px;width:220px;border:1px solid rgba(100,255,100,.35);background:rgba(0,0,0,.35)}
    .rad-bar>.fill{height:100%;width:0%;background:rgba(100,255,50,.75)}
    .armor-lbl{position:absolute;left:250px;font-size:12px;opacity:.9}
    .xp-bar{position:absolute;left:18px;height:6px;width:220px;border:1px solid rgba(255,220,100,.3);background:rgba(0,0,0,.25)}
    .xp-bar>.fill{height:100%;width:0%;background:rgba(255,220,100,.65)}
    .wm{position:absolute;right:18px;top:18px;font-size:11px;opacity:.35}
    .skill-tree{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);width:min(700px,92vw);max-height:80vh;overflow:auto;border-radius:18px;border:1px solid rgba(255,255,255,.18);background:rgba(10,12,18,.92);display:none;pointer-events:auto;padding:18px}
    .skill-row{display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px solid rgba(255,255,255,.08)}
    .skill-name{font-weight:800;font-size:14px}
    .skill-desc{font-size:11px;opacity:.7}
    .skill-lvl{font-size:13px;opacity:.9}
    .craft-panel{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);width:min(600px,90vw);max-height:75vh;overflow:auto;border-radius:18px;border:1px solid rgba(255,255,255,.18);background:rgba(10,12,18,.92);display:none;pointer-events:auto;padding:18px}
    .pipboy-overlay{position:absolute;left:50%;top:58%;transform:translate(-50%,-50%);width:min(520px,80vw);max-height:60vh;overflow:auto;border-radius:10px;border:2px solid rgba(80,255,80,.45);background:rgba(5,18,5,.92);color:#33ff66;font-family:"Courier New",Courier,monospace;display:none;pointer-events:auto;padding:0;box-shadow:0 0 40px rgba(30,255,60,.15),inset 0 0 30px rgba(0,0,0,.5)}
    .pipboy-overlay *{color:#33ff66}
    .pipboy-tabs{display:flex;border-bottom:1px solid rgba(80,255,80,.3);background:rgba(0,0,0,.3)}
    .pipboy-tab{flex:1;text-align:center;padding:10px 8px;cursor:pointer;pointer-events:auto;font-size:13px;font-weight:800;letter-spacing:1px;text-transform:uppercase;opacity:.6;border-bottom:2px solid transparent;transition:opacity .15s}
    .pipboy-tab:hover{opacity:.85}
    .pipboy-tab.active{opacity:1;border-bottom-color:#33ff66;background:rgba(50,255,80,.06)}
    .pipboy-content{padding:14px 16px;min-height:200px}
    .pipboy-content .k{color:#33ff66}
    .pipboy-content .skill-row{border-bottom-color:rgba(80,255,80,.15)}
    .pipboy-content .chip{border-color:rgba(80,255,80,.35);background:rgba(50,255,80,.08);color:#33ff66}
    .pipboy-content .chip:hover{background:rgba(50,255,80,.18)}
    .pipboy-content .inv-item{border-bottom-color:rgba(80,255,80,.1)}
    .pipboy-content .inv-list{border-color:rgba(80,255,80,.2)}
    .pipboy-content .panel{border-color:rgba(80,255,80,.2)}
    .pipboy-content .actions .chip{color:#33ff66}
    .pipboy-scanline{pointer-events:none;position:absolute;inset:0;background:repeating-linear-gradient(0deg,transparent,transparent 2px,rgba(0,0,0,.06) 2px,rgba(0,0,0,.06) 4px);border-radius:10px}
    ${DIALOGUE_CSS}
  `;
  const hud=el("div","hud",root);

  const hpLbl=el("div","lbl",hud); hpLbl.style.top="18px"; hpLbl.textContent="HP";
  const hp=el("div","bar",hud); hp.style.top="34px"; const hpFill=el("div","fill",hp);

  const stLbl=el("div","lbl",hud); stLbl.style.top="56px"; stLbl.textContent="STA";
  const st=el("div","bar",hud); st.style.top="72px"; const stFill=el("div","fill",st);

  const radLbl=el("div","lbl",hud); radLbl.style.top="94px"; radLbl.textContent="RAD";
  const rad=el("div","rad-bar",hud); rad.style.top="110px"; const radFill=el("div","fill",rad);

  const xpLbl=el("div","lbl",hud); xpLbl.style.top="130px"; xpLbl.textContent="XP";
  const xpBar=el("div","xp-bar",hud); xpBar.style.top="146px"; const xpFill=el("div","fill",xpBar);

  const armorLbl=el("div","armor-lbl",hud); armorLbl.style.top="18px"; armorLbl.textContent="Armor: 0";

  const comp=el("div","comp",hud);
  const ammo=el("div","ammo",hud); ammo.innerHTML=`<div class="small">WEAPON</div><div class="big">0 / 0</div>`;
  el("div","ret",hud);
  const hint=el("div","hint",hud);
  const toast=el("div","toast",hud);
  const obj=el("div","obj",hud);
  const enemybar=el("div","enemybar",hud); const ebFill=el("div","fill",enemybar);
  const enemyname=el("div","enemyname",hud);

  const scrim=el("div","scrim",root);
  const menu=el("div","menu",scrim);
  const h1=el("h1","",menu);
  const p=el("p","",menu);
  const btns=el("div","btns",menu);

  const inv=el("div","inv",root);
  const invHead=el("div","inv-head",inv);
  const invLeft=el("div","",invHead);
  const invTitle=el("div","inv-title",invLeft);
  const invSub=el("div","inv-sub",invLeft);
  const invRight=el("div","",invHead);
  const invClose=el("div","chip",invRight); invClose.textContent="Close (I)";
  const invBody=el("div","inv-body",inv);
  const invList=el("div","inv-list",invBody);
  const panel=el("div","panel",invBody);

  const cut=el("div","cut",root);
  const letter=el("div","letter",cut);
  const cutT=el("div","ct",letter);
  const cutB=el("div","cb",letter);
  const cutS=el("div","cs",letter);

  const skillTree=el("div","skill-tree",root);
  const craftPanel=el("div","craft-panel",root);

  // Pip-Boy overlay
  const pipboy=el("div","pipboy-overlay",root);
  const pipTabs=el("div","pipboy-tabs",pipboy);
  const tabNames=["STAT","INV","SKILLS","CRAFT"];
  const pipTabBtns=tabNames.map(name=>{const t=el("div","pipboy-tab",pipTabs); t.textContent=name; t.dataset.tab=name.toLowerCase(); return t;});
  const pipContent=el("div","pipboy-content",pipboy);
  el("div","pipboy-scanline",pipboy);

  const dlg=buildDialogueUI(root);

  const wm=el("div","wm",hud); wm.textContent="Wasteland Japan — Vault 811";

  function showToast(msg, sec=2.2){
    toast.textContent=msg; toast.classList.add("on");
    clearTimeout(showToast._t);
    showToast._t=setTimeout(()=>toast.classList.remove("on"), sec*1000);
  }

  return {root,hud,hpFill,stFill,radFill,xpFill,armorLbl,comp,ammo,hint,obj,toast,showToast,scrim,menuTitle:h1,menuDesc:p,btns,inv,invTitle,invSub,invList,panel,invClose,cut,cutT,cutB,cutS,enemybar,ebFill,enemyname,skillTree,craftPanel,pipboy,pipTabs,pipTabBtns,pipContent,dlg};
}

// ---------------- Audio (simple synth) ----------------
class AudioSys{
  constructor(){this.ctx=null; this.master=null; this.amb=null; this.started=false;}
  async ensure(){
    if(this.started) return;
    this.ctx=new (window.AudioContext||window.webkitAudioContext)();
    this.master=this.ctx.createGain(); this.master.gain.value=0.6;
    this.master.connect(this.ctx.destination);
    this.started=true;
  }
  setMaster(v){if(this.master) this.master.gain.value=v;}
  tone(freq,dur,type="sine",gain=0.2){
    if(!this.started) return;
    const o=this.ctx.createOscillator(); const g=this.ctx.createGain();
    o.type=type; o.frequency.value=freq;
    g.gain.value=0.0001;
    o.connect(g); g.connect(this.master);
    const t=this.ctx.currentTime;
    g.gain.setValueAtTime(0.0001,t);
    g.gain.exponentialRampToValueAtTime(gain,t+0.01);
    g.gain.exponentialRampToValueAtTime(0.0001,t+dur);
    o.start(t); o.stop(t+dur+0.02);
  }
  click(){this.tone(800,0.05,"square",0.08);}
  reload(){this.tone(240,0.10,"triangle",0.10); setTimeout(()=>this.tone(160,0.08,"triangle",0.09),80);}
  hit(){this.tone(90,0.12,"sawtooth",0.16);}
  hurt(){this.tone(60,0.18,"sawtooth",0.22);}
  foot(kind=0){this.tone(kind===0?180:140,0.04,"triangle",0.06);}
  gun(kind="pistol"){
    if(!this.started) return;
    const t=this.ctx.currentTime;
    const dur=kind==="shotgun"?0.18:kind==="rifle"?0.12:0.10;
    const bufferSize=Math.floor(this.ctx.sampleRate*dur);
    const buf=this.ctx.createBuffer(1,bufferSize,this.ctx.sampleRate);
    const data=buf.getChannelData(0);
    for(let i=0;i<bufferSize;i++){
      const x=i/bufferSize;
      const decay=Math.pow(1-x, kind==="shotgun"?2.2:2.8);
      data[i]=(Math.random()*2-1)*decay;
    }
    const src=this.ctx.createBufferSource(); src.buffer=buf;
    const bp=this.ctx.createBiquadFilter(); bp.type="bandpass"; bp.frequency.value=kind==="shotgun"?900:1300; bp.Q.value=0.7;
    const g=this.ctx.createGain(); g.gain.value=0.0001;
    src.connect(bp); bp.connect(g); g.connect(this.master);
    g.gain.setValueAtTime(0.0001,t);
    g.gain.exponentialRampToValueAtTime(kind==="rifle"?0.9:0.7,t+0.01);
    g.gain.exponentialRampToValueAtTime(0.0001,t+dur);
    src.start(t); src.stop(t+dur);
    // thump
    const o=this.ctx.createOscillator(); const og=this.ctx.createGain();
    o.type="sine"; o.frequency.setValueAtTime(kind==="shotgun"?110:140,t);
    og.gain.value=0.0001;
    o.connect(og); og.connect(this.master);
    og.gain.setValueAtTime(0.0001,t);
    og.gain.exponentialRampToValueAtTime(0.35,t+0.01);
    og.gain.exponentialRampToValueAtTime(0.0001,t+0.10);
    o.start(t); o.stop(t+0.12);
  }
  startAmbient(kind="vault"){
    if(!this.started) return;
    this.stopAmbient();
    const o=this.ctx.createOscillator();
    const lfo=this.ctx.createOscillator();
    const lfoG=this.ctx.createGain();
    const g=this.ctx.createGain();
    const f=this.ctx.createBiquadFilter();
    o.type="sine"; o.frequency.value=kind==="vault"?52:38;
    lfo.type="sine"; lfo.frequency.value=kind==="vault"?0.25:0.15;
    lfoG.gain.value=kind==="vault"?2.2:3.0;
    f.type="lowpass"; f.frequency.value=kind==="vault"?220:180; f.Q.value=0.8;
    g.gain.value=0.0001;
    lfo.connect(lfoG); lfoG.connect(o.frequency);
    o.connect(f); f.connect(g); g.connect(this.master);
    const t=this.ctx.currentTime;
    g.gain.setValueAtTime(0.0001,t);
    g.gain.exponentialRampToValueAtTime(kind==="vault"?0.24:0.18,t+1.2);
    o.start(); lfo.start();
    this.amb={o,lfo,g,kind};
  }
  stopAmbient(){
    if(!this.started||!this.amb) return;
    const t=this.ctx.currentTime;
    try{
      this.amb.g.gain.exponentialRampToValueAtTime(0.0001,t+0.6);
      this.amb.o.stop(t+0.7); this.amb.lfo.stop(t+0.7);
    }catch{}
    this.amb=null;
  }
}

// ---------------- Input ----------------
class Input{
  constructor(dom){
    this.dom=dom;
    this.keys=new Map();
    this.just=new Set();
    this.mouse={dx:0,dy:0,locked:false,sens:0.0022};
    this.mouseButtons=new Map();
    window.addEventListener("keydown",e=>{ if(e.code==="Tab") e.preventDefault(); if(!this.keys.get(e.code)) this.just.add(e.code); this.keys.set(e.code,true);});
    window.addEventListener("keyup",e=>this.keys.set(e.code,false));
    document.addEventListener("mousemove",e=>{ if(!this.mouse.locked) return; this.mouse.dx+=e.movementX; this.mouse.dy+=e.movementY;});
    document.addEventListener("pointerlockchange",()=>{this.mouse.locked=document.pointerLockElement===this.dom;});
    dom.addEventListener("click",()=>{ if(!this.mouse.locked) dom.requestPointerLock();});
    window.addEventListener("mousedown",e=>this.mouseButtons.set(e.button,true));
    window.addEventListener("mouseup",e=>this.mouseButtons.set(e.button,false));
  }
  down(code){return !!this.keys.get(code);}
  pressed(code){ if(this.just.has(code)){ this.just.delete(code); return true;} return false;}
  mouseDown(button){return !!this.mouseButtons.get(button);}
  consumeMouse(){const {dx,dy}=this.mouse; this.mouse.dx=0; this.mouse.dy=0; return {dx,dy};}
}

// ---------------- Save ----------------
const SAVE_KEY="wasteland_japan_vault811_save_v1";
function defaultSave(){
  return {
    hasSave:false,
    timeOfDay:0.3,
    fov:70,
    player:{
      pos:{x:0,y:1.6,z:6}, yaw:Math.PI, pitch:0,
      hp:100, stamina:100, inVault:true,
      equipped:0,
      ammo:{pistol:48,rifle:120,shotgun:24},
      mags:{pistol:12,rifle:30,shotgun:6},
      inv:[{id:"stim",qty:1},{id:"ration",qty:1},{id:"scrap",qty:2},{id:"pistol",qty:1},{id:"rifle",qty:1},{id:"shotgun",qty:1}],
      maxWeight:55,
      radiation:0,armor:0,xp:0,level:1,skillPoints:0,
      skills:{toughness:0,quickHands:0,scavenger:0,ironSights:0,mutantHide:0}
    },
    world:{seed:811, quest:{step:0,log:["Leave Vault 811"]}, questSys:{stages:{},flags:{},objectives:[],log:[],rep:{vault:0,wardens:0,rail:0}}}
  };
}
function loadSave(){
  try{
    const raw=localStorage.getItem(SAVE_KEY);
    if(!raw) return defaultSave();
    const s=JSON.parse(raw);
    const d=defaultSave();
    return {...d,...s, player:{...d.player,...s.player}, world:{...d.world,...s.world, quest:{...d.world.quest,...(s.world?.quest||{})}, questSys:{...d.world.questSys,...(s.world?.questSys||{})}}};
  }catch{ return defaultSave(); }
}
function writeSave(save){ localStorage.setItem(SAVE_KEY, JSON.stringify({...save,hasSave:true})); }

// ---------------- Items/Weapons ----------------
const ItemDB={
  stim:{id:"stim",name:"Field Stim",type:"consumable",weight:0.8,desc:"Restores 35 HP."},
  ration:{id:"ration",name:"Ration Pack",type:"consumable",weight:1.2,desc:"Restores 20 HP."},
  radaway:{id:"radaway",name:"Rad-Away",type:"consumable",weight:0.6,desc:"Removes 30 radiation."},
  scrap:{id:"scrap",name:"Scrap Metal",type:"junk",weight:2.0,desc:"Old world leftovers."},
  cloth:{id:"cloth",name:"Tattered Cloth",type:"junk",weight:0.5,desc:"Useful for crafting."},
  circuits:{id:"circuits",name:"Circuit Board",type:"junk",weight:0.8,desc:"Pre-war electronics."},
  pistol:{id:"pistol",name:"Type-11 Pistol",type:"weapon",weight:2.4,desc:"Reliable. Loud."},
  rifle:{id:"rifle",name:"Kurokawa Rifle",type:"weapon",weight:4.9,desc:"Automatic. Hungry."},
  shotgun:{id:"shotgun",name:"Shrine-Breaker",type:"weapon",weight:5.6,desc:"Close-range sermon."},
  vest:{id:"vest",name:"Makeshift Vest",type:"armor",weight:3.5,desc:"+10 Armor."},
  plating:{id:"plating",name:"Scrap Plating",type:"armor",weight:5.0,desc:"+20 Armor."},
  scope:{id:"scope",name:"Improvised Scope",type:"mod",weight:0.4,desc:"Reduces spread."},
  extmag:{id:"extmag",name:"Extended Magazine",type:"mod",weight:0.6,desc:"+50% mag size."},
  vaultKeycard:{id:"vaultKeycard",name:"Vault Keycard",type:"quest",weight:0.1,desc:"Restricted access card for Vault 811."},
};
function invWeight(inv){
  let w=0; for(const it of inv){ const d=ItemDB[it.id]; if(d) w+=d.weight*(it.qty||1); }
  return Math.round(w*10)/10;
}
const WeaponDefs=[
  {id:"pistol",name:"Type-11 Pistol",fireMode:"semi",rpm:380,magSize:12,spread:0.003,damage:22,range:110,recoil:{kick:0.03,ret:9.0}},
  {id:"rifle",name:"Kurokawa Rifle",fireMode:"auto",rpm:720,magSize:30,spread:0.0045,damage:14,range:140,recoil:{kick:0.02,ret:11.5}},
  {id:"shotgun",name:"Shrine-Breaker",fireMode:"semi",rpm:120,magSize:6,pellets:8,spread:0.018,damage:10,range:55,recoil:{kick:0.06,ret:7.0}},
];

// Crafting recipes
const CraftRecipes=[
  {id:"stim",name:"Field Stim",needs:[{id:"scrap",qty:1},{id:"cloth",qty:1}],result:{id:"stim",qty:1}},
  {id:"radaway",name:"Rad-Away",needs:[{id:"scrap",qty:1},{id:"circuits",qty:1}],result:{id:"radaway",qty:1}},
  {id:"vest",name:"Makeshift Vest",needs:[{id:"scrap",qty:3},{id:"cloth",qty:2}],result:{id:"vest",qty:1}},
  {id:"plating",name:"Scrap Plating",needs:[{id:"scrap",qty:5}],result:{id:"plating",qty:1}},
  {id:"scope",name:"Improvised Scope",needs:[{id:"scrap",qty:2},{id:"circuits",qty:1}],result:{id:"scope",qty:1}},
  {id:"extmag",name:"Extended Magazine",needs:[{id:"scrap",qty:3}],result:{id:"extmag",qty:1}},
];

// Skill definitions
const SkillDefs={
  toughness:{name:"Toughness",desc:"+15 HP per level",maxLvl:5},
  quickHands:{name:"Quick Hands",desc:"-10% reload time per level",maxLvl:5},
  scavenger:{name:"Scavenger",desc:"+15% loot find per level",maxLvl:5},
  ironSights:{name:"Iron Sights",desc:"+8% weapon damage per level",maxLvl:5},
  mutantHide:{name:"Mutant Hide",desc:"+5 Armor per level",maxLvl:5},
};

// ---------------- Particles ----------------
class Particles{
  constructor(scene){
    this.scene=scene;
    this.parts=[];
    this.geom=new THREE.SphereGeometry(0.05,6,6);
    this.mat=new THREE.MeshBasicMaterial({color:0xffffff,transparent:true});
    this.casingGeom=new THREE.CylinderGeometry(0.015,0.015,0.05,6);
    this.casingMat=new THREE.MeshStandardMaterial({color:0xd4a843,metalness:0.6,roughness:0.3});
    this.decals=[];
    this.decalGeom=new THREE.PlaneGeometry(0.3,0.3);
    this.decalMat=new THREE.MeshBasicMaterial({color:0x111111,transparent:true,opacity:0.7,depthWrite:false});
  }
  spawn(pos,vel,life=0.35,size=0.05){
    const m=new THREE.Mesh(this.geom,this.mat.clone());
    m.scale.setScalar(size);
    m.position.copy(pos);
    this.scene.add(m);
    this.parts.push({m,vel:vel.clone(),life,max:life,type:"spark"});
  }
  spawnCasing(pos,vel){
    const m=new THREE.Mesh(this.casingGeom,this.casingMat);
    m.position.copy(pos);
    m.rotation.set(Math.random()*Math.PI,Math.random()*Math.PI,Math.random()*Math.PI);
    this.scene.add(m);
    this.parts.push({m,vel:vel.clone(),life:1.2,max:1.2,type:"casing",spin:v3(rand(-8,8),rand(-8,8),rand(-8,8))});
  }
  spawnDecal(pos,normal){
    const m=new THREE.Mesh(this.decalGeom,this.decalMat.clone());
    m.position.copy(pos).addScaledVector(normal,0.02);
    m.lookAt(pos.clone().add(normal));
    m.scale.setScalar(0.3+Math.random()*0.3);
    this.scene.add(m);
    this.decals.push({m,life:8.0});
    if(this.decals.length>50){
      const old=this.decals.shift();
      this.scene.remove(old.m);
      old.m.material.dispose();
    }
  }
  update(dt){
    for(let i=this.parts.length-1;i>=0;i--){
      const p=this.parts[i];
      p.life-=dt;
      p.m.position.addScaledVector(p.vel,dt);
      p.vel.y-=5.5*dt;
      if(p.type==="casing" && p.spin){
        p.m.rotation.x+=p.spin.x*dt;
        p.m.rotation.y+=p.spin.y*dt;
        p.m.rotation.z+=p.spin.z*dt;
        if(p.m.position.y<0.03){p.m.position.y=0.03; p.vel.multiplyScalar(0.3); p.vel.y=Math.abs(p.vel.y)*0.2;}
      }
      if(p.type==="spark") p.m.material.opacity=clamp(p.life/p.max,0,1);
      if(p.life<=0){
        this.scene.remove(p.m);
        if(p.m.material.dispose) p.m.material.dispose();
        this.parts.splice(i,1);
      }
    }
    for(let i=this.decals.length-1;i>=0;i--){
      this.decals[i].life-=dt;
      if(this.decals[i].life<=0){
        const d=this.decals[i];
        this.scene.remove(d.m);
        d.m.material.dispose();
        this.decals.splice(i,1);
      }else if(this.decals[i].life<2.0){
        this.decals[i].m.material.opacity=this.decals[i].life/2.0;
      }
    }
  }
}

// ---------------- World streaming ----------------
class World{
  constructor(scene, seed=811){
    this.scene=scene; this.seed=seed;
    this.tileSize=90; this.radius=1;
    this.tiles=new Map();
    this.static=new THREE.Group();
    this.interact=new THREE.Group();
    this.enemies=new THREE.Group();
    scene.add(this.static,this.interact,this.enemies);

    this.matGround=new THREE.MeshStandardMaterial({color:0x22262c,roughness:1});
    this.matAsphalt=new THREE.MeshStandardMaterial({color:0x1b1d21,roughness:1});
    this.matConcrete=new THREE.MeshStandardMaterial({color:0x2b2f36,roughness:0.95});
    this.matRust=new THREE.MeshStandardMaterial({color:0x5d3b2a,roughness:1,metalness:0.05});
    this.matWood=new THREE.MeshStandardMaterial({color:0x3a2e22,roughness:0.9});
    this.matNeon=new THREE.MeshStandardMaterial({color:0x3bd0ff,emissive:0x3bd0ff,emissiveIntensity:0.8,roughness:0.4});
    this.grassGeom=new THREE.ConeGeometry(0.18,0.8,5);
    this.grassMat=new THREE.MeshStandardMaterial({color:0x2a4a36,roughness:1});
    this.rockGeom=new THREE.DodecahedronGeometry(0.6,0);
    this.rockMat=new THREE.MeshStandardMaterial({color:0x2a2e35,roughness:1});
    this.matRail=new THREE.MeshStandardMaterial({color:0x4a3a2a,roughness:0.8,metalness:0.3});
    this.matShrine=new THREE.MeshStandardMaterial({color:0x3d1a1a,roughness:0.85});
  }
  key(tx,tz){return `${tx},${tz}`;}
  biome(tx,tz){
    const a=Math.abs(tx)+Math.abs(tz);
    if(a<=1) return 0; // city near center
    if(tx<-1) return 2; // coast/industrial west
    if(tz>1) return 1; // forest north
    return (tx+tz)%2===0?0:1;
  }
  fogForBiome(biome){
    if(biome===0) return {near:20,far:240,color:new THREE.Color(0x0a1018)};
    if(biome===1) return {near:12,far:180,color:new THREE.Color(0x0a1510)};
    if(biome===2) return {near:10,far:160,color:new THREE.Color(0x101418)};
    return {near:18,far:220,color:new THREE.Color(0x0c1018)};
  }
  update(pos){
    const tx=Math.floor(pos.x/this.tileSize);
    const tz=Math.floor(pos.z/this.tileSize);
    const needed=new Set();
    for(let x=tx-this.radius;x<=tx+this.radius;x++){
      for(let z=tz-this.radius;z<=tz+this.radius;z++){
        const k=this.key(x,z); needed.add(k);
        if(!this.tiles.has(k)) this.createTile(x,z);
      }
    }
    for(const k of Array.from(this.tiles.keys())){
      if(!needed.has(k)) this.disposeTile(k);
    }
  }
  createTile(tx,tz){
    const k=this.key(tx,tz);
    const biome=this.biome(tx,tz);
    const rng=mulberry32((this.seed*73856093) ^ (tx*19349663) ^ (tz*83492791));
    const g=new THREE.Group();
    g.position.set(tx*this.tileSize,0,tz*this.tileSize);

    const ground=new THREE.Mesh(new THREE.PlaneGeometry(this.tileSize,this.tileSize), biome===0?this.matAsphalt:this.matGround);
    ground.rotation.x=-Math.PI/2; ground.receiveShadow=true;
    g.add(ground);

    if(biome===0||biome===2){
      const road=new THREE.Mesh(new THREE.PlaneGeometry(this.tileSize*0.35,this.tileSize), this.matAsphalt);
      road.rotation.x=-Math.PI/2; road.position.y=0.01; road.receiveShadow=true;
      g.add(road);
    } else {
      const path=new THREE.Mesh(new THREE.PlaneGeometry(this.tileSize*0.24,this.tileSize), this.matConcrete);
      path.rotation.x=-Math.PI/2; path.position.y=0.01; path.receiveShadow=true;
      g.add(path);
    }

    // instanced grass
    const grassCount=biome===0?80:180;
    const instGrass=new THREE.InstancedMesh(this.grassGeom,this.grassMat,grassCount);
    const dummy=new THREE.Object3D();
    for(let i=0;i<grassCount;i++){
      const px=(rng()-0.5)*this.tileSize;
      const pz=(rng()-0.5)*this.tileSize;
      const edge=Math.abs(px)>this.tileSize*0.18 && Math.abs(pz)>this.tileSize*0.18;
      dummy.position.set(px, biome===0 && !edge ? -999 : 0.0, pz);
      dummy.rotation.y=rng()*Math.PI*2;
      const s=0.75+rng()*0.9;
      dummy.scale.set(s,s,s);
      dummy.updateMatrix();
      instGrass.setMatrixAt(i,dummy.matrix);
    }
    instGrass.position.y=0.02;
    instGrass.receiveShadow=true;
    g.add(instGrass);

    // rocks
    const rockCount=biome===2?18:12;
    const instRocks=new THREE.InstancedMesh(this.rockGeom,this.rockMat,rockCount);
    for(let i=0;i<rockCount;i++){
      const px=(rng()-0.5)*this.tileSize;
      const pz=(rng()-0.5)*this.tileSize;
      dummy.position.set(px,0.35,pz);
      dummy.rotation.set(rng()*0.2,rng()*Math.PI*2,rng()*0.2);
      const s=0.6+rng()*1.2;
      dummy.scale.set(s,s,s);
      dummy.updateMatrix();
      instRocks.setMatrixAt(i,dummy.matrix);
    }
    instRocks.castShadow=true; instRocks.receiveShadow=true;
    g.add(instRocks);

    // City buildings with height variation (biome 0)
    if(biome===0){
      const numBuildings=2+Math.floor(rng()*3);
      for(let i=0;i<numBuildings;i++){
        const bw=4+rng()*6;
        const bh=3+rng()*12;
        const bd=4+rng()*6;
        const bx=(rng()-0.5)*this.tileSize*0.65;
        const bz=(rng()-0.5)*this.tileSize*0.65;
        if(Math.abs(bx)<this.tileSize*0.2) continue;
        const building=new THREE.Mesh(new THREE.BoxGeometry(bw,bh,bd),this.matConcrete);
        building.position.set(bx,bh/2,bz);
        building.castShadow=true; building.receiveShadow=true;
        g.add(building);
        // Window glow strips
        if(rng()<0.4){
          const stripe=new THREE.Mesh(new THREE.BoxGeometry(bw*0.8,0.3,0.1),this.matNeon);
          stripe.position.set(bx,bh*0.6,bz+bd/2+0.05);
          g.add(stripe);
        }
      }
    }

    // Destroyed train tracks (biome 2 or random)
    if(biome===2 || (biome===0 && rng()<0.25)){
      g.add(this.makeTrainTracks(rng));
    }

    // POI
    if(rng()<0.35){
      let poi;
      if(biome===1){
        const variant=rng();
        if(variant<0.33) poi=this.makeTorii(rng);
        else if(variant<0.66) poi=this.makeShrine(rng);
        else poi=this.makeStoneLantern(rng);
      }else if(biome===0){
        poi=this.makeStation(rng);
      }else{
        poi=this.makeIndustrial(rng);
      }
      g.add(poi);
    }

    // interactables
    const interactables=[];
    const numCrates=rng()<0.85?(biome===0?2:1):0;
    for(let i=0;i<numCrates;i++){
      const c=this.makeCrate(rng,biome);
      c.position.set((rng()-0.5)*this.tileSize*0.7,0.5,(rng()-0.5)*this.tileSize*0.7);
      g.add(c);
      this.interact.add(c);
      interactables.push(c);
    }

    // enemies (not center tile)
    const enemies=[];
    const isCenter=tx===0&&tz===0;
    if(!isCenter){
      const n=rng()<0.7?Math.floor(1+rng()*(biome===0?3:2)):0;
      for(let i=0;i<n;i++){
        const kind=rng()<0.55?"crawler":"stalker";
        const e=this.makeEnemy(kind);
        e.position.set((rng()-0.5)*this.tileSize*0.75,0,(rng()-0.5)*this.tileSize*0.75);
        g.add(e);
        this.enemies.add(e);
        enemies.push(e);
      }
    }

    this.tiles.set(k,{g,tx,tz,biome,interactables,enemies});
    this.static.add(g);
  }
  disposeTile(k){
    const t=this.tiles.get(k); if(!t) return;
    for(const c of t.interactables) this.interact.remove(c);
    for(const e of t.enemies) this.enemies.remove(e);
    this.static.remove(t.g);
    this.tiles.delete(k);
  }
  makeCrate(rng,biome){
    const m=new THREE.Mesh(new THREE.BoxGeometry(1.1,1.0,1.1), biome===0?this.matRust:this.matWood);
    m.userData={interact:true,kind:"container",opened:false,name:biome===0?"Locker":"Crate"};
    m.castShadow=true; m.receiveShadow=true;
    return m;
  }
  makeTorii(rng){
    const g=new THREE.Group(); g.userData.poi="Silent Torii";
    const mat=new THREE.MeshStandardMaterial({color:0x2d0d0d,roughness:0.9});
    const post=new THREE.Mesh(new THREE.BoxGeometry(0.7,5.0,0.7),mat);
    const post2=post.clone();
    post.position.set(-2,2.5,0); post2.position.set(2,2.5,0);
    const beam=new THREE.Mesh(new THREE.BoxGeometry(5.6,0.6,1.0),mat); beam.position.set(0,5.3,0);
    const beam2=new THREE.Mesh(new THREE.BoxGeometry(4.8,0.5,0.9),mat); beam2.position.set(0,4.6,0);
    const lan=new THREE.Mesh(new THREE.CylinderGeometry(0.25,0.35,0.8,10),this.matRust); lan.position.set(0,0.45,1.2);
    g.add(post,post2,beam,beam2,lan);
    g.position.set((rng()-0.5)*20,0,(rng()-0.5)*20);
    g.rotation.y=rng()*Math.PI*2;
    g.traverse(o=>{if(o.isMesh) o.castShadow=true;});
    return g;
  }
  makeStation(rng){
    const g=new THREE.Group(); g.userData.poi="Collapsed Rail Station";
    const base=new THREE.Mesh(new THREE.BoxGeometry(14,2.2,10),this.matConcrete); base.position.y=1.1;
    const roof=new THREE.Mesh(new THREE.BoxGeometry(14,0.8,10),this.matConcrete); roof.position.y=3.2; roof.rotation.z=(rng()-0.5)*0.35;
    const neon=new THREE.Mesh(new THREE.BoxGeometry(5.5,0.4,0.3),this.matNeon); neon.position.set(0,2.5,5.2);
    g.add(base,roof,neon);
    g.position.set((rng()-0.5)*18,0,(rng()-0.5)*18);
    g.rotation.y=rng()*Math.PI*2;
    g.traverse(o=>{if(o.isMesh) o.castShadow=true;});
    return g;
  }
  makeIndustrial(rng){
    const g=new THREE.Group(); g.userData.poi="Coastal Works";
    for(let i=0;i<3;i++){
      const s=new THREE.Mesh(new THREE.CylinderGeometry(1,1.2,8+rng()*5,12),this.matRust);
      s.position.set(-4+i*4,4,-1+rng()*2);
      s.castShadow=true;
      g.add(s);
    }
    const box=new THREE.Mesh(new THREE.BoxGeometry(10,3.2,6),this.matConcrete); box.position.set(0,1.6,3); box.castShadow=true;
    g.add(box);
    g.position.set((rng()-0.5)*18,0,(rng()-0.5)*18);
    g.rotation.y=rng()*Math.PI*2;
    return g;
  }
  makeTrainTracks(rng){
    const g=new THREE.Group(); g.userData.poi="Destroyed Railway";
    const trackLen=this.tileSize*0.8;
    // Rails
    for(let side=-1;side<=1;side+=2){
      const rail=new THREE.Mesh(new THREE.BoxGeometry(0.08,0.1,trackLen),this.matRail);
      rail.position.set(side*0.6,0.15,0);
      rail.castShadow=true;
      g.add(rail);
    }
    // Ties (wooden sleepers)
    const numTies=Math.floor(trackLen/1.5);
    for(let i=0;i<numTies;i++){
      const tie=new THREE.Mesh(new THREE.BoxGeometry(1.8,0.1,0.2),this.matWood);
      tie.position.set(0,0.06,-trackLen/2+i*1.5+(rng()-0.5)*0.3);
      tie.rotation.y=(rng()-0.5)*0.08;
      if(rng()<0.15) tie.position.y=-0.5;
      g.add(tie);
    }
    // Derailed cart
    if(rng()<0.6){
      const cart=new THREE.Mesh(new THREE.BoxGeometry(3,2,6),this.matRust);
      cart.position.set(2+rng()*2,1.2,(rng()-0.5)*trackLen*0.4);
      cart.rotation.z=(rng()-0.5)*0.4;
      cart.rotation.y=(rng()-0.5)*0.3;
      cart.castShadow=true;
      g.add(cart);
    }
    g.position.set((rng()-0.5)*10,0,0);
    g.rotation.y=rng()<0.5?0:Math.PI/2;
    return g;
  }
  makeShrine(rng){
    const g=new THREE.Group(); g.userData.poi="Abandoned Shrine";
    // Platform
    const platform=new THREE.Mesh(new THREE.BoxGeometry(6,0.4,5),this.matConcrete);
    platform.position.y=0.2; platform.receiveShadow=true;
    g.add(platform);
    // Walls
    const wallBack=new THREE.Mesh(new THREE.BoxGeometry(5.5,3.2,0.3),this.matShrine);
    wallBack.position.set(0,1.8,-2.2); wallBack.castShadow=true;
    g.add(wallBack);
    // Roof
    const roof=new THREE.Mesh(new THREE.BoxGeometry(7,0.3,6),this.matShrine);
    roof.position.set(0,3.6,0); roof.rotation.z=(rng()-0.5)*0.1; roof.castShadow=true;
    g.add(roof);
    // Offering table
    const table=new THREE.Mesh(new THREE.BoxGeometry(1.2,0.7,0.8),this.matWood);
    table.position.set(0,0.75,-1.5); table.castShadow=true;
    g.add(table);
    // Bell
    const bell=new THREE.Mesh(new THREE.SphereGeometry(0.2,10,10),this.matRust);
    bell.position.set(0,3.1,1.5); g.add(bell);
    const rope=new THREE.Mesh(new THREE.CylinderGeometry(0.03,0.03,1.2,6),this.matWood);
    rope.position.set(0,2.4,1.5); g.add(rope);
    g.position.set((rng()-0.5)*20,0,(rng()-0.5)*20);
    g.rotation.y=rng()*Math.PI*2;
    g.traverse(o=>{if(o.isMesh) o.castShadow=true;});
    return g;
  }
  makeStoneLantern(rng){
    const g=new THREE.Group(); g.userData.poi="Stone Lantern Path";
    const mat=new THREE.MeshStandardMaterial({color:0x4a4a4a,roughness:0.95});
    const glowMat=new THREE.MeshStandardMaterial({color:0xffaa44,emissive:0xffaa44,emissiveIntensity:0.4,roughness:0.6});
    for(let i=0;i<4;i++){
      const side=i%2===0?-1:1;
      const z=-6+Math.floor(i/2)*12;
      const lantern=new THREE.Group();
      const base=new THREE.Mesh(new THREE.BoxGeometry(0.6,0.3,0.6),mat); base.position.y=0.15;
      const post=new THREE.Mesh(new THREE.CylinderGeometry(0.12,0.15,1.5,8),mat); post.position.y=1.0;
      const lamp=new THREE.Mesh(new THREE.BoxGeometry(0.5,0.4,0.5),mat); lamp.position.y=1.95;
      const glow=new THREE.Mesh(new THREE.BoxGeometry(0.35,0.25,0.35),glowMat); glow.position.y=1.95;
      const cap=new THREE.Mesh(new THREE.ConeGeometry(0.4,0.35,4),mat); cap.position.y=2.35; cap.rotation.y=Math.PI/4;
      lantern.add(base,post,lamp,glow,cap);
      lantern.position.set(side*3,0,z);
      if(rng()<0.2) lantern.rotation.z=(rng()-0.5)*0.4;
      g.add(lantern);
    }
    g.position.set((rng()-0.5)*20,0,(rng()-0.5)*20);
    g.rotation.y=rng()*Math.PI*2;
    g.traverse(o=>{if(o.isMesh) o.castShadow=true;});
    return g;
  }
  makeEnemy(kind){
    const g=new THREE.Group();
    const bodyMat=new THREE.MeshStandardMaterial({color:kind==="crawler"?0x5c7a6d:0x6b5a7b,roughness:1});
    const glowMat=new THREE.MeshStandardMaterial({color:0x2aff9e,emissive:0x2aff9e,emissiveIntensity:0.55,roughness:0.6});
    const core=new THREE.Mesh(new THREE.SphereGeometry(kind==="crawler"?0.55:0.6,14,14),bodyMat); core.position.y=0.85;
    const limb=new THREE.Mesh(new THREE.CylinderGeometry(0.12,0.18,0.9,10),bodyMat);
    for(let i=0;i<4;i++){
      const l=limb.clone();
      l.position.set((i<2?-1:1)*0.45,0.45,(i%2?-1:1)*0.35);
      l.rotation.z=(i<2?1:-1)*0.5;
      g.add(l);
    }
    const glow=new THREE.Mesh(new THREE.SphereGeometry(0.16,10,10),glowMat); glow.position.set(0.2,0.95,0.45);
    g.add(core,glow);
    if(kind==="stalker"){
      const sac=new THREE.Mesh(new THREE.SphereGeometry(0.22,12,12),glowMat); sac.position.set(-0.25,0.8,-0.35); g.add(sac);
    }
    g.userData={
      enemy:true, kind,
      name: kind==="crawler"?"Mutated Crawler":"Radioactive Stalker",
      hp: kind==="crawler"?65:85, hpMax: kind==="crawler"?65:85,
      speed: kind==="crawler"?4.2:3.6,
      dmg: kind==="crawler"?14:10,
      aggro:0, state:"wander", wanderT:0, wanderDir:v3(1,0,0),
      atkCd:0, spitCd:0, lootDone:false, lastSeen:0
    };
    g.traverse(o=>{if(o.isMesh) o.castShadow=true;});
    return g;
  }
}

// ---------------- Vault interior ----------------
class Vault{
  constructor(scene){
    this.scene=scene;
    this.group=new THREE.Group(); scene.add(this.group);
    this.matWall=new THREE.MeshStandardMaterial({color:0x1c2230,roughness:0.85});
    this.matFloor=new THREE.MeshStandardMaterial({color:0x12151c,roughness:1});
    this.matDoor=new THREE.MeshStandardMaterial({color:0x2c394f,roughness:0.65,metalness:0.15});
    this.matLight=new THREE.MeshStandardMaterial({color:0x9bd3ff,emissive:0x9bd3ff,emissiveIntensity:0.8});
    this.build();
  }
  build(){
    const floor=new THREE.Mesh(new THREE.PlaneGeometry(36,28),this.matFloor);
    floor.rotation.x=-Math.PI/2; floor.receiveShadow=true;
    this.group.add(floor);

    const wallGeom=new THREE.BoxGeometry(36,8,1.2);
    const back=new THREE.Mesh(wallGeom,this.matWall); back.position.set(0,4,-14);
    const front=new THREE.Mesh(wallGeom,this.matWall); front.position.set(0,4,14);
    const sideGeom=new THREE.BoxGeometry(1.2,8,28);
    const left=new THREE.Mesh(sideGeom,this.matWall); left.position.set(-18,4,0);
    const right=new THREE.Mesh(sideGeom,this.matWall); right.position.set(18,4,0);
    for(const w of [back,front,left,right]){w.castShadow=true; w.receiveShadow=true; this.group.add(w);}

    const ceil=new THREE.Mesh(new THREE.PlaneGeometry(36,28),this.matWall);
    ceil.rotation.x=Math.PI/2; ceil.position.y=8; this.group.add(ceil);

    const doorFrame=new THREE.Mesh(new THREE.BoxGeometry(10,7,1.4),this.matDoor); doorFrame.position.set(0,3.5,13.3); doorFrame.castShadow=true;
    this.group.add(doorFrame);

    const door=new THREE.Mesh(new THREE.CylinderGeometry(3,3,0.9,20),this.matDoor);
    door.rotation.x=Math.PI/2; door.position.set(0,3.5,12.5);
    door.userData={interact:true,kind:"vaultDoor",name:"Vault 811 Door"};
    door.castShadow=true;
    this.door=door;
    this.group.add(door);

    const console=new THREE.Mesh(new THREE.BoxGeometry(2.2,1.2,1.0),this.matDoor);
    console.position.set(-10,0.6,9);
    console.userData={interact:true,kind:"terminal",name:"Terminal"};
    console.castShadow=true;
    this.group.add(console);

    const locker=new THREE.Mesh(new THREE.BoxGeometry(1.2,2.8,1.0),this.matDoor);
    locker.position.set(12,1.4,4);
    locker.userData={interact:true,kind:"container",opened:false,name:"Armory Locker"};
    locker.castShadow=true;
    this.group.add(locker);

    for(let i=-2;i<=2;i++){
      const l=new THREE.Mesh(new THREE.BoxGeometry(1.6,0.2,0.6),this.matLight);
      l.position.set(i*6,7.7,0);
      this.group.add(l);
    }
  }
  setVisible(v){this.group.visible=v;}
}

// ---------------- Player ----------------
class Player{
  constructor(camera){
    this.camera=camera;
    this.pos=v3(0,1.6,6);
    this.vel=v3();
    this.yaw=Math.PI;
    this.pitch=0;
    this.hp=100; this.hpMax=100;
    this.stamina=100; this.staminaMax=100;
    this.crouch=0;
    this.onGround=true;
    this.camMode="fp"; // fp/tp
    this.equipped=0;
    this.weapon=WeaponDefs[this.equipped];
    this.mag={pistol:12,rifle:30,shotgun:6};
    this.reserve={pistol:48,rifle:120,shotgun:24};
    this.reloading=0;
    this.fireCd=0;
    this.recoilKick=0;
    this.camYaw=this.yaw; this.camPitch=this.pitch;
    this.inv=[{id:"stim",qty:1},{id:"ration",qty:1},{id:"scrap",qty:2},{id:"pistol",qty:1},{id:"rifle",qty:1},{id:"shotgun",qty:1}];
    this.maxWeight=55;
    this.inVault=true;
    this.stepT=0;

    // Deep systems
    this.radiation=0; this.radiationMax=100;
    this.armor=0;
    this.xp=0; this.level=1; this.skillPoints=0;
    this.skills={toughness:0,quickHands:0,scavenger:0,ironSights:0,mutantHide:0};

    // Third-person model
    this.model=this._buildModel();
    this.model.visible=false;

    // First-person weapon view model
    this.fpWeapon=this._buildFPWeapon();
    this.camera.add(this.fpWeapon);
    this._updateFPWeapon();

    // Muzzle flash
    this.muzzleFlash=this._buildMuzzleFlash();
    this.fpWeapon.add(this.muzzleFlash);
    this.muzzleFlashTimer=0;

    // Weapon bob/recoil animation state
    this.weaponBob=0;
    this.weaponKick=0;
    this.weaponKickReturn=0;

    // Pip-Boy (first-person arm + device attached to camera)
    this.fpPipboy=this._buildFPPipboy();
    this.camera.add(this.fpPipboy);
    this.pipboyAnim=0; // 0 = stowed, 1 = fully raised
    this.pipboyActive=false;

    // ADS (aim-down-sights) state
    this.aiming=false;
    this.adsAnim=0; // 0 = hip, 1 = fully aimed

    // Third-person weapon model — parented to right arm pivot
    this.tpWeapon=this._buildTPWeapon();
    this._armRPivot.add(this.tpWeapon);
  }
  _buildModel(){
    const g=new THREE.Group();
    const bodyMat=new THREE.MeshStandardMaterial({color:0x3a4a5a,roughness:0.85});
    const skinMat=new THREE.MeshStandardMaterial({color:0xc49a6c,roughness:0.9});
    const torso=new THREE.Mesh(new THREE.BoxGeometry(0.6,0.75,0.35),bodyMat);
    torso.position.y=1.2; torso.castShadow=true;
    const head=new THREE.Mesh(new THREE.SphereGeometry(0.2,12,12),skinMat);
    head.position.y=1.75; head.castShadow=true;
    const legL=new THREE.Mesh(new THREE.BoxGeometry(0.2,0.7,0.25),bodyMat);
    legL.position.set(-0.15,0.45,0); legL.castShadow=true;
    const legR=legL.clone(); legR.position.x=0.15;
    // Arm pivots at shoulder joints for aiming animation
    const armLPivot=new THREE.Group();
    armLPivot.position.set(-0.42,1.45,0);
    const armL=new THREE.Mesh(new THREE.BoxGeometry(0.18,0.6,0.22),bodyMat);
    armL.position.set(0,-0.3,0); armL.castShadow=true;
    armLPivot.add(armL);
    const armRPivot=new THREE.Group();
    armRPivot.position.set(0.42,1.45,0);
    const armR=new THREE.Mesh(new THREE.BoxGeometry(0.18,0.6,0.22),bodyMat);
    armR.position.set(0,-0.3,0); armR.castShadow=true;
    armRPivot.add(armR);
    // Pip-Boy on left forearm (third-person) — parented to arm pivot
    const pbMat=new THREE.MeshStandardMaterial({color:0x1a1a1a,roughness:0.5,metalness:0.6});
    const pbBody=new THREE.Mesh(new THREE.BoxGeometry(0.16,0.12,0.2),pbMat);
    pbBody.position.set(0,-0.5,0.04); pbBody.castShadow=true;
    armLPivot.add(pbBody);
    const pbScreen=new THREE.Mesh(new THREE.PlaneGeometry(0.12,0.08),new THREE.MeshStandardMaterial({color:0x115511,emissive:0x22cc44,emissiveIntensity:0.5,roughness:0.3}));
    pbScreen.position.set(0,-0.492,0.145); pbScreen.castShadow=false;
    armLPivot.add(pbScreen);
    const pbGlow=new THREE.PointLight(0x33ff66,0.3,1.5,2);
    pbGlow.position.set(0,-0.45,0.15);
    armLPivot.add(pbGlow);
    this._armLPivot=armLPivot;
    this._armRPivot=armRPivot;
    g.add(torso,head,legL,legR,armLPivot,armRPivot);
    return g;
  }
  _buildFPWeapon(){
    const g=new THREE.Group();
    const metalMat=new THREE.MeshStandardMaterial({color:0x2a2a2a,roughness:0.6,metalness:0.4,polygonOffset:true,polygonOffsetFactor:-1});
    const gripMat=new THREE.MeshStandardMaterial({color:0x3a2e22,roughness:0.9});
    // barrel
    const barrel=new THREE.Mesh(new THREE.BoxGeometry(0.04,0.04,0.5),metalMat);
    barrel.position.set(0,0.005,0.2); barrel.castShadow=true; // Y offset prevents z-fighting with body mesh
    // body
    const bodyMat=new THREE.MeshStandardMaterial({color:0x2a2a2a,roughness:0.6,metalness:0.4,polygonOffset:true,polygonOffsetFactor:1});
    const body=new THREE.Mesh(new THREE.BoxGeometry(0.06,0.08,0.28),bodyMat);
    body.position.set(0,-0.01,0); body.castShadow=true;
    // grip
    const grip=new THREE.Mesh(new THREE.BoxGeometry(0.04,0.12,0.06),gripMat);
    grip.position.set(0,-0.09,-0.04); grip.rotation.x=0.25; grip.castShadow=true;
    // hand
    const handMat=new THREE.MeshStandardMaterial({color:0xc49a6c,roughness:0.9});
    const hand=new THREE.Mesh(new THREE.BoxGeometry(0.07,0.06,0.1),handMat);
    hand.position.set(0,-0.06,0.02);
    // iron sight post (small nub on top of barrel end)
    const sightMat=new THREE.MeshStandardMaterial({color:0x1a1a1a,roughness:0.5,metalness:0.5});
    const frontSight=new THREE.Mesh(new THREE.BoxGeometry(0.008,0.02,0.008),sightMat);
    frontSight.position.set(0,0.035,0.44);
    const rearSight=new THREE.Mesh(new THREE.BoxGeometry(0.03,0.015,0.008),sightMat);
    rearSight.position.set(0,0.035,0.05);
    g.add(barrel,body,grip,hand,frontSight,rearSight);
    g.position.set(0.28,-0.24,-0.4);
    g.rotation.y=0;
    return g;
  }
  _buildTPWeapon(){
    const g=new THREE.Group();
    const metalMat=new THREE.MeshStandardMaterial({color:0x2a2a2a,roughness:0.6,metalness:0.4});
    const barrel=new THREE.Mesh(new THREE.BoxGeometry(0.03,0.03,0.35),metalMat);
    barrel.position.set(0,0,0.15); barrel.castShadow=true;
    const body=new THREE.Mesh(new THREE.BoxGeometry(0.045,0.06,0.2),metalMat);
    body.position.set(0,-0.008,0); body.castShadow=true;
    const gripMat=new THREE.MeshStandardMaterial({color:0x3a2e22,roughness:0.9});
    const grip=new THREE.Mesh(new THREE.BoxGeometry(0.03,0.08,0.04),gripMat);
    grip.position.set(0,-0.06,-0.03); grip.rotation.x=0.25; grip.castShadow=true;
    g.add(barrel,body,grip);
    // Position relative to right arm pivot
    g.position.set(0,-0.45,0.18);
    g.rotation.x=-0.15;
    return g;
  }
  _buildMuzzleFlash(){
    const g=new THREE.Group();
    const flashMat=new THREE.MeshBasicMaterial({color:0xffdd44,transparent:true,opacity:0.9});
    const flash=new THREE.Mesh(new THREE.SphereGeometry(0.06,8,8),flashMat);
    flash.position.set(0,0,0.48);
    const flareMat=new THREE.MeshBasicMaterial({color:0xff8800,transparent:true,opacity:0.7});
    const flare=new THREE.Mesh(new THREE.PlaneGeometry(0.14,0.14),flareMat);
    flare.position.set(0,0,0.5);
    const flare2=flare.clone(); flare2.rotation.z=Math.PI/4;
    g.add(flash,flare,flare2);
    g.visible=false;
    return g;
  }
  _buildFPPipboy(){
    const g=new THREE.Group();
    const skinMat=new THREE.MeshStandardMaterial({color:0xc49a6c,roughness:0.9});
    // Left forearm
    const arm=new THREE.Mesh(new THREE.BoxGeometry(0.09,0.22,0.11),skinMat);
    arm.position.set(0,0,0);
    // Pip-Boy device body
    const pbMat=new THREE.MeshStandardMaterial({color:0x1a1a1a,roughness:0.4,metalness:0.65});
    const pbBody=new THREE.Mesh(new THREE.BoxGeometry(0.14,0.10,0.17),pbMat);
    pbBody.position.set(0,0.06,0);
    // Pip-Boy screen
    const screenMat=new THREE.MeshStandardMaterial({color:0x0a2a0a,emissive:0x22cc44,emissiveIntensity:0.45,roughness:0.2});
    const pbScreen=new THREE.Mesh(new THREE.PlaneGeometry(0.11,0.065),screenMat);
    pbScreen.position.set(0,0.112,0);
    pbScreen.rotation.x=-Math.PI/2;
    // Subtle green glow
    const pbGlow=new THREE.PointLight(0x33ff66,0.25,1.2,2);
    pbGlow.position.set(0,0.13,0);
    g.add(arm,pbBody,pbScreen,pbGlow);
    // Stowed position (below and off-screen to the left)
    g.position.set(-0.35,-0.55,-0.35);
    g.rotation.set(0.2,0.3,0);
    g.visible=true;
    return g;
  }
  weight(){return invWeight(this.inv);}
  setWeapon(i){
    this.equipped=clamp(i,0,WeaponDefs.length-1);
    this.weapon=WeaponDefs[this.equipped];
    this._updateFPWeapon();
  }
  _updateFPWeapon(){
    if(!this.fpWeapon) return;
    const id=this.weapon.id;
    const barrel=this.fpWeapon.children[0];
    const body=this.fpWeapon.children[1];
    if(id==="pistol"){
      barrel.scale.set(1,1,0.7); body.scale.set(1,1,0.8);
      this._fpBasePos={x:0.28,y:-0.24,z:-0.4};
      this._fpAdsPos={x:0.0,y:-0.16,z:-0.35};
    }else if(id==="rifle"){
      barrel.scale.set(1,1,1.4); body.scale.set(1.1,1.1,1.3);
      this._fpBasePos={x:0.25,y:-0.22,z:-0.38};
      this._fpAdsPos={x:0.0,y:-0.15,z:-0.32};
    }else{
      barrel.scale.set(1.3,1.3,1.0); body.scale.set(1.4,1.2,1.0);
      this._fpBasePos={x:0.26,y:-0.22,z:-0.36};
      this._fpAdsPos={x:0.0,y:-0.15,z:-0.30};
    }
    this.fpWeapon.position.set(this._fpBasePos.x,this._fpBasePos.y,this._fpBasePos.z);
    // Update TP weapon scale
    if(this.tpWeapon){
      const tpBarrel=this.tpWeapon.children[0];
      const tpBody=this.tpWeapon.children[1];
      if(id==="pistol"){
        tpBarrel.scale.set(1,1,0.7); tpBody.scale.set(1,1,0.8);
      }else if(id==="rifle"){
        tpBarrel.scale.set(1,1,1.4); tpBody.scale.set(1.1,1.1,1.3);
      }else{
        tpBarrel.scale.set(1.3,1.3,1.0); tpBody.scale.set(1.4,1.2,1.0);
      }
    }
  }
  toSave(){
    return {pos:{x:this.pos.x,y:this.pos.y,z:this.pos.z},yaw:this.yaw,pitch:this.pitch,hp:this.hp,stamina:this.stamina,inVault:this.inVault,
      equipped:this.equipped,ammo:{...this.reserve},mags:{...this.mag},inv:JSON.parse(JSON.stringify(this.inv)),maxWeight:this.maxWeight,
      radiation:this.radiation,armor:this.armor,xp:this.xp,level:this.level,skillPoints:this.skillPoints,skills:{...this.skills}};
  }
  fromSave(s){
    this.pos.set(s.pos.x,s.pos.y,s.pos.z);
    this.yaw=s.yaw; this.pitch=s.pitch;
    this.hp=s.hp; this.stamina=s.stamina;
    this.inVault=s.inVault;
    this.equipped=s.equipped||0; this.setWeapon(this.equipped);
    this.reserve={...s.ammo}; this.mag={...s.mags};
    this.inv=Array.isArray(s.inv)?s.inv:[];
    this.maxWeight=s.maxWeight||55;
    this.radiation=s.radiation||0;
    this.armor=s.armor||0;
    this.xp=s.xp||0;
    this.level=s.level||1;
    this.skillPoints=s.skillPoints||0;
    if(s.skills) this.skills={...this.skills,...s.skills};
  }
  update(dt,input,env){
    const {dx,dy}=input.consumeMouse();
    this.yaw-=dx*input.mouse.sens;
    this.pitch-=dy*input.mouse.sens;
    this.pitch=clamp(this.pitch,-1.25,1.25);

    const targetC=(input.down("ControlLeft")||input.down("ControlRight"))?1:0;
    this.crouch=lerp(this.crouch,targetC,10*dt);

    const f=v3(-Math.sin(this.yaw),0,-Math.cos(this.yaw));
    const r=v3(Math.cos(this.yaw),0,-Math.sin(this.yaw));
    let move=v3();
    if(input.down("KeyW")) move.add(f);
    if(input.down("KeyS")) move.sub(f);
    if(input.down("KeyD")) move.add(r);
    if(input.down("KeyA")) move.sub(r);
    if(move.lengthSq()>0) move.normalize();

    let speed=this.inVault?5.0:5.4;
    const sprint=input.down("ShiftLeft") && this.stamina>5 && move.lengthSq()>0;
    if(sprint) speed*=1.6;
    speed*=(1.0-this.crouch*0.35);

    if(sprint) this.stamina=Math.max(0,this.stamina-28*dt);
    else this.stamina=Math.min(this.staminaMax,this.stamina+18*dt);

    if(input.pressed("Space") && this.onGround && this.stamina>8){
      this.vel.y=7.0; this.onGround=false;
      this.stamina=Math.max(0,this.stamina-10);
    }

    const accel=this.onGround?28:12;
    const desired=move.multiplyScalar(speed);
    this.vel.x=lerp(this.vel.x,desired.x,accel*dt);
    this.vel.z=lerp(this.vel.z,desired.z,accel*dt);
    this.vel.y-=18.5*dt;
    this.pos.addScaledVector(this.vel,dt);

    const minY=1.6-this.crouch*0.55;
    if(this.pos.y<minY){ this.pos.y=minY; this.vel.y=0; this.onGround=true; }

    if(this.inVault){
      this.pos.x=clamp(this.pos.x,-16.2,16.2);
      this.pos.z=clamp(this.pos.z,-12.5,12.5);
    }

    const planar=Math.hypot(this.vel.x,this.vel.z);
    if(this.onGround && planar>0.5){
      this.stepT+=dt*(sprint?1.8:1.2)*(1-this.crouch*0.2);
      if(this.stepT>0.42){ this.stepT=0; env.audio.foot(this.inVault?0:1); }
    }

    if(this.reloading>0){
      this.reloading-=dt;
      if(this.reloading<=0){
        const id=this.weapon.id;
        const need=this.getModdedMagSize()-this.mag[id];
        const take=Math.min(need,this.reserve[id]);
        this.mag[id]+=take; this.reserve[id]-=take;
      }
    }

    this.fireCd=Math.max(0,this.fireCd-dt);
    this.recoilKick=lerp(this.recoilKick,0,this.weapon.recoil.ret*dt);

    // Weapon animation
    this.weaponKick=lerp(this.weaponKick,0,12*dt);
    if(planar>0.5 && this.onGround){
      this.weaponBob+=dt*(sprint?8.5:5.5);
    }

    // Muzzle flash timer
    if(this.muzzleFlashTimer>0){
      this.muzzleFlashTimer-=dt;
      if(this.muzzleFlashTimer<=0) this.muzzleFlash.visible=false;
    }

    // Radiation outside vault
    if(!this.inVault){
      this.radiation=Math.min(this.radiationMax,this.radiation+1.2*dt);
      if(this.radiation>60) this.hp=Math.max(0,this.hp-4*dt);
    }else{
      this.radiation=Math.max(0,this.radiation-3*dt);
    }

    // ADS (aim-down-sights) — smooth in, instant out
    const wantAim=env.input?env.input.mouseDown(2):false;
    if(wantAim && this.reloading<=0 && !this.pipboyActive){
      this.aiming=true;
      this.adsAnim=lerp(this.adsAnim,1,12*dt);
    }else{
      this.aiming=false;
      this.adsAnim=0; // instant release
    }

    this.updateCamera(dt,env);
    this.updateModels(dt);
  }
  updateModels(dt){
    // Third-person model visibility & position
    this.model.visible=(this.camMode==="tp");
    this.model.position.copy(this.pos);
    this.model.position.y-=1.6;
    this.model.rotation.y=this.yaw+Math.PI;

    // Third-person weapon visibility
    if(this.tpWeapon) this.tpWeapon.visible=(this.camMode==="tp");

    // Arm aiming animation — rotate arm pivots forward when aiming
    if(this._armRPivot && this._armLPivot){
      const aimRot=-this.adsAnim*1.2; // swing arms forward ~69° when fully aimed
      this._armRPivot.rotation.x=aimRot;
      this._armLPivot.rotation.x=aimRot;
    }

    // Pip-Boy animation lerp
    const pipTarget=this.pipboyActive?1:0;
    this.pipboyAnim=lerp(this.pipboyAnim,pipTarget,8*dt);

    // First-person weapon visibility & animation
    // Hide weapon when Pip-Boy raise animation is past 30%
    const showWeapon=(this.camMode==="fp")&&(this.pipboyAnim<0.3);
    this.fpWeapon.visible=showWeapon;
    if(this.camMode==="fp"&&this._fpBasePos){
      const bp=this._fpBasePos;
      const ap=this._fpAdsPos||bp;
      const t=this.adsAnim;
      const bobScale=1-t*0.85; // reduce bob when aiming
      const bobX=Math.sin(this.weaponBob)*0.006*bobScale;
      const bobY=Math.cos(this.weaponBob*2)*0.004*bobScale;
      const px=lerp(bp.x,ap.x,t)+bobX;
      const py=lerp(bp.y,ap.y,t)+bobY;
      const pz=lerp(bp.z,ap.z,t)-this.weaponKick*0.06*(1-t*0.5);
      this.fpWeapon.position.set(px,py,pz);
      this.fpWeapon.rotation.x=-this.weaponKick*0.5*(1-t*0.6);
    }

    // First-person Pip-Boy position (lerps from stowed to raised)
    if(this.fpPipboy){
      this.fpPipboy.visible=(this.camMode==="fp");
      const t=this.pipboyAnim;
      // Stowed: off-screen left/below; Raised: centered in front of camera, looking at screen
      const sx=-0.35, sy=-0.55, sz=-0.35;
      const ex=-0.18, ey=-0.28, ez=-0.38;
      this.fpPipboy.position.set(lerp(sx,ex,t),lerp(sy,ey,t),lerp(sz,ez,t));
      this.fpPipboy.rotation.set(lerp(0.2,-0.6,t),lerp(0.3,0.15,t),0);
    }
  }
  updateCamera(dt,env){
    this.camYaw=lerp(this.camYaw,this.yaw,16*dt);
    this.camPitch=lerp(this.camPitch,this.pitch+this.recoilKick,16*dt);
    if(this.camMode==="fp"){
      this.camera.position.copy(this.pos).add(v3(0,0.1,0));
      this.camera.rotation.order="YXZ";
      this.camera.rotation.y=this.camYaw;
      // Smoothly tilt camera down (-0.55 rad ≈ 31°) to view the Pip-Boy on the wrist
      const pipPitch=lerp(0,-0.55,this.pipboyAnim);
      this.camera.rotation.x=this.camPitch+pipPitch;
    }else{
      // Over-the-shoulder third-person camera with pitch support
      const back=v3(Math.sin(this.camYaw),0,Math.cos(this.camYaw));
      const side=v3(Math.cos(this.camYaw),0,-Math.sin(this.camYaw));
      const cam=this.pos.clone();
      const adsT=this.adsAnim;
      const dist=lerp(2.5,1.6,adsT);
      const sideOff=lerp(0.9,0.55,adsT);
      const heightOff=lerp(0.8,0.5,adsT);
      cam.addScaledVector(back,dist);
      cam.addScaledVector(side,sideOff);
      cam.y+=heightOff;
      // Apply pitch to camera offset (look up/down moves camera)
      cam.y-=this.camPitch*dist*0.3;
      cam.y=Math.max(cam.y,0.5);
      this.camera.position.lerp(cam,1-Math.exp(-10*dt));
      // Look at shoulder height with pitch influence
      const lookY=this.pos.y+0.3-this.camPitch*0.5;
      this.camera.lookAt(this.pos.x,lookY,this.pos.z);
    }
    // ADS FOV zoom for third-person
    if(env.fov!==undefined){
      const baseFov=env.fov;
      let targetFov=baseFov;
      if(this.aiming && this.camMode==="tp") targetFov=baseFov*0.85;
      this.camera.fov=lerp(this.camera.fov,targetFov,10*dt);
      this.camera.updateProjectionMatrix();
    }
  }
  getModdedMagSize(){
    const id=this.weapon.id;
    const mods=this._weaponMods?.[id];
    return Math.floor(this.weapon.magSize*(mods?.magMul||1));
  }
  requestReload(env){
    if(this.reloading>0) return;
    const id=this.weapon.id;
    if(this.mag[id]>=this.getModdedMagSize()) return;
    if(this.reserve[id]<=0){ env.audio.click(); return; }
    const baseTime=(id==="shotgun")?1.4:1.1;
    this.reloading=baseTime*(1-this.skills.quickHands*0.10);
    env.audio.reload();
  }
  tryFire(env){
    if(this.reloading>0||this.fireCd>0) return false;
    const id=this.weapon.id;
    if(this.mag[id]<=0){ env.audio.click(); this.fireCd=0.18; return false; }
    this.mag[id]-=1;
    this.fireCd=60/this.weapon.rpm;
    this.recoilKick+=this.weapon.recoil.kick;
    this.weaponKick=id==="shotgun"?0.8:id==="rifle"?0.3:0.45;
    env.audio.gun(id);
    env.shakeKick(id==="shotgun"?0.18:0.09);

    // Muzzle flash
    this.muzzleFlash.visible=true;
    this.muzzleFlashTimer=0.05;
    this.muzzleFlash.rotation.z=Math.random()*Math.PI*2;
    const flashScale=id==="shotgun"?2.0:id==="rifle"?1.2:1.0;
    this.muzzleFlash.scale.setScalar(flashScale);

    const dir=env.getForward();
    const muzzle=this.pos.clone().addScaledVector(dir,0.7);
    env.particles.spawn(muzzle,dir.clone().multiplyScalar(8),0.08,0.06);

    // Shell casing ejection
    const right=v3(Math.cos(this.yaw),0,-Math.sin(this.yaw));
    const casingPos=this.pos.clone().addScaledVector(right,0.3).add(v3(0,-0.1,0));
    const casingVel=right.clone().multiplyScalar(3+Math.random()*2).add(v3(0,2+Math.random(),0));
    env.particles.spawnCasing(casingPos,casingVel);

    const pellets=this.weapon.pellets||1;
    const mods=this._weaponMods?.[id];
    for(let i=0;i<pellets;i++){
      const spread=this.weapon.spread*(mods?.spreadMul||1);
      const sx=(Math.random()*2-1)*spread;
      const sy=(Math.random()*2-1)*spread;
      const shot=dir.clone();
      shot.x+=sx; shot.y+=sy; shot.z+=sx*0.25; shot.normalize();
      const hit=env.raycast(this.pos,shot,this.weapon.range);
      if(hit) env.onShotHit(hit,this.weapon,shot);
    }
    return true;
  }
}

// ---------------- Game ----------------
class Game{
  constructor(){
    this.ui=makeUI();

    this.renderer=new THREE.WebGLRenderer({antialias:true});
    this.renderer.setPixelRatio(Math.min(devicePixelRatio,2));
    this.renderer.setSize(innerWidth,innerHeight);
    this.renderer.shadowMap.enabled=true;
    this.renderer.shadowMap.type=THREE.PCFSoftShadowMap;
    document.body.appendChild(this.renderer.domElement);

    this.scene=new THREE.Scene();
    this.scene.fog=new THREE.Fog(0x0a1018,22,280);

    this.fov=70;
    this.camera=new THREE.PerspectiveCamera(this.fov,innerWidth/innerHeight,0.05,700);
    this.scene.add(this.camera);

    this.clock=new THREE.Clock();
    this.input=new Input(this.renderer.domElement);
    this.audio=new AudioSys();
    this.particles=new Particles(this.scene);

    this.save=loadSave();
    if(this.save.fov){ this.fov=this.save.fov; this.camera.fov=this.fov; this.camera.updateProjectionMatrix(); }
    this.player=new Player(this.camera);
    this.player.fromSave(this.save.player);
    this.scene.add(this.player.model);

    this.vault=new Vault(this.scene);
    this.world=new World(this.scene,this.save.world.seed);

    this.npcMgr=new NPCManager(this.scene);
    this.npcMgr.spawnVaultNPCs();
    this.npcMgr.spawnOutsideNPCs();
    this.npcMgr.setOutsideVisible(false);
    this.dialogueCtrl=new DialogueController();

    // Build outpost (meshes + interactables)
    this.outpost=buildOutpost(this.scene, this.world);
    this.outpost.group.visible=false;

    this.mode="title"; // title intro play pause inventory skills crafting pipboy dialogue
    this.autoFire=false;
    this.shake={amp:0,t:0};
    this.pipboyTab="stat";

    this.quest=this.save.world.quest;
    this.questSys=new Quest();
    this.questSys.fromSave(this.save.world.questSys);

    this.cutscene={
      step:0,t:0,hold:0,
      lines:[
        {t:"JAPAN, 1945 — ASH AND SILENCE", b:"You were a child when the sky tore open. Hiroshima. Nagasaki. The world held its breath… then screamed.", d:5.0},
        {t:"THE WAR THAT DIDN’T END", b:"In this reality, the bombings did not close the book — they lit a fuse. A wider world war followed. Radiation wrote new laws into flesh.", d:6.0},
        {t:"THE SEARCH PARTY", b:"A government team found you among ruins — alive, furious, stubborn. They took you in… and never truly gave you back.", d:6.0},
        {t:"VAULT 811", b:"You were recruited, forged, trained. A vault program made warriors out of survivors. The vault promised: Japan would be restored when it was safe.", d:7.0},
        {t:"AGE 33 — THE DOOR OPENS", b:"You’re old enough now. The vault allows you outside. They said you’d see home repaired… a nation healed.", d:6.0},
        {t:"THE LIE", b:"The vault lied. Japan never recovered. The world outside is a wound that learned to walk — monsters, mutations, radioactive hunger.", d:7.0},
      ]
    };

    this._loots=[];
    this._spit=[];

    this._makeLights();
    this._makeSky();
    this._bindUI();
    this.showTitle();

    addEventListener("resize",()=>{
      this.camera.aspect=innerWidth/innerHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(innerWidth,innerHeight);
    });

    this._bindMouseShooting();
    this.loop();
  }

  _makeLights(){
    this.scene.add(new THREE.AmbientLight(0xffffff,0.55));
    this.sun=new THREE.DirectionalLight(0xfff4e0,1.6);
    this.sun.position.set(50,70,20);
    this.sun.castShadow=true;
    this.sun.shadow.mapSize.set(1024,1024);
    Object.assign(this.sun.shadow.camera,{near:1,far:200,left:-80,right:80,top:80,bottom:-80});
    this.scene.add(this.sun);

    // Hemisphere light for better ambient variation
    this.hemiLight=new THREE.HemisphereLight(0x8899bb,0x223311,0.35);
    this.scene.add(this.hemiLight);

    this.vaultLight=new THREE.PointLight(0x9bd3ff,2.2,60,1.9);
    this.vaultLight.position.set(0,6.5,0);
    this.scene.add(this.vaultLight);
  }

  _makeSky(){
    const geo=new THREE.SphereGeometry(500,20,16);
    const mat=new THREE.MeshBasicMaterial({color:0x0a0f17,side:THREE.BackSide});
    this.sky=new THREE.Mesh(geo,mat);
    this.scene.add(this.sky);
  }

  _bindUI(){
    this.ui.invClose.addEventListener("click",()=>this.toggleInventory(false));
  }

  async ensureAudio(){
    if(!this.audio.started){
      await this.audio.ensure();
      this.audio.startAmbient(this.player.inVault?"vault":"waste");
    }
  }

  showMenu(title,desc,buttons,extras=null){
    this.ui.scrim.style.display="block";
    this.ui.menuTitle.textContent=title;
    this.ui.menuDesc.textContent=desc;
    this.ui.btns.innerHTML="";
    for(const b of buttons){
      const btn=document.createElement("div");
      btn.className="btn";
      btn.textContent=b.label;
      btn.addEventListener("click",b.onClick);
      this.ui.btns.appendChild(btn);
    }
    if(extras) this.ui.btns.appendChild(extras);
  }

  showTitle(){
    this.mode="title";
    this.ui.inv.style.display="none";
    this.ui.cut.style.display="none";
    this.ui.dlg.panel.style.display="none";
    this.vault.setVisible(true);
    this.npcMgr.setVisible(true);
    this.audio.stopAmbient?.();
    const buttons=[
      {label:"New Game", onClick:()=>this.startNewGame()},
      {label:this.save.hasSave?"Continue":"Continue (No Save)", onClick:()=>this.save.hasSave?this.continueGame():this.ui.showToast("No save found. Start a new game.")},
      {label:"Settings", onClick:()=>this.openSettings("title")},
      {label:"Credits", onClick:()=>this.ui.showToast("Built with Three.js placeholders. Original IP: Wasteland Japan.")},
    ];
    const extras=document.createElement("div");
    extras.style.marginTop="10px";
    extras.style.opacity="0.85";
    extras.innerHTML=`<div class="row"><label>Tip:</label><div>Click the game to lock mouse. Press <b>C</b> to toggle 1st/3rd person.</div></div>`;
    this.showMenu("Wasteland Japan","A vault lied. The land remembers. Survival is the only tutorial.",buttons,extras);
  }

  showPause(){
    this.mode="pause";
    this.ui.inv.style.display="none";
    this.ui.cut.style.display="none";
    const buttons=[
      {label:"Resume", onClick:()=>this.resume()},
      {label:"Save", onClick:()=>this.doSave()},
      {label:"Load", onClick:()=>this.doLoad()},
      {label:"Settings", onClick:()=>this.openSettings("pause")},
      {label:"Quit to Title", onClick:()=>this.showTitle()},
    ];
    this.showMenu("Paused","Breathe. Count your bullets. The wasteland will wait exactly zero minutes.",buttons);
  }

  resume(){
    this.mode="play";
    this.ui.scrim.style.display="none";
    this.ui.inv.style.display="none";
    this.ui.cut.style.display="none";
    this.ui.pipboy.style.display="none";
    this.ui.dlg.panel.style.display="none";
    this.player.pipboyActive=false;
  }

  openPipboy(tab){
    if(this.mode==="pipboy"&&this.pipboyTab===tab){ this.closePipboy(); return; }
    this.mode="pipboy";
    this.pipboyTab=tab||"stat";
    this.player.pipboyActive=true;
    // Force first-person when opening pip-boy
    if(this.player.camMode==="tp"){ this.player.camMode="fp"; }
    this.ui.inv.style.display="none";
    this.ui.skillTree.style.display="none";
    this.ui.craftPanel.style.display="none";
    this.ui.scrim.style.display="none";
    this.ui.pipboy.style.display="block";
    // Bind tab buttons once per open (onclick replaces, no leak)
    this.ui.pipTabBtns.forEach(btn=>{
      btn.onclick=()=>{ this.pipboyTab=btn.dataset.tab; this.renderPipboy(); };
    });
    this.renderPipboy();
  }

  closePipboy(){
    this.player.pipboyActive=false;
    this.ui.pipboy.style.display="none";
    this.mode="play";
  }

  renderPipboy(){
    const tab=this.pipboyTab;
    this.ui.pipTabBtns.forEach(btn=>{
      btn.classList.toggle("active",btn.dataset.tab===tab);
    });
    const c=this.ui.pipContent;
    c.innerHTML="";
    if(tab==="stat") this._renderPipStat(c);
    else if(tab==="inv") this._renderPipInv(c);
    else if(tab==="skills") this._renderPipSkills(c);
    else if(tab==="craft") this._renderPipCraft(c);
  }

  _renderPipStat(c){
    const p=this.player;
    c.innerHTML=`
      <div style="font-weight:900;font-size:16px;margin-bottom:10px;letter-spacing:1px">STATUS</div>
      <div class="k">HP: ${Math.round(p.hp)} / ${p.hpMax}</div>
      <div class="k">Stamina: ${Math.round(p.stamina)} / ${p.staminaMax}</div>
      <div class="k">Radiation: ${Math.round(p.radiation)} / ${p.radiationMax}</div>
      <div class="k">Armor: ${p.armor}</div>
      <div class="k">Level: ${p.level} (XP: ${p.xp}/${p.level*100})</div>
      <div style="height:10px"></div>
      <div style="font-weight:900;font-size:14px;margin-bottom:6px;letter-spacing:1px">AMMO</div>
      <div class="k">Pistol: ${p.mag.pistol}/${p.reserve.pistol}</div>
      <div class="k">Rifle: ${p.mag.rifle}/${p.reserve.rifle}</div>
      <div class="k">Shotgun: ${p.mag.shotgun}/${p.reserve.shotgun}</div>
      <div style="height:10px"></div>
      <div style="font-weight:900;font-size:14px;margin-bottom:6px;letter-spacing:1px">CONTROLS</div>
      <div class="k">Tab: Pip-Boy (I/K/J for tabs) • C: Camera • R: Reload</div>
      <div class="k">E: Interact • Esc: Pause/Settings</div>
    `;
  }

  _renderPipInv(c){
    const p=this.player;
    const w=p.weight();
    let html=`<div style="font-weight:900;font-size:16px;margin-bottom:4px;letter-spacing:1px">INVENTORY</div>`;
    html+=`<div class="k" style="margin-bottom:10px">Weight: ${w.toFixed(1)}/${p.maxWeight} • Equipped: ${p.weapon.name} • Armor: ${p.armor}</div>`;
    html+=`<div class="inv-list">`;
    p.inv.forEach((item,idx)=>{
      const def=ItemDB[item.id]||{name:item.id,type:"junk",weight:0,desc:""};
      const useLabel=def.type==="consumable"?"Use":def.type==="weapon"?"Equip":def.type==="armor"?"Wear":def.type==="mod"?"Apply":"Inspect";
      html+=`<div class="inv-item" style="display:flex;gap:10px;justify-content:space-between;align-items:center;padding:8px 10px;border-bottom:1px solid rgba(80,255,80,.1)">
        <div><div style="font-weight:800">${def.name} <span class="k">x${item.qty||1}</span></div><div class="k" style="font-size:11px">${def.desc} • ${def.weight}wt</div></div>
        <div style="display:flex;gap:6px">
          <div class="chip" data-pipuse="${idx}">${useLabel}</div>
          <div class="chip" data-pipdrop="${idx}">Drop</div>
        </div>
      </div>`;
    });
    html+=`</div>`;
    c.innerHTML=html;
    c.querySelectorAll("[data-pipuse]").forEach(btn=>{
      btn.addEventListener("click",()=>{ this.useItem(parseInt(btn.dataset.pipuse,10)); this.renderPipboy(); });
    });
    c.querySelectorAll("[data-pipdrop]").forEach(btn=>{
      btn.addEventListener("click",()=>{ this.dropItem(parseInt(btn.dataset.pipdrop,10)); this.renderPipboy(); });
    });
  }

  _renderPipSkills(c){
    const p=this.player;
    let html=`<div style="font-weight:900;font-size:16px;margin-bottom:4px;letter-spacing:1px">SKILLS</div>`;
    html+=`<div class="k" style="margin-bottom:10px">Level ${p.level} • Skill Points: ${p.skillPoints}</div>`;
    for(const [key,def] of Object.entries(SkillDefs)){
      const lvl=p.skills[key]||0;
      const canUpgrade=p.skillPoints>0 && lvl<def.maxLvl;
      html+=`<div class="skill-row" style="display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px solid rgba(80,255,80,.15)">
        <div><div style="font-weight:800;font-size:14px">${def.name}</div><div class="k" style="font-size:11px">${def.desc}</div></div>
        <div style="display:flex;align-items:center;gap:8px">
          <span class="k">${lvl}/${def.maxLvl}</span>
          ${canUpgrade?`<div class="chip" data-pipskill="${key}">+</div>`:`<span class="k" style="opacity:.4">MAX</span>`}
        </div>
      </div>`;
    }
    c.innerHTML=html;
    c.querySelectorAll("[data-pipskill]").forEach(btn=>{
      btn.addEventListener("click",()=>{
        const sk=btn.dataset.pipskill;
        if(p.skillPoints>0 && p.skills[sk]<SkillDefs[sk].maxLvl){
          p.skills[sk]++;
          p.skillPoints--;
          if(sk==="toughness") p.hpMax=100+p.skills.toughness*15;
          this.ui.showToast(`${SkillDefs[sk].name} upgraded to ${p.skills[sk]}`);
          this.renderPipboy();
        }
      });
    });
  }

  _renderPipCraft(c){
    const p=this.player;
    let html=`<div style="font-weight:900;font-size:16px;margin-bottom:10px;letter-spacing:1px">CRAFTING</div>`;
    for(const recipe of CraftRecipes){
      const canCraft=recipe.needs.every(n=>{
        const have=p.inv.find(x=>x.id===n.id);
        return have && (have.qty||1)>=n.qty;
      });
      const needsStr=recipe.needs.map(n=>`${ItemDB[n.id]?.name||n.id} x${n.qty}`).join(", ");
      const resultDef=ItemDB[recipe.result.id];
      html+=`<div class="skill-row" style="display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px solid rgba(80,255,80,.15)">
        <div><div style="font-weight:800;font-size:14px">${resultDef?.name||recipe.name}</div><div class="k" style="font-size:11px">Needs: ${needsStr}</div></div>
        <div>${canCraft?`<div class="chip" data-pipcraft="${recipe.id}">Craft</div>`:`<span class="k" style="opacity:.4">Missing</span>`}</div>
      </div>`;
    }
    c.innerHTML=html;
    c.querySelectorAll("[data-pipcraft]").forEach(btn=>{
      btn.addEventListener("click",()=>{
        const recipe=CraftRecipes.find(r=>r.id===btn.dataset.pipcraft);
        if(!recipe) return;
        const canCraft=recipe.needs.every(n=>{
          const have=p.inv.find(x=>x.id===n.id);
          return have && (have.qty||1)>=n.qty;
        });
        if(!canCraft){this.ui.showToast("Missing materials."); return;}
        for(const n of recipe.needs){
          const have=p.inv.find(x=>x.id===n.id);
          have.qty=(have.qty||1)-n.qty;
          if(have.qty<=0) p.inv.splice(p.inv.indexOf(have),1);
        }
        const existing=p.inv.find(x=>x.id===recipe.result.id);
        if(existing) existing.qty=(existing.qty||1)+recipe.result.qty;
        else p.inv.push({...recipe.result});
        this.audio.hit();
        this.ui.showToast(`Crafted: ${ItemDB[recipe.result.id]?.name||recipe.result.id}`);
        this.renderPipboy();
      });
    });
  }

  openSettings(returnTo){
    this.mode="pause";
    const wrap=document.createElement("div");
    wrap.style.display="flex";
    wrap.style.flexDirection="column";
    wrap.style.gap="10px";

    const row1=document.createElement("div"); row1.className="row";
    row1.innerHTML=`<label>Mouse Sensitivity</label>`;
    const sens=document.createElement("input");
    sens.type="range"; sens.min="0.001"; sens.max="0.006"; sens.step="0.0001"; sens.value=String(this.input.mouse.sens);
    sens.addEventListener("input",()=>this.input.mouse.sens=parseFloat(sens.value));
    row1.appendChild(sens);

    const row2=document.createElement("div"); row2.className="row";
    row2.innerHTML=`<label>Graphics Quality</label>`;
    const q=document.createElement("input");
    q.type="range"; q.min="0"; q.max="2"; q.step="1"; q.value="1";
    q.addEventListener("input",()=>this.applyQuality(parseInt(q.value,10)));
    row2.appendChild(q);

    const row3=document.createElement("div"); row3.className="row";
    row3.innerHTML=`<label>Master Volume</label>`;
    const vol=document.createElement("input");
    vol.type="range"; vol.min="0"; vol.max="1"; vol.step="0.01"; vol.value="0.6";
    vol.addEventListener("input",()=>this.audio.setMaster(parseFloat(vol.value)));
    row3.appendChild(vol);

    wrap.append(row1,row2,row3);

    const row4=document.createElement("div"); row4.className="row";
    row4.innerHTML=`<label>Field of View: <span id="fov-val">${this.fov}</span></label>`;
    const fovSlider=document.createElement("input");
    fovSlider.type="range"; fovSlider.min="60"; fovSlider.max="120"; fovSlider.step="1"; fovSlider.value=String(this.fov);
    fovSlider.addEventListener("input",()=>{
      this.fov=parseInt(fovSlider.value,10);
      this.camera.fov=this.fov;
      this.camera.updateProjectionMatrix();
      row4.querySelector("#fov-val").textContent=this.fov;
    });
    row4.appendChild(fovSlider);
    wrap.appendChild(row4);

    const kb=document.createElement("div");
    kb.style.marginTop="8px"; kb.style.opacity="0.85";
    kb.innerHTML=`<div class="k">Keybinds: WASD Move • Mouse Look • C Camera • 1/2/3 Weapons • R Reload • E Interact • Tab Pip-Boy (I Inv, K Skills, J Craft) • Esc Pause</div>`;
    wrap.appendChild(kb);

    this.ui.btns.innerHTML="";
    this.ui.btns.appendChild(wrap);

    const bottom=document.createElement("div");
    bottom.className="btns"; bottom.style.marginTop="12px";
    const back=document.createElement("div");
    back.className="btn"; back.textContent="Back";
    back.addEventListener("click",()=>{ returnTo==="title"?this.showTitle():this.showPause(); });
    bottom.appendChild(back);
    this.ui.btns.appendChild(bottom);

    this.ui.scrim.style.display="block";
    this.ui.menuTitle.textContent="Settings";
    this.ui.menuDesc.textContent="Tune the feel. The world won’t tune itself.";
  }

  applyQuality(q){
    if(q===0){
      this.renderer.setPixelRatio(Math.min(devicePixelRatio,1.25));
      this.renderer.shadowMap.enabled=false;
      this.scene.fog.near=16; this.scene.fog.far=190;
    }else if(q===1){
      this.renderer.setPixelRatio(Math.min(devicePixelRatio,1.6));
      this.renderer.shadowMap.enabled=true;
      this.scene.fog.near=18; this.scene.fog.far=240;
    }else{
      this.renderer.setPixelRatio(Math.min(devicePixelRatio,2));
      this.renderer.shadowMap.enabled=true;
      this.scene.fog.near=18; this.scene.fog.far=300;
    }
  }

  async startNewGame(){
    await this.ensureAudio();
    this.save=defaultSave();
    // Remove old player model and camera-attached weapons if present
    if(this.player?.model?.parent) this.player.model.parent.remove(this.player.model);
    if(this.player?.fpWeapon?.parent) this.player.fpWeapon.parent.remove(this.player.fpWeapon);
    if(this.player?.fpPipboy?.parent) this.player.fpPipboy.parent.remove(this.player.fpPipboy);
    this.player=new Player(this.camera);
    this.scene.add(this.player.model);
    this.quest=this.save.world.quest;
    this.questSys=new Quest();
    this.questSys.fromSave(this.save.world.questSys);
    this.vault.setVisible(true);
    this.npcMgr.setOutsideVisible(false);
    this.outpost.group.visible=false;
    // Reset vault door
    this.vault.door.rotation.y=0;
    this.vault.door.position.x=0;
    this._doorAnim=null;
    this.audio.startAmbient("vault");
    this.startIntro();
    this.ui.showToast("Hold Enter to skip intro.");
  }

  async continueGame(){
    await this.ensureAudio();
    this.save=loadSave();
    this.player.fromSave(this.save.player);
    this.quest=this.save.world.quest;
    this.questSys=new Quest();
    this.questSys.fromSave(this.save.world.questSys);
    this.vault.setVisible(this.player.inVault);
    this.npcMgr.setOutsideVisible(!this.player.inVault);
    this.outpost.group.visible=!this.player.inVault;
    this.audio.startAmbient(this.player.inVault?"vault":"waste");
    this.resume();
  }

  startIntro(){
    this.mode="intro";
    this.ui.scrim.style.display="none";
    this.ui.inv.style.display="none";
    this.ui.cut.style.display="block";
    this.cutscene.step=0; this.cutscene.t=0; this.cutscene.hold=0;
    this.updateCutUI();
  }

  updateCutUI(){
    const line=this.cutscene.lines[this.cutscene.step];
    this.ui.cutT.textContent=line.t;
    this.ui.cutB.textContent=line.b;
    this.ui.cutS.textContent="Skip: hold Enter • or press Esc";
  }

  endIntro(){
    this.ui.cut.style.display="none";
    this.resume();
    this.player.pos.set(0,1.6,6);
    this.player.yaw=Math.PI;
    this.player.pitch=0;
    this.player.inVault=true;
    this.ui.showToast("Vault 811: Main Hall");
  }

  doSave(){
    this.save.player=this.player.toSave();
    this.save.world.quest=this.quest;
    this.save.world.questSys=this.questSys.toSave();
    this.save.fov=this.fov;
    writeSave(this.save);
    this.ui.showToast("Saved.");
  }

  doLoad(){
    this.save=loadSave();
    if(!this.save.hasSave){ this.ui.showToast("No save to load."); return; }
    this.player.fromSave(this.save.player);
    this.quest=this.save.world.quest;
    this.questSys=new Quest();
    this.questSys.fromSave(this.save.world.questSys);
    if(this.save.fov){ this.fov=this.save.fov; this.camera.fov=this.fov; this.camera.updateProjectionMatrix(); }
    this.vault.setVisible(this.player.inVault);
    this.npcMgr.setOutsideVisible(!this.player.inVault);
    this.outpost.group.visible=!this.player.inVault;
    this.audio.startAmbient(this.player.inVault?"vault":"waste");
    this.ui.showToast("Loaded.");
  }

  toggleInventory(force=null){
    const open=force===null?(this.mode!=="inventory"):force;
    if(open){
      this.mode="inventory";
      this.ui.inv.style.display="block";
      this.ui.scrim.style.display="none";
      this.ui.skillTree.style.display="none";
      this.ui.craftPanel.style.display="none";
      this.renderInventory();
    }else{
      this.ui.inv.style.display="none";
      this.resume();
    }
  }

  toggleSkillTree(){
    if(this.mode==="skills"){
      this.ui.skillTree.style.display="none";
      this.resume();
      return;
    }
    this.mode="skills";
    this.ui.inv.style.display="none";
    this.ui.craftPanel.style.display="none";
    this.ui.skillTree.style.display="block";
    this.renderSkillTree();
  }

  renderSkillTree(){
    const p=this.player;
    let html=`<div style="font-weight:950;font-size:18px;margin-bottom:4px">Skill Tree</div>`;
    html+=`<div class="k" style="margin-bottom:12px">Level ${p.level} • Skill Points: ${p.skillPoints}</div>`;
    for(const [key,def] of Object.entries(SkillDefs)){
      const lvl=p.skills[key]||0;
      const canUpgrade=p.skillPoints>0 && lvl<def.maxLvl;
      html+=`<div class="skill-row">
        <div><div class="skill-name">${def.name}</div><div class="skill-desc">${def.desc}</div></div>
        <div style="display:flex;align-items:center;gap:8px">
          <span class="skill-lvl">${lvl}/${def.maxLvl}</span>
          ${canUpgrade?`<div class="chip" data-skill="${key}">+</div>`:`<span class="k">MAX</span>`}
        </div>
      </div>`;
    }
    this.ui.skillTree.innerHTML=html;
    this.ui.skillTree.querySelectorAll("[data-skill]").forEach(btn=>{
      btn.addEventListener("click",()=>{
        const sk=btn.dataset.skill;
        if(p.skillPoints>0 && p.skills[sk]<SkillDefs[sk].maxLvl){
          p.skills[sk]++;
          p.skillPoints--;
          if(sk==="toughness") p.hpMax=100+p.skills.toughness*15;
          this.ui.showToast(`${SkillDefs[sk].name} upgraded to ${p.skills[sk]}`);
          this.renderSkillTree();
        }
      });
    });
  }

  toggleCrafting(){
    if(this.mode==="crafting"){
      this.ui.craftPanel.style.display="none";
      this.resume();
      return;
    }
    this.mode="crafting";
    this.ui.inv.style.display="none";
    this.ui.skillTree.style.display="none";
    this.ui.craftPanel.style.display="block";
    this.renderCrafting();
  }

  renderCrafting(){
    const p=this.player;
    let html=`<div style="font-weight:950;font-size:18px;margin-bottom:12px">Crafting</div>`;
    for(const recipe of CraftRecipes){
      const canCraft=recipe.needs.every(n=>{
        const have=p.inv.find(x=>x.id===n.id);
        return have && (have.qty||1)>=n.qty;
      });
      const needsStr=recipe.needs.map(n=>`${ItemDB[n.id]?.name||n.id} x${n.qty}`).join(", ");
      const resultDef=ItemDB[recipe.result.id];
      html+=`<div class="skill-row">
        <div><div class="skill-name">${resultDef?.name||recipe.name}</div><div class="skill-desc">Needs: ${needsStr}</div></div>
        <div>${canCraft?`<div class="chip" data-craft="${recipe.id}">Craft</div>`:`<span class="k" style="opacity:.4">Missing</span>`}</div>
      </div>`;
    }
    this.ui.craftPanel.innerHTML=html;
    this.ui.craftPanel.querySelectorAll("[data-craft]").forEach(btn=>{
      btn.addEventListener("click",()=>{
        const recipe=CraftRecipes.find(r=>r.id===btn.dataset.craft);
        if(!recipe) return;
        const canCraft=recipe.needs.every(n=>{
          const have=p.inv.find(x=>x.id===n.id);
          return have && (have.qty||1)>=n.qty;
        });
        if(!canCraft){this.ui.showToast("Missing materials."); return;}
        for(const n of recipe.needs){
          const have=p.inv.find(x=>x.id===n.id);
          have.qty=(have.qty||1)-n.qty;
          if(have.qty<=0) p.inv.splice(p.inv.indexOf(have),1);
        }
        const existing=p.inv.find(x=>x.id===recipe.result.id);
        if(existing) existing.qty=(existing.qty||1)+recipe.result.qty;
        else p.inv.push({...recipe.result});
        this.audio.hit();
        this.ui.showToast(`Crafted: ${ItemDB[recipe.result.id]?.name||recipe.result.id}`);
        this.renderCrafting();
      });
    });
  }

  renderInventory(){
    const w=this.player.weight();
    this.ui.invTitle.textContent="Inventory";
    this.ui.invSub.textContent=`Weight: ${w.toFixed(1)} / ${this.player.maxWeight}  •  Equipped: ${this.player.weapon.name}  •  Armor: ${this.player.armor}`;
    this.ui.invList.innerHTML="";
    const inv=this.player.inv;

    inv.forEach((item,idx)=>{
      const def=ItemDB[item.id]||{name:item.id,type:"junk",weight:0,desc:""};
      const row=document.createElement("div");
      row.className="inv-item";
      const left=document.createElement("div");
      left.innerHTML=`<div class="name">${def.name} <span class="meta">x${item.qty||1}</span></div>
                      <div class="meta">${def.desc} • ${def.weight}wt</div>`;
      const actions=document.createElement("div");
      actions.className="actions";
      const use=document.createElement("div");
      use.className="chip";
      const useLabel=def.type==="consumable"?"Use":def.type==="weapon"?"Equip":def.type==="armor"?"Wear":def.type==="mod"?"Apply":"Inspect";
      use.textContent=useLabel;
      use.addEventListener("click",()=>{
        if(def.type==="consumable"||def.type==="armor"||def.type==="mod") this.useItem(idx);
        else if(def.type==="weapon"){
          const slot=WeaponDefs.findIndex(w=>w.id===def.id);
          if(slot>=0){ this.player.setWeapon(slot); this.ui.showToast(`Equipped: ${this.player.weapon.name}`); this.renderInventory(); }
        } else this.ui.showToast(def.desc||"Old world junk.");
      });
      const drop=document.createElement("div");
      drop.className="chip"; drop.textContent="Drop";
      drop.addEventListener("click",()=>this.dropItem(idx));
      actions.append(use,drop);
      row.append(left,actions);
      this.ui.invList.appendChild(row);
    });

    this.ui.panel.innerHTML=`
      <div style="font-weight:950;font-size:14px;margin-bottom:8px">Status</div>
      <div class="k">HP: ${Math.round(this.player.hp)} / ${this.player.hpMax}</div>
      <div class="k">Stamina: ${Math.round(this.player.stamina)} / ${this.player.staminaMax}</div>
      <div class="k">Radiation: ${Math.round(this.player.radiation)} / ${this.player.radiationMax}</div>
      <div class="k">Armor: ${this.player.armor}</div>
      <div class="k">Level: ${this.player.level} (XP: ${this.player.xp}/${this.player.level*100})</div>
      <div style="height:10px"></div>
      <div style="font-weight:950;font-size:14px;margin-bottom:8px">Ammo</div>
      <div class="k">Pistol: ${this.player.mag.pistol}/${this.player.reserve.pistol}</div>
      <div class="k">Rifle: ${this.player.mag.rifle}/${this.player.reserve.rifle}</div>
      <div class="k">Shotgun: ${this.player.mag.shotgun}/${this.player.reserve.shotgun}</div>
      <div style="height:10px"></div>
      <div style="font-weight:950;font-size:14px;margin-bottom:8px">Controls</div>
      <div class="k">• Tab: Pip-Boy (I/K/J for tabs) • C: camera</div>
      <div class="k">• R: reload • E: interact • Esc: pause</div>
    `;
  }

  useItem(idx){
    const it=this.player.inv[idx]; if(!it) return;
    const def=ItemDB[it.id];
    if(it.id==="stim"){ this.player.hp=clamp(this.player.hp+35,0,this.player.hpMax); this.ui.showToast("Used Field Stim (+35 HP)"); }
    else if(it.id==="ration"){ this.player.hp=clamp(this.player.hp+20,0,this.player.hpMax); this.ui.showToast("Ate Ration Pack (+20 HP)"); }
    else if(it.id==="radaway"){ this.player.radiation=Math.max(0,this.player.radiation-30); this.ui.showToast("Used Rad-Away (-30 RAD)"); }
    else if(def?.type==="armor"){
      const bonus=it.id==="vest"?10:it.id==="plating"?20:5;
      this.player.armor+=bonus;
      this.ui.showToast(`Equipped ${def.name} (+${bonus} Armor)`);
    }
    else if(def?.type==="mod"){
      this.ui.showToast(`Applied ${def.name} to ${this.player.weapon.name}`);
      // Store mods on a per-player copy instead of mutating shared WeaponDefs
      if(!this.player._weaponMods) this.player._weaponMods={};
      const wid=this.player.weapon.id;
      if(!this.player._weaponMods[wid]) this.player._weaponMods[wid]={spreadMul:1,magMul:1};
      if(it.id==="scope") this.player._weaponMods[wid].spreadMul*=0.6;
      else if(it.id==="extmag") this.player._weaponMods[wid].magMul*=1.5;
    }
    else return;
    it.qty=(it.qty||1)-1;
    if(it.qty<=0) this.player.inv.splice(idx,1);
    this.audio.hit();
    this.renderInventory();
  }

  dropItem(idx){
    const it=this.player.inv[idx]; if(!it) return;
    const dropped={id:it.id,qty:1};
    it.qty=(it.qty||1)-1;
    if(it.qty<=0) this.player.inv.splice(idx,1);
    this.spawnLoot(this.player.pos.clone().add(v3(rand(-1,1),0,rand(-1,1))),dropped);
    this.ui.showToast("Dropped item.");
    this.renderInventory();
  }

  spawnLoot(pos,item){
    const def=ItemDB[item.id];
    const color=def?.type==="weapon"?0xffe38a:def?.type==="consumable"?0xa0ffcc:0xb7c3ff;
    const m=new THREE.Mesh(new THREE.OctahedronGeometry(0.25,0), new THREE.MeshStandardMaterial({color,emissive:color,emissiveIntensity:0.18,roughness:0.8}));
    m.position.copy(pos); m.position.y=0.45;
    m.userData={loot:true,item:{...item},name:def?.name||item.id};
    m.castShadow=true;
    this.scene.add(m);
    this._loots.push(m);
  }

  getForward(){
    const dir=new THREE.Vector3(0,0,-1);
    dir.applyQuaternion(this.camera.quaternion);
    return dir.normalize();
  }

  raycast(origin,dir,range){
    const rc=this._rc||(this._rc=new THREE.Raycaster());
    rc.set(origin,dir); rc.far=range;
    const meshes=[];
    const add=(obj)=>{
      if(obj.isMesh) meshes.push(obj);
      if(obj.traverse) obj.traverse(o=>{if(o.isMesh) meshes.push(o);});
    };
    add(this.vault.group);
    add(this.world.enemies);
    add(this.world.interact);
    add(this.npcMgr.group);
    add(this.npcMgr.outsideGroup);
    if(this.outpost) add(this.outpost.group);
    for(const l of this._loots) add(l);
    const hits=rc.intersectObjects(meshes,true);
    if(!hits.length) return null;
    const h=hits[0];
    return {point:h.point.clone(),object:h.object,parent:this.findRoot(h.object),dist:h.distance};
  }

  findRoot(obj){
    let o=obj;
    while(o && o.parent && o.parent!==this.scene){
      if(o.userData.enemy||o.userData.loot||o.userData.interact||o.userData.npc) return o;
      if(o.parent.userData.enemy||o.parent.userData.loot||o.parent.userData.interact||o.parent.userData.npc) return o.parent;
      o=o.parent;
    }
    return obj;
  }

  onShotHit(hit,weapon,dir){
    // Spark particles on hit
    for(let i=0;i<3;i++){
      this.particles.spawn(hit.point.clone(),v3(rand(-2,2),rand(0.5,2.5),rand(-2,2)),0.2+Math.random()*0.15,0.03+Math.random()*0.03);
    }
    // Impact decal on non-enemy surfaces
    const root=hit.parent;
    if(root?.userData?.enemy){
      root.userData.hp-=weapon.damage*(1+this.player.skills.ironSights*0.08);
      root.userData.aggro=1;
      this.audio.hit();
      this.enemyBarShow(root.userData);
      if(root.userData.hp<=0) this.killEnemy(root);
    }else{
      // Decal on wall/surface
      const normal=dir.clone().negate().normalize();
      this.particles.spawnDecal(hit.point,normal);
    }
  }

  enemyBarShow(ud){
    this.ui.enemybar.style.display="block";
    this.ui.enemyname.style.display="block";
    this.ui.enemyname.textContent=ud.name;
    this.ui.ebFill.style.width=`${clamp(ud.hp/ud.hpMax,0,1)*100}%`;
    this._enemyBarT=0;
  }

  killEnemy(root){
    const ud=root.userData;
    // Grant XP
    const xpGain=ud.kind==="crawler"?25:40;
    this.player.xp+=xpGain;
    const xpForLevel=this.player.level*100;
    if(this.player.xp>=xpForLevel){
      this.player.xp-=xpForLevel;
      this.player.level++;
      this.player.skillPoints++;
      this.player.hpMax+=5+this.player.skills.toughness*15;
      this.ui.showToast(`Level Up! Lv.${this.player.level} (+1 Skill Point)`,2.5);
    }
    if(!ud.lootDone){
      ud.lootDone=true;
      const scavBonus=1+this.player.skills.scavenger*0.15;
      const r=Math.random()/scavBonus;
      if(r<0.30) this.spawnLoot(root.position.clone(),{id:"scrap",qty:Math.floor(1+Math.random()*3)});
      else if(r<0.50) this.spawnLoot(root.position.clone(),{id:"ration",qty:1});
      else if(r<0.65) this.spawnLoot(root.position.clone(),{id:"stim",qty:1});
      else if(r<0.78) this.spawnLoot(root.position.clone(),{id:"cloth",qty:Math.floor(1+Math.random()*2)});
      else if(r<0.88) this.spawnLoot(root.position.clone(),{id:"circuits",qty:1});
      else this.spawnLoot(root.position.clone(),{id:"radaway",qty:1});
    }
    // Track kills for Q5 "Cleanse the Path" (kills near outpost)
    if(this.questSys.getFlag("q5_branch")==="cleanse" && this.questSys.getStage("q5_outpost_accord")===20){
      const dx=root.position.x-OUTPOST_CENTER.x, dz=root.position.z-OUTPOST_CENTER.z;
      if(dx*dx+dz*dz<OUTPOST_KILL_RADIUS*OUTPOST_KILL_RADIUS){ // within kill tracking radius of outpost
        this.questSys.incFlag("q5_killCount",1);
        const kills=this.questSys.getFlag("q5_killCount");
        if(kills>=3){
          this.questSys.completeObjective("Clear 3 enemies near the outpost");
          this.questSys.addObjective("Report to Warden Aoi");
          this.ui.showToast("Path cleared! Report to Warden Aoi.",2.5);
        } else {
          this.ui.showToast(`Enemies cleared: ${kills}/3`,1.5);
        }
      }
    }
    for(let i=0;i<8;i++) this.particles.spawn(root.position.clone().add(v3(0,0.8,0)),v3(rand(-2,2),rand(1,3),rand(-2,2)),0.35,0.05);
    this.world.enemies.remove(root);
    root.parent?.remove(root);
  }

  // Interaction
  updateInteract(){
    this.player.interactTarget=null;
    const dir=this.getForward();
    const res=this.raycast(this.camera.position,dir,3.2);
    if(!res){ this.ui.hint.style.display="none"; return; }
    const t=res.parent;
    if(t?.userData?.loot){
      this.ui.hint.style.display="block";
      this.ui.hint.textContent=`E: Pick up ${t.userData.name}`;
      this.player.interactTarget=t; return;
    }
    if(t?.userData?.npc){
      const dist=this.player.pos.distanceTo(t.position);
      if(dist<=t.userData.interactDistance){
        this.ui.hint.style.display="block";
        this.ui.hint.textContent=`E: Talk to ${t.userData.displayName}`;
        this.player.interactTarget=t; return;
      }
    }
    if(t?.userData?.interact){
      this.ui.hint.style.display="block";
      let action="Use";
      if(t.userData.kind==="vaultDoor") action="Open";
      else if(t.userData.kind==="restPoint") action="Rest at";
      else if(t.userData.kind==="noticeBoard") action="Read";
      this.ui.hint.textContent=`E: ${action} ${t.userData.name||"Object"}`;
      this.player.interactTarget=t; return;
    }
    this.ui.hint.style.display="none";
  }

  doInteract(){
    const t=this.player.interactTarget; if(!t) return;
    const ud=t.userData;
    if(ud.npc){
      this.startDialogue(ud.npcId, ud);
      return;
    }
    if(ud.loot){
      const item=ud.item;
      const def=ItemDB[item.id];
      const canCarry=this.player.weight()+(def?.weight||0)*(item.qty||1) <= this.player.maxWeight;
      if(!canCarry){ this.ui.showToast("Too heavy. Drop something."); this.audio.click(); return; }
      const existing=this.player.inv.find(x=>x.id===item.id);
      if(existing) existing.qty=(existing.qty||1)+(item.qty||1);
      else this.player.inv.push({...item});
      this.ui.showToast(`Picked up: ${def?.name||item.id}`);
      this.audio.hit();
      this.scene.remove(t);
      this._loots=this._loots.filter(x=>x!==t);
      return;
    }
    if(ud.interact){
      if(ud.kind==="container"){
        if(ud.opened){ this.ui.showToast("Empty."); this.audio.click(); }
        else{
          ud.opened=true;
          const roll=Math.random();
          if(roll<0.35) this.spawnLoot(t.position.clone(),{id:"scrap",qty:Math.floor(1+Math.random()*3)});
          else if(roll<0.65) this.spawnLoot(t.position.clone(),{id:"ration",qty:1});
          else this.spawnLoot(t.position.clone(),{id:"stim",qty:1});
          this.ui.showToast(`${ud.name} opened.`);
          this.audio.hit();
        }
      }else if(ud.kind==="terminal"){
        this.ui.showToast("Terminal: Vault logs are redacted.");
        this.audio.click();
      }else if(ud.kind==="vaultDoor"){
        this.exitVault();
      }else if(ud.kind==="restPoint"){
        this.player.hp=this.player.hpMax;
        this.player.stamina=this.player.staminaMax;
        this.doSave();
        this.ui.showToast("Rested. Saved.",2.5);
        this.audio.click();
      }else if(ud.kind==="noticeBoard"){
        const topObj=this.questSys.topObjective();
        const lore="The shrine protects those who honor the old ways.";
        const msg=topObj?`${lore}\nObjective: ${topObj}`:lore;
        this.ui.showToast(msg,3.5);
        this.questSys.setFlag("discoveredShrineOutpost",true);
        this.audio.click();
      }
    }
  }

  startDialogue(npcId, npcData){
    const node=this.dialogueCtrl.start(npcId, this.player, this);
    if(!node){ this.ui.showToast("..."); return; }
    this.mode="dialogue";
    this._dialogueNpcData=npcData;
    // Mark NPC as in-dialogue so it faces the player
    const npcMesh=this.npcMgr.getById(npcId);
    if(npcMesh) npcMesh.userData._inDialogue=true;
    this.ui.hint.style.display="none";
    this.audio.click();
    renderDialogueNode(this.ui.dlg, node, npcData, this.player, (idx)=>this._onDialogueChoice(idx), this);
  }

  _onDialogueChoice(idx){
    if(!this.dialogueCtrl.active||!this.dialogueCtrl.currentNode) return;
    const choices=this.dialogueCtrl.currentNode.choices;
    if(idx<0||idx>=choices.length) return;
    // Skip disabled (failed condition) choices
    const choice=choices[idx];
    if(choice.condition && !choice.condition(this.player, this)) return;
    const next=this.dialogueCtrl.pick(idx, this.player, this);
    if(!next){
      this.closeDialogue();
      return;
    }
    this.audio.click();
    renderDialogueNode(this.ui.dlg, next, this._dialogueNpcData, this.player, (i)=>this._onDialogueChoice(i), this);
  }

  closeDialogue(){
    this.ui.dlg.panel.style.display="none";
    // Unmark NPC dialogue state
    if(this.dialogueCtrl.currentNpcId){
      const npcMesh=this.npcMgr.getById(this.dialogueCtrl.currentNpcId);
      if(npcMesh) npcMesh.userData._inDialogue=false;
    }
    // Also clear by stored id in case ctrl already ended
    if(this._dialogueNpcData?.npcId){
      const npcMesh=this.npcMgr.getById(this._dialogueNpcData.npcId);
      if(npcMesh) npcMesh.userData._inDialogue=false;
    }
    this.dialogueCtrl.end();
    this._dialogueNpcData=null;
    this.mode="play";
  }

  exitVault(){
    if(this.quest.step===0){
      this.quest.step=1;
      this.quest.log=["Find supplies","Reach the first shrine outpost"];
      this.ui.showToast("Objective updated.");
    }
    // Trigger firstExit flag for quest system
    if(!this.questSys.getFlag("firstExit")){
      this.questSys.setFlag("firstExit", true);
      this.questSys.addObjective("Find the first shrine outpost");
      this.questSys.addLog("Left Vault 811 for the first time. The wasteland awaits.");
    }
    // Animated vault door opening
    this.audio.tone(80,0.5,"sawtooth",0.15);
    setTimeout(()=>this.audio.tone(60,0.8,"sawtooth",0.12),300);
    this._doorAnim={t:0,dur:2.5};
    this.ui.showToast("Vault 811 door is opening...",2.0);
  }

  _completeExitVault(){
    this.player.inVault=false;
    this.vault.setVisible(false);
    this.npcMgr.setOutsideVisible(true);
    this.outpost.group.visible=true;
    this.player.pos.set(0,1.6,20);
    this.player.yaw=Math.PI;
    this.audio.startAmbient("waste");

    // Music swell
    this.audio.tone(220,1.5,"sine",0.15);
    setTimeout(()=>this.audio.tone(330,1.2,"sine",0.12),200);
    setTimeout(()=>this.audio.tone(440,1.0,"sine",0.10),500);

    // Dramatic reveal lighting
    this._revealLight=new THREE.PointLight(0xffe0aa,3.0,80,1.5);
    this._revealLight.position.set(0,8,22);
    this.scene.add(this._revealLight);
    this._revealTimer=3.0;

    this.ui.showToast("The air tastes like old lightning.",3.0);

    // Enemy intro moment — spawn a nearby enemy for tension
    if(this.world.enemies.children.length===0){
      const e=this.world.makeEnemy("crawler");
      e.position.set(12,0,35);
      this.world.enemies.add(e);
      this.scene.add(e);
    }
  }

  // Enemies AI
  updateEnemies(dt){
    const p=this.player.pos;
    for(const e of this.world.enemies.children){
      const ud=e.userData; if(!ud?.enemy) continue;
      ud.atkCd=Math.max(0,ud.atkCd-dt);
      ud.spitCd=Math.max(0,ud.spitCd-dt);
      ud.lastSeen+=dt;

      const toP=p.clone().sub(e.position);
      const dist=toP.length();
      const sees=dist<22 && !this.player.inVault;
      if(sees){ ud.aggro=1; ud.lastSeen=0; }
      else ud.aggro=lerp(ud.aggro,0,0.35*dt);

      ud.state = ud.aggro>0.2 ? "chase":"wander";

      if(ud.state==="wander"){
        ud.wanderT-=dt;
        if(ud.wanderT<=0){
          ud.wanderT=1.5+Math.random()*2.8;
          const a=Math.random()*Math.PI*2;
          ud.wanderDir.set(Math.cos(a),0,Math.sin(a));
        }
        e.position.addScaledVector(ud.wanderDir,ud.speed*0.25*dt);
      }else{
        if(dist>0.001) toP.normalize();
        e.position.addScaledVector(toP,ud.speed*dt);

        if(ud.kind==="crawler"){
          if(dist<1.6 && ud.atkCd<=0){ ud.atkCd=0.9; this.damagePlayer(ud.dmg); }
        }else{
          if(dist<2.0 && ud.atkCd<=0){ ud.atkCd=1.2; this.damagePlayer(ud.dmg); }
          else if(dist<12 && ud.spitCd<=0){ ud.spitCd=2.2; this.spawnSpit(e.position.clone().add(v3(0,1.1,0)), p.clone().add(v3(0,0.6,0))); }
        }
      }

      if(dist>0.001){
        const ang=Math.atan2(toP.x,toP.z);
        e.rotation.y=lerp(e.rotation.y,ang,10*dt);
      }
      e.position.y=0;
      e.position.x=clamp(e.position.x,-400,400);
      e.position.z=clamp(e.position.z,-400,400);
    }

    if(this.ui.enemybar.style.display==="block"){
      this._enemyBarT=(this._enemyBarT||0)+dt;
      if(this._enemyBarT>3.0){
        this.ui.enemybar.style.display="none";
        this.ui.enemyname.style.display="none";
        this._enemyBarT=0;
      }
    }
  }

  spawnSpit(from,to){
    const dir=to.clone().sub(from).normalize();
    const ball=new THREE.Mesh(new THREE.SphereGeometry(0.12,10,10), new THREE.MeshStandardMaterial({color:0x2aff9e,emissive:0x2aff9e,emissiveIntensity:0.6,roughness:0.6}));
    ball.position.copy(from);
    ball.userData={spit:true,vel:dir.multiplyScalar(16),life:2.0};
    this.scene.add(ball);
    this._spit.push(ball);
  }

  updateSpit(dt){
    for(let i=this._spit.length-1;i>=0;i--){
      const s=this._spit[i];
      s.userData.life-=dt;
      s.position.addScaledVector(s.userData.vel,dt);
      s.userData.vel.y-=8*dt;

      if(s.position.distanceTo(this.player.pos)<0.8){
        this.damagePlayer(8);
        this.particles.spawn(s.position.clone(),v3(rand(-2,2),2,rand(-2,2)),0.25,0.06);
        this.scene.remove(s);
        this._spit.splice(i,1);
        continue;
      }
      if(s.position.y<0.1 || s.userData.life<=0){
        this.particles.spawn(s.position.clone(),v3(rand(-1,1),1.5,rand(-1,1)),0.2,0.05);
        this.scene.remove(s);
        this._spit.splice(i,1);
      }
    }
  }

  damagePlayer(amount){
    if(this.mode!=="play") return;
    const totalArmor=this.player.armor+this.player.skills.mutantHide*5;
    const reduced=Math.max(1,amount-totalArmor*0.3);
    this.player.hp=Math.max(0,this.player.hp-reduced);
    this.audio.hurt();
    this.shakeKick(0.12);
    this.ui.showToast(`Hit! (-${Math.round(reduced)} HP)`,1.1);
    if(this.player.hp<=0) this.onPlayerDead();
  }

  onPlayerDead(){
    this.ui.showToast("You fell. The wasteland keeps what it takes.",2.8);
    this.player.hp=this.player.hpMax;
    this.player.stamina=this.player.staminaMax;
    this.player.inVault=true;
    this.vault.setVisible(true);
    this.player.pos.set(0,1.6,6);
    this.audio.startAmbient("vault");
    this.quest.step=0;
    this.quest.log=["Leave Vault 811"];
  }

  // Time of day
  updateTime(dt){
    this.save.timeOfDay=(this.save.timeOfDay+dt/360)%1;
    const t=this.save.timeOfDay;
    const ang=t*Math.PI*2;
    const y=Math.sin(ang)*70;
    const x=Math.cos(ang)*60;
    this.sun.position.set(x,Math.max(10,y+40),20);
    const night=clamp((0.25-Math.sin(ang))*0.6+0.2,0.12,0.55);
    this.scene.fog.color.setHSL(0.62,0.45,night*1.1);
    this.sky.material.color.setHSL(0.62,0.45,night*0.95);
    this.sun.intensity=1.2+(1-night)*1.0;
    this.vaultLight.intensity=this.player.inVault?2.2:0.0;
  }

  // Camera shake
  shakeKick(a){
    this.shake.amp=Math.min(0.35,this.shake.amp+a);
    this.shake.t=0.12;
  }
  updateShake(dt){
    if(this.shake.t<=0){ this.shake.amp=lerp(this.shake.amp,0,6*dt); return; }
    this.shake.t-=dt;
    const a=this.shake.amp*(this.shake.t/0.12);
    this.camera.position.x += (Math.random()*2-1)*a;
    this.camera.position.y += (Math.random()*2-1)*a;
  }

  // HUD
  renderHUD(){
    const p=this.player;
    this.ui.hpFill.style.width=`${(p.hp/p.hpMax)*100}%`;
    this.ui.stFill.style.width=`${(p.stamina/p.staminaMax)*100}%`;
    this.ui.radFill.style.width=`${(p.radiation/p.radiationMax)*100}%`;
    const xpForLevel=p.level*100;
    this.ui.xpFill.style.width=`${(p.xp/xpForLevel)*100}%`;
    this.ui.armorLbl.textContent=`Armor: ${p.armor}  Lv.${p.level}${p.skillPoints>0?" ["+p.skillPoints+" SP]":""}`;

    const w=p.weapon, id=w.id;
    this.ui.ammo.querySelector(".small").textContent=w.name;
    this.ui.ammo.querySelector(".big").textContent=`${p.mag[id]} / ${p.reserve[id]}`;

    const yaw=((p.yaw%(Math.PI*2))+Math.PI*2)%(Math.PI*2);
    const deg=Math.round(yaw*180/Math.PI);
    this.ui.comp.textContent=`Heading: ${deg}°  •  ${p.inVault?"Vault 811":"Wasteland"}`;

    // Quest objectives: prefer new questSys, fall back to legacy quest.log for backward compat
    const qObj=this.questSys.topObjective();
    this.ui.obj.textContent=qObj?`Objective: ${qObj}`:(this.quest?.log?.length?`Objective: ${this.quest.log[0]}`:"");

    // Radiation warning flash
    if(p.radiation>60){
      this.ui.radFill.style.background=`rgba(255,${Math.floor(100-p.radiation)},50,.85)`;
    }else{
      this.ui.radFill.style.background="rgba(100,255,50,.75)";
    }
  }

  _bindMouseShooting(){
    window.addEventListener("mousedown",e=>{
      if(e.button!==0) return;
      if(this.mode!=="play") return;
      if(!this.input.mouse.locked) return;
      if(this.player.weapon.fireMode==="semi") this.player.tryFire(this);
      else this.autoFire=true;
    });
    window.addEventListener("mouseup",e=>{
      if(e.button!==0) return;
      this.autoFire=false;
    });
    // Prevent context menu when right-clicking (used for ADS)
    window.addEventListener("contextmenu",e=>{
      if(this.input.mouse.locked) e.preventDefault();
    });
  }

  anyEnemyNear(r){
    const p=this.player.pos;
    for(const e of this.world.enemies.children){
      if(e.position.distanceTo(p)<r) return true;
    }
    return false;
  }

  async loop(){
    requestAnimationFrame(()=>this.loop());
    const dt=Math.min(0.033,this.clock.getDelta());

    // global hotkeys
    if(this.input.pressed("Escape")){
      if(this.mode==="play") this.showPause();
      else if(this.mode==="dialogue") this.closeDialogue();
      else if(this.mode==="pipboy") this.closePipboy();
      else if(this.mode==="pause"||this.mode==="inventory"||this.mode==="skills"||this.mode==="crafting"){ this.resume(); this.ui.inv.style.display="none"; this.ui.skillTree.style.display="none"; this.ui.craftPanel.style.display="none"; }
      else if(this.mode==="intro") this.endIntro();
    }
    if(this.input.pressed("Tab")){
      if(this.mode==="play") this.openPipboy("stat");
      else if(this.mode==="pipboy") this.closePipboy();
    }

    if(this.mode==="play"){
      // lazily start audio after any action
      if(!this.audio.started && (this.input.pressed("KeyW")||this.input.pressed("KeyA")||this.input.pressed("KeyS")||this.input.pressed("KeyD")||this.input.pressed("KeyE"))) await this.ensureAudio();

      if(this.input.pressed("KeyC")){ this.player.camMode=this.player.camMode==="fp"?"tp":"fp"; this.ui.showToast(this.player.camMode==="fp"?"First-person":"Third-person"); }
      if(this.input.pressed("Digit1")) this.player.setWeapon(0);
      if(this.input.pressed("Digit2")) this.player.setWeapon(1);
      if(this.input.pressed("Digit3")) this.player.setWeapon(2);
      if(this.input.pressed("KeyR")) this.player.requestReload(this);
      if(this.input.pressed("KeyI")) this.openPipboy("inv");
      if(this.input.pressed("KeyE")) this.doInteract();
      if(this.input.pressed("KeyK")) this.openPipboy("skills");
      if(this.input.pressed("KeyJ")) this.openPipboy("craft");

      if(this.autoFire && this.player.weapon.fireMode==="auto") this.player.tryFire(this);
    }

    // Dialogue mode: number keys to pick choices
    if(this.mode==="dialogue"){
      for(let i=1;i<=9;i++){
        if(this.input.pressed("Digit"+i)){
          this._onDialogueChoice(i-1);
          break;
        }
      }
    }

    // mode-specific updates
    if(this.mode==="intro"){
      this.vault.setVisible(true);
      this.updateTime(dt);
      this.updateCutscene(dt);
      this.renderHUD();
      this.renderer.render(this.scene,this.camera);
      return;
    }
    if(this.mode==="title"){
      this.updateTime(dt);
      this.camera.position.set(0,3.4,10);
      this.camera.lookAt(0,3.2,0);
      this.renderHUD();
      this.renderer.render(this.scene,this.camera);
      return;
    }
    if(this.mode==="pause"||this.mode==="inventory"||this.mode==="skills"||this.mode==="crafting"){
      this.updateTime(dt);
      this.renderHUD();
      this.renderer.render(this.scene,this.camera);
      return;
    }
    if(this.mode==="pipboy"){
      this.updateTime(dt);
      // Keep updating player models for smooth Pip-Boy animation
      this.player.updateModels(dt);
      this.player.updateCamera(dt,this);
      this.renderHUD();
      this.renderer.render(this.scene,this.camera);
      return;
    }
    if(this.mode==="dialogue"){
      this.updateTime(dt);
      this.npcMgr.update(dt, this.player.pos, this.dialogueCtrl.currentNpcId);
      if(!this.player.inVault) this.npcMgr.updateOutside(dt, this.player.pos);
      this.renderHUD();
      this.renderer.render(this.scene,this.camera);
      return;
    }

    // PLAY update
    this.updateTime(dt);
    this.player.update(dt,this.input,this);
    this.vault.setVisible(this.player.inVault);
    this.npcMgr.setVisible(this.player.inVault);
    this.npcMgr.setOutsideVisible(!this.player.inVault);
    this.outpost.group.visible=!this.player.inVault;

    if(!this.player.inVault){
      this.world.update(this.player.pos);
      // Biome-based fog density
      const tx=Math.floor(this.player.pos.x/this.world.tileSize);
      const tz=Math.floor(this.player.pos.z/this.world.tileSize);
      const biome=this.world.biome(tx,tz);
      const fog=this.world.fogForBiome(biome);
      this.scene.fog.near=lerp(this.scene.fog.near,fog.near,2*dt);
      this.scene.fog.far=lerp(this.scene.fog.far,fog.far,2*dt);

      // Update outside NPCs
      this.npcMgr.updateOutside(dt, this.player.pos);

      // --- Outpost discover trigger (cached position, no scene scan) ---
      if(!this.questSys.getFlag("discoveredOutpost")){
        const pp=this.player.pos;
        const dx=pp.x-OUTPOST_CENTER.x, dz=pp.z-OUTPOST_CENTER.z;
        if(dx*dx+dz*dz<OUTPOST_DISCOVER_RADIUS*OUTPOST_DISCOVER_RADIUS){
          this.questSys.setFlag("discoveredOutpost",true);
          this.questSys.setFlag("discoveredShrineOutpost",true);
          this.questSys.advanceStage("q5_outpost_accord",0);
          this.questSys.addObjective("Talk to Warden Aoi at the Shrine Outpost");
          this.questSys.addLog("Discovered the Shrine Outpost — a safe settlement near the torii gate.");
          this.ui.showToast("Discovered: Shrine Outpost",3.0);
        }
      }

      // --- Rail station discover trigger (cached position, no scene scan) ---
      if(!this.questSys.getFlag("discoveredRailContact")){
        const pp=this.player.pos;
        const dx=pp.x-RAIL_STATION_CENTER.x, dz=pp.z-RAIL_STATION_CENTER.z;
        if(dx*dx+dz*dz<RAIL_DISCOVER_RADIUS*RAIL_DISCOVER_RADIUS){
          this.questSys.setFlag("discoveredRailContact",true);
          this.questSys.addLog("A figure lurks near the collapsed rail station. Could be a contact.");
          this.ui.showToast("Someone is nearby... a Rail Ghost contact?",3.0);
        }
      }

      // --- Safe zone enforcement (every 3 seconds, not every frame) ---
      this._safeZoneTimer=(this._safeZoneTimer||0)+dt;
      if(this._safeZoneTimer>SAFE_ZONE_CHECK_INTERVAL){
        this._safeZoneTimer=0;
        enforceSafeZone(this.world.enemies);
      }

      // World trigger: torii proximity (Q4 Shrine Warden Warning)
      const TORII_TRIGGER_RADIUS=30;
      if(!this.questSys.getFlag("reachedTorii")){
        this._toriiCheckTimer=(this._toriiCheckTimer||0)+dt;
        if(this._toriiCheckTimer>2.0){ // check every 2 seconds, not every frame
          this._toriiCheckTimer=0;
          const pp=this.player.pos;
          for(const [,tile] of this.world.tiles){
            tile.g.traverse(child=>{
              if(child.userData?.poi==="Silent Torii" && !this.questSys.getFlag("reachedTorii")){
                const wp=new THREE.Vector3();
                child.getWorldPosition(wp);
                const dx=pp.x-wp.x, dz=pp.z-wp.z;
                if(dx*dx+dz*dz<TORII_TRIGGER_RADIUS*TORII_TRIGGER_RADIUS){
                  this.questSys.setFlag("reachedTorii",true);
                  this.questSys.addObjective("Heed the Shrine Warden warning");
                  this.questSys.addLog("Reached a torii gate. The Shrine Wardens are watching.");
                  this.questSys.setStage("q4_shrine_warning",10);
                  this.questSys.changeRep("wardens",-5);
                  this.ui.showToast("The air feels heavy near the torii. You are being watched.",3.0);
                }
              }
            });
          }
        }
      }

      // World trigger: rail station proximity (for Q3)
      const RAIL_TRIGGER_RADIUS=35;
      if(this.questSys.getStage("q3_rail_whisper")>=10 && !this.questSys.getFlag("reachedRailStation")){
        this._railCheckTimer=(this._railCheckTimer||0)+dt;
        if(this._railCheckTimer>2.0){
          this._railCheckTimer=0;
          const pp=this.player.pos;
          for(const [,tile] of this.world.tiles){
            tile.g.traverse(child=>{
              if((child.userData?.poi==="Collapsed Rail Station"||child.userData?.poi==="Destroyed Railway") && !this.questSys.getFlag("reachedRailStation")){
                const wp=new THREE.Vector3();
                child.getWorldPosition(wp);
                const dx=pp.x-wp.x, dz=pp.z-wp.z;
                if(dx*dx+dz*dz<RAIL_TRIGGER_RADIUS*RAIL_TRIGGER_RADIUS){
                  this.questSys.setFlag("reachedRailStation",true);
                  this.questSys.completeObjective("Investigate radio signals near the rail stations");
                  this.questSys.addObjective("Report findings to Guard Kenji");
                  this.questSys.addLog("Reached a rail station. Faint coded radio pings detected — the Rail Ghost Union is here.");
                  this.questSys.setStage("q3_rail_whisper",20);
                  this.ui.showToast("Radio static crackles. Coded pings echo in the tunnels. Someone is out here.",3.0);
                }
              }
            });
          }
        }
      }
    }

    // Vault door animation
    if(this._doorAnim){
      this._doorAnim.t+=dt;
      const progress=clamp(this._doorAnim.t/this._doorAnim.dur,0,1);
      const ease=1-Math.pow(1-progress,3);
      this.vault.door.rotation.y=ease*Math.PI*0.5;
      this.vault.door.position.x=-ease*3;
      if(progress>=1){
        this._doorAnim=null;
        this._completeExitVault();
      }
    }

    this.updateInteract();
    if(this.player.inVault) this.npcMgr.update(dt, this.player.pos, null);
    if(!this.player.inVault) this.updateEnemies(dt);
    this.updateSpit(dt);
    this.particles.update(dt);
    this.updateShake(dt);

    // Fade reveal light
    if(this._revealTimer!==undefined && this._revealTimer>0){
      this._revealTimer-=dt;
      if(this._revealLight) this._revealLight.intensity=3.0*(this._revealTimer/3.0);
      if(this._revealTimer<=0 && this._revealLight){
        this.scene.remove(this._revealLight);
        this._revealLight=null;
      }
    }

    // regen only when safe outside
    if(!this.player.inVault && !this.anyEnemyNear(14)){
      this.player.hp=Math.min(this.player.hpMax,this.player.hp+3.5*dt);
    }

    this.renderHUD();
    this.renderer.render(this.scene,this.camera);
  }

  updateCutscene(dt){
    const step=this.cutscene.step;
    const line=this.cutscene.lines[step];
    this.cutscene.t+=dt;

    const cam=this.camera;
    cam.rotation.order="YXZ";
    const t=this.cutscene.t;
    if(step<4){
      const ang=0.4+step*0.22+Math.sin(t*0.25)*0.1;
      cam.position.set(Math.sin(ang)*6,3.2+Math.sin(t*0.2)*0.2,Math.cos(ang)*6);
      cam.lookAt(0,3.3,0);
    }else{
      const z=lerp(0,9.5,clamp((t-1.0)/4.5,0,1));
      cam.position.set(0.5,3.0,6+z);
      cam.lookAt(0,3.2,13.5);
    }

    if(this.input.pressed("Escape")){ this.endIntro(); return; }
    if(this.input.down("Enter")){
      this.cutscene.hold+=dt;
      if(this.cutscene.hold>1.0){ this.endIntro(); return; }
    }else this.cutscene.hold=0;

    if(this.cutscene.t>=line.d){
      this.cutscene.step++;
      this.cutscene.t=0;
      if(this.cutscene.step>=this.cutscene.lines.length) this.endIntro();
      else this.updateCutUI();
    }
  }
}

// Boot
const game=new Game();

// Start audio on first gesture (optional)
window.addEventListener("click", async ()=>{
  await game.ensureAudio();
}, {once:true});
