// Wasteland Japan — Vault 811 (browser vertical slice)
// Three.js via CDN. No paid APIs. Placeholder geometry + WebAudio SFX.
// Runs best from a local server (ES modules).

import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.159.0/build/three.module.js";
import * as SkeletonUtils from "https://cdn.jsdelivr.net/npm/three@0.159.0/examples/jsm/utils/SkeletonUtils.js";
import { NPCManager } from "./npc.js";
import { DialogueController } from "./dialogue.js";
import { DIALOGUE_CSS, buildDialogueUI, renderDialogueNode } from "./dialogueUI.js";
import { Quest } from "./quest.js";
import { attemptLockpick, isUnlocked, lockHintLabel } from "./locks.js";
import { TERMINAL_CSS, TerminalDefs, buildTerminalUI, renderTerminal, closeTerminal } from "./terminal.js";
import { buildOutpost, OUTPOST_CENTER, OUTPOST_SAFE_RADIUS, OUTPOST_DISCOVER_RADIUS, OUTPOST_KILL_RADIUS, SAFE_ZONE_CHECK_INTERVAL, RAIL_STATION_CENTER, RAIL_DISCOVER_RADIUS, isInSafeZone, enforceSafeZone, isOutpostHostile, isOutpostRecovered, applyHostileVisuals, applyNeutralVisuals } from "./outpost.js";
import { PIPBOY_CSS, buildPipboyUI, openPipboy as pipboyOpen, closePipboy as pipboyClose, renderPipboy as pipboyRender } from "./pipboyUI.js";
import { DungeonManager, DungeonDefs } from "./dungeon.js";
import { CompanionManager, CompanionDefs } from "./companion.js";
import { HeightmapTerrain, MAP_SIZE, MAP_HALF, HEIGHT_SCALE } from "./terrain.js";
import { Worldspace } from "./worldspace.js";
import { FactionWorld, FACTIONS, FACTION_POIS } from "./factionWorld.js";
import { AssetManager } from "./engine/AssetManager.js";
import { AssetRegistry } from "./engine/AssetRegistry.js";
import { PropFactory } from "./game/world/PropFactory.js";
import { WorldPropDefs } from "./game/assets/worldProps.js";
import { Editor } from "./editor.js";

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
    ${PIPBOY_CSS}
    ${DIALOGUE_CSS}
    ${TERMINAL_CSS}
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

  // Pip-Boy overlay (built by pipboyUI module)
  const pipUI=buildPipboyUI(root);

  const dlg=buildDialogueUI(root);
  const term=buildTerminalUI(root);

  const wm=el("div","wm",hud); wm.textContent="Wasteland Japan — Vault 811";

  function showToast(msg, sec=2.2){
    toast.textContent=msg; toast.classList.add("on");
    clearTimeout(showToast._t);
    showToast._t=setTimeout(()=>toast.classList.remove("on"), sec*1000);
  }

  return {root,hud,hpFill,stFill,radFill,xpFill,armorLbl,comp,ammo,hint,obj,toast,showToast,scrim,menuTitle:h1,menuDesc:p,btns,inv,invTitle,invSub,invList,panel,invClose,cut,cutT,cutB,cutS,enemybar,ebFill,enemyname,skillTree,craftPanel,pipUI,dlg,term};
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
    window.addEventListener("keydown",e=>{ if(e.code==="Tab"||e.code==="F8"||e.code==="F9"||e.code==="F10") e.preventDefault(); if(!this.keys.get(e.code)) this.just.add(e.code); this.keys.set(e.code,true);});
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
      inv:[{id:"stim",qty:1},{id:"ration",qty:1},{id:"scrap",qty:2},{id:"pistol",qty:1},{id:"rifle",qty:1},{id:"shotgun",qty:1},{id:"katana",qty:1}],
      maxWeight:55,
      radiation:0,armor:0,xp:0,level:1,skillPoints:0,
      skills:{toughness:0,quickHands:0,scavenger:0,ironSights:0,mutantHide:0}
    },
    world:{seed:811, useHeightmap:true, quest:{step:0,log:["Leave Vault 811"]}, questSys:{stages:{},flags:{},objectives:[],log:[],rep:{vault:0,wardens:0,rail:0},heat:{wardens:0,rail:0}}}
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
  radaway:{id:"radaway",name:"Rad-Away",type:"consumable",weight:0.6,desc:"Removes 20 radiation."},
  scrap:{id:"scrap",name:"Scrap Metal",type:"junk",weight:2.0,desc:"Old world leftovers."},
  cloth:{id:"cloth",name:"Tattered Cloth",type:"junk",weight:0.5,desc:"Useful for crafting."},
  circuits:{id:"circuits",name:"Circuit Board",type:"junk",weight:0.8,desc:"Pre-war electronics."},
  pistol:{id:"pistol",name:"Type-11 Pistol",type:"weapon",weight:2.4,desc:"Reliable. Loud."},
  rifle:{id:"rifle",name:"Kurokawa Rifle",type:"weapon",weight:4.9,desc:"Automatic. Hungry."},
  shotgun:{id:"shotgun",name:"Shrine-Breaker",type:"weapon",weight:5.6,desc:"Close-range sermon."},
  katana:{id:"katana",name:"Ronin's Katana",type:"weapon",weight:3.2,desc:"A pre-war blade, still sharp."},
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
  {id:"katana",name:"Ronin's Katana",fireMode:"melee",rpm:90,magSize:Infinity,spread:0,damage:38,range:3.5,recoil:{kick:0.04,ret:12.0}},
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
  toughness:{name:"Toughness",desc:"+15 max HP per Toughness point",maxLvl:5},
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
  constructor(scene, seed=811, propFactory=null){
    this.scene=scene; this.seed=seed;
    this.propFactory=propFactory;
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
    this._tileCallbacks=[];
  }
  addTileCallback(cb){ this._tileCallbacks.push(cb); }
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
    const isCenter=tx===0&&tz===0;
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

    // instanced grass (reduced counts for performance)
    const grassCount=biome===0?50:120;
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
    const rockCount=biome===2?12:8;
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

    // POI (skip center tile — vault occupies that space)
    if(!isCenter && rng()<0.35){
      let poi;
      if(biome===1){
        const variant=rng();
        if(variant<0.33) poi=this.makeTorii(rng);
        else if(variant<0.66) poi=this.makeShrine(rng);
        else poi=this.makeStoneLantern(rng);
      }else if(biome===0){
        const cityVariant=rng();
        if(cityVariant<0.3){
          // IRON_SHACK — try real model, fallback to primitive
          poi=this._spawnProp("ironShack","Iron Shack",rng);
          if(!poi) poi=this.makeStation(rng);
        }else if(cityVariant<0.55){
          // ROAD_SIGNS — try real model, fallback to primitive
          poi=this._spawnProp("roadSigns","Road Signs",rng);
          if(!poi) poi=this.makeStation(rng);
        }else{
          poi=this.makeStation(rng);
        }
      }else{
        const indVariant=rng();
        if(indVariant<0.3){
          poi=this._spawnProp("ironShack","Iron Shack",rng);
          if(!poi) poi=this.makeIndustrial(rng);
        }else{
          poi=this.makeIndustrial(rng);
        }
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
    if(!isCenter){
      const n=rng()<0.7?Math.floor(1+rng()*(biome===0?3:2)):0;
      for(let i=0;i<n;i++){
        const kind=rng()<0.55?"crawler":"stalker";
        const e=this.makeEnemy(kind);
        // Position in world space (tile offset + local offset)
        const wx=tx*this.tileSize+(rng()-0.5)*this.tileSize*0.75;
        const wz=tz*this.tileSize+(rng()-0.5)*this.tileSize*0.75;
        e.position.set(wx,0,wz);
        this.enemies.add(e);
        enemies.push(e);
      }
    }

    this.tiles.set(k,{g,tx,tz,biome,interactables,enemies});
    this.static.add(g);
    for(const cb of this._tileCallbacks) if(cb.onCreated) cb.onCreated(k,g,biome,tx,tz);
  }
  disposeTile(k){
    const t=this.tiles.get(k); if(!t) return;
    for(const cb of this._tileCallbacks) if(cb.onDisposed) cb.onDisposed(k);
    for(const c of t.interactables) this.interact.remove(c);
    for(const e of t.enemies) this.enemies.remove(e);
    // Dispose geometries and materials to free GPU memory
    t.g.traverse(o=>{
      if(o.isMesh){
        if(o.geometry && !o.geometry._shared) o.geometry.dispose();
      }
    });
    this.static.remove(t.g);
    this.tiles.delete(k);
  }
  makeCrate(rng,biome){
    const m=new THREE.Mesh(new THREE.BoxGeometry(1.1,1.0,1.1), biome===0?this.matRust:this.matWood);
    const ud={interact:true,kind:"container",opened:false,name:biome===0?"Locker":"Crate"};
    // ~30% of crates/lockers are locked with a random lock level 1–3
    if(rng()<0.30){
      const lvl=Math.floor(1+rng()*3); // 1–3
      const uid=`crate_${Date.now()}_${Math.floor(rng()*100000)}`;
      ud.lockId=uid;
      ud.lockLevel=lvl;
      ud.name=(biome===0?"Locked Locker":"Locked Crate");
    }
    m.userData=ud;
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
  _spawnProp(key,poiLabel,rng){
    if(!this.propFactory) return null;
    const model=this.propFactory.spawn(key);
    if(!model) return null;
    const def=WorldPropDefs[key];
    const g=new THREE.Group();
    g.userData.poi=poiLabel;
    g.add(model);
    if(def&&def.yOffset) model.position.y+=def.yOffset;
    g.position.set((rng()-0.5)*20,0,(rng()-0.5)*20);
    g.rotation.y=(def&&def.rotationY?def.rotationY:0)+rng()*Math.PI*2;
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
    this.buildExterior();
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
    console.userData={interact:true,kind:"terminal",name:"Terminal",terminalId:"vault_terminal"};
    console.castShadow=true;
    this.group.add(console);

    const locker=new THREE.Mesh(new THREE.BoxGeometry(1.2,2.8,1.0),this.matDoor);
    locker.position.set(12,1.4,4);
    locker.userData={interact:true,kind:"container",opened:false,name:"Armory Locker",lockId:"armory_locker",lockLevel:2};
    locker.castShadow=true;
    this.group.add(locker);

    for(let i=-2;i<=2;i++){
      const l=new THREE.Mesh(new THREE.BoxGeometry(1.6,0.2,0.6),this.matLight);
      l.position.set(i*6,7.7,0);
      this.group.add(l);
    }
  }
  buildExterior(){
    // Vault exterior structure visible when player is outside
    this.exterior=new THREE.Group();
    this.scene.add(this.exterior);
    this.exterior.visible=false;

    const matBunker=new THREE.MeshStandardMaterial({color:0x2c394f,roughness:0.75,metalness:0.15});
    const matConcrete=new THREE.MeshStandardMaterial({color:0x1c2230,roughness:0.9});
    const matRust=new THREE.MeshStandardMaterial({color:0x5d3b2a,roughness:1,metalness:0.05});
    const matSign=new THREE.MeshStandardMaterial({color:0x9bd3ff,emissive:0x9bd3ff,emissiveIntensity:0.5,roughness:0.4});

    // Main bunker mound (half-buried vault entrance)
    const mound=new THREE.Mesh(new THREE.BoxGeometry(14,5,10),matConcrete);
    mound.position.set(0,2.5,14);
    mound.castShadow=true; mound.receiveShadow=true;
    this.exterior.add(mound);

    // Sloped top
    const slopeTop=new THREE.Mesh(new THREE.BoxGeometry(16,1,12),matConcrete);
    slopeTop.position.set(0,5.2,14);
    slopeTop.rotation.x=-0.15;
    slopeTop.castShadow=true; slopeTop.receiveShadow=true;
    this.exterior.add(slopeTop);

    // Door frame
    const doorFrame=new THREE.Mesh(new THREE.BoxGeometry(6,5,1.5),matBunker);
    doorFrame.position.set(0,2.5,9.2);
    doorFrame.castShadow=true;
    this.exterior.add(doorFrame);

    // Vault entrance door (interactable)
    const extDoor=new THREE.Mesh(new THREE.CylinderGeometry(2.2,2.2,0.7,16),matBunker);
    extDoor.rotation.x=Math.PI/2;
    extDoor.position.set(0,2.5,8.5);
    extDoor.userData={interact:true,kind:"vaultEntryDoor",name:"Vault 811 Entrance"};
    extDoor.castShadow=true;
    this.extDoor=extDoor;
    this.exterior.add(extDoor);

    // "811" sign above entrance
    const sign=new THREE.Mesh(new THREE.BoxGeometry(3,0.6,0.15),matSign);
    sign.position.set(0,5.0,8.8);
    this.exterior.add(sign);

    // Side pipes/vents
    for(const sx of [-5,5]){
      const pipe=new THREE.Mesh(new THREE.CylinderGeometry(0.3,0.3,3,8),matRust);
      pipe.position.set(sx,4.5,14);
      pipe.castShadow=true;
      this.exterior.add(pipe);
    }

    // Ground pad
    const pad=new THREE.Mesh(new THREE.PlaneGeometry(20,14),matConcrete);
    pad.rotation.x=-Math.PI/2;
    pad.position.set(0,0.02,16);
    pad.receiveShadow=true;
    this.exterior.add(pad);

    // Barricades around entrance
    const barricade1=new THREE.Mesh(new THREE.BoxGeometry(2,1.5,4),matRust);
    barricade1.position.set(-6,0.75,12);
    barricade1.castShadow=true;
    this.exterior.add(barricade1);
    const barricade2=new THREE.Mesh(new THREE.BoxGeometry(2,1.5,4),matRust);
    barricade2.position.set(6,0.75,12);
    barricade2.castShadow=true;
    this.exterior.add(barricade2);
  }
  setVisible(v){this.group.visible=v;}
  setExteriorVisible(v){this.exterior.visible=v;}
}

// ---------------- HP helpers ----------------
function computeHpMax(player){
  return 100 + (player.level - 1) * 5 + player.skills.toughness * 15;
}

// Regression test (run via console: _testHpMax())
function _testHpMax(){
  const p={level:1,skills:{toughness:0},hp:100,hpMax:100};
  let pass=true;
  function check(label,actual,expected){
    const ok=actual===expected;
    if(!ok) pass=false;
    console.log(`${ok?"✓":"✗"} ${label}: got ${actual}, expected ${expected}`);
  }
  // Level up 3 times with toughness 0
  for(let i=0;i<3;i++){p.level++;p.hpMax=computeHpMax(p);p.hp=Math.min(p.hp,p.hpMax);}
  check("hpMax after 3 level-ups (lv4, t0)",p.hpMax,115);
  const hpBefore=p.hpMax;
  // Increase toughness by 1
  p.skills.toughness++;p.hpMax=computeHpMax(p);p.hp=Math.min(p.hp,p.hpMax);
  check("hpMax after toughness +1 (lv4, t1)",p.hpMax,130);
  check("hpMax did not drop",p.hpMax>=hpBefore,true);
  check("hp <= hpMax",p.hp<=p.hpMax,true);
  console.log(pass?"All hpMax tests passed.":"Some hpMax tests FAILED.");
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
    this.inv=[{id:"stim",qty:1},{id:"ration",qty:1},{id:"scrap",qty:2},{id:"pistol",qty:1},{id:"rifle",qty:1},{id:"shotgun",qty:1},{id:"katana",qty:1}];
    this.maxWeight=55;
    this.inVault=true;
    this.stepT=0;

    // Deep systems
    this.radiation=0; this.radiationMax=100;
    this.armor=0;
    this.armorEquipped=null; // itemId or null
    this.xp=0; this.level=1; this.skillPoints=0;
    this.skills={toughness:0,quickHands:0,scavenger:0,ironSights:0,mutantHide:0};
    this._lastRadThreshold=0; // for toast tracking

    // Third-person model (placeholder until GLB loaded)
    this.model=this._buildModel();
    this.model.visible=false;

    // Character animation system (populated when GLB loads)
    this._mixer=null;          // THREE.AnimationMixer
    this._actions={};          // { idle, walking, running, run03, attack, skill03, dead, crouch }
    this._currentAction=null;  // currently playing AnimationAction
    this._prevAnimState="";    // track state to avoid redundant crossfades
    this._charModelReady=false; // true once GLB model is applied

    // First-person dedicated arms — populated by Game._loadFPArms() (Player_Arms.fbx)
    this._fpArms=null;         // THREE.Group containing the FP arms mesh (layer 1)
    this._fpArmsModel=null;    // The loaded FBX model inside the group

    // First-person weapon view model (layer 1 = FP-only pass)
    this.fpWeapon=this._buildFPWeapon();
    this.fpWeapon.traverse(c=>c.layers.set(1));
    this.camera.add(this.fpWeapon);
    this._updateFPWeapon();

    // Muzzle flash
    this.muzzleFlash=this._buildMuzzleFlash();
    this.muzzleFlash.traverse(c=>c.layers.set(1));
    this.fpWeapon.add(this.muzzleFlash);
    this.muzzleFlashTimer=0;

    // Weapon bob/recoil animation state
    this.weaponBob=0;
    this.weaponKick=0;
    this.weaponKickReturn=0;

    // Pip-Boy (first-person arm + device attached to camera, layer 1 = FP-only pass)
    this.fpPipboy=this._buildFPPipboy();
    this.fpPipboy.traverse(c=>c.layers.set(1));
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
    // iron sight post (small nub on top of barrel end)
    const sightMat=new THREE.MeshStandardMaterial({color:0x1a1a1a,roughness:0.5,metalness:0.5});
    const frontSight=new THREE.Mesh(new THREE.BoxGeometry(0.008,0.02,0.008),sightMat);
    frontSight.position.set(0,0.035,0.44);
    const rearSight=new THREE.Mesh(new THREE.BoxGeometry(0.03,0.015,0.008),sightMat);
    rearSight.position.set(0,0.035,0.05);
    g.add(barrel,body,grip,frontSight,rearSight);
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
    g.add(pbBody,pbScreen,pbGlow);
    // Stowed position (below and off-screen to the left)
    g.position.set(-0.35,-0.55,-0.35);
    g.rotation.set(0.2,0.3,0);
    g.visible=true;
    return g;
  }

  /**
   * Apply the loaded Meshy AI character GLB model to the player.
   * Replaces the procedural placeholder with a rigged, animated 3D model.
   * @param {THREE.Group} charScene   The base character scene from GLB
   * @param {object}      animClips   { idle, walking, running, run03, attack, skill03, dead } AnimationClip arrays
   */
  applyCharacterModel(charScene, animClips){
    // --- Third-person character model ---
    const oldModel=this.model;
    const wasVisible=oldModel.visible;
    const oldParent=oldModel.parent;

    // Clone the character scene so we have a clean copy for TP
    // Use SkeletonUtils.clone to properly clone SkinnedMesh with independent skeleton
    const tpModel=SkeletonUtils.clone(charScene);

    // Ensure world matrices are up-to-date before measuring bounding box
    tpModel.updateMatrixWorld(true);

    // Auto-scale: measure bounding box, target ~1.75m tall
    const box=new THREE.Box3().setFromObject(tpModel);
    const size=new THREE.Vector3();
    box.getSize(size);
    const targetHeight=1.75;
    const charScale=targetHeight/Math.max(size.y,0.01);
    tpModel.scale.setScalar(charScale);

    // Rotate model 180° so it faces forward (away from camera in TP view)
    tpModel.rotation.y=Math.PI;

    // Recompute bounding box after scale
    box.setFromObject(tpModel);
    const center=new THREE.Vector3();
    box.getCenter(center);
    // Offset so the model's feet are at y=0 of the group
    tpModel.position.y=-box.min.y;
    tpModel.position.x=-center.x;
    tpModel.position.z=-center.z;

    // Wrap in a group for positioning (same API as old model)
    const wrapper=new THREE.Group();
    wrapper.add(tpModel);

    // Enable shadows on all meshes, optimize materials
    // Clone each material so we don't mutate the shared original.
    // Force full opacity (Meshy AI GLBs sometimes export alphaMode=BLEND) and
    // set needsUpdate so Three.js re-uploads textures/uniforms after the clone.
    tpModel.traverse(child=>{
      if(child.isMesh){
        child.castShadow=true;
        child.receiveShadow=false;
        child.frustumCulled=true;
        if(child.material){
          const srcMats=Array.isArray(child.material)?child.material:[child.material];
          const cloned=srcMats.map(m=>{
            const c=m.clone();
            c.side=THREE.FrontSide;
            // Force fully opaque — Meshy AI sometimes exports with transparent=true
            c.transparent=false;
            c.opacity=1.0;
            c.alphaTest=0;
            c.depthWrite=true;
            c.needsUpdate=true;
            return c;
          });
          child.material=cloned.length===1?cloned[0]:cloned;
        }
      }
    });

    // Re-create arm pivots on wrapper for TP weapon attachment
    // Try to find actual hand bones in the skeleton for accurate placement
    let rightHandBone=null, leftHandBone=null;
    tpModel.traverse(child=>{
      if(child.isBone){
        const n=child.name.toLowerCase();
        if(!rightHandBone && (n.includes("righthand")||n.includes("right_hand")||n.includes("r_hand")||n.includes("hand_r")||n.includes("hand.r")))
          rightHandBone=child;
        if(!leftHandBone && (n.includes("lefthand")||n.includes("left_hand")||n.includes("l_hand")||n.includes("hand_l")||n.includes("hand.l")))
          leftHandBone=child;
      }
    });

    const armRPivot=new THREE.Group();
    const armLPivot=new THREE.Group();
    if(rightHandBone){
      rightHandBone.add(armRPivot);
      console.log("[Player] TP weapon attached to bone:", rightHandBone.name);
    }else{
      armRPivot.position.set(0.35,1.25,0); // fallback approximate shoulder position
      wrapper.add(armRPivot);
    }
    if(leftHandBone){
      leftHandBone.add(armLPivot);
    }else{
      armLPivot.position.set(-0.35,1.25,0);
      wrapper.add(armLPivot);
    }

    // Migrate TP weapon from old pivot to new
    if(this.tpWeapon && this._armRPivot){
      this._armRPivot.remove(this.tpWeapon);
      armRPivot.add(this.tpWeapon);
    }

    this._armRPivot=armRPivot;
    this._armLPivot=armLPivot;

    // Swap in the scene
    wrapper.visible=wasVisible;
    wrapper.position.copy(oldModel.position);
    wrapper.rotation.copy(oldModel.rotation);
    if(oldParent){
      oldParent.remove(oldModel);
      oldParent.add(wrapper);
    }
    // Dispose old procedural geometry/materials
    oldModel.traverse(child=>{
      if(child.isMesh){
        if(child.geometry) child.geometry.dispose();
        if(child.material){
          if(Array.isArray(child.material)) child.material.forEach(m=>m.dispose());
          else child.material.dispose();
        }
      }
    });
    this.model=wrapper;
    this._tpCharModel=tpModel; // reference for animation

    // --- Animation Mixer (third-person) ---
    this._mixer=new THREE.AnimationMixer(tpModel);
    this._actions={};

    // Helper to extract the first AnimationClip from a loaded GLTF result
    const addClip=(name, clips, loopMode)=>{
      if(!clips||clips.length===0) return;
      const clip=clips[0];
      clip.name=name; // normalize name
      const action=this._mixer.clipAction(clip);
      action.clampWhenFinished=true;
      if(loopMode!==undefined) action.loop=loopMode;
      this._actions[name]=action;
    };

    addClip("idle",    animClips.idle,    THREE.LoopRepeat);
    addClip("walking", animClips.walking, THREE.LoopRepeat);
    addClip("running", animClips.running, THREE.LoopRepeat);
    addClip("run03",   animClips.run03,   THREE.LoopRepeat);
    addClip("attack",  animClips.attack,  THREE.LoopOnce);
    addClip("skill03", animClips.skill03, THREE.LoopOnce);
    addClip("dead",    animClips.dead,    THREE.LoopOnce);

    // Synthesize a crouch animation from idle (scaled & lowered)
    if(this._actions.idle){
      const idleClip=this._actions.idle.getClip();
      const crouchClip=idleClip.clone();
      crouchClip.name="crouch";
      const crouchAction=this._mixer.clipAction(crouchClip);
      crouchAction.clampWhenFinished=true;
      crouchAction.loop=THREE.LoopRepeat;
      crouchAction.timeScale=0.7; // slightly slower for crouched idle
      this._actions.crouch=crouchAction;
    }

    // Start with idle
    if(this._actions.idle){
      this._actions.idle.play();
      this._currentAction=this._actions.idle;
      this._prevAnimState="idle";
    }

    // NOTE: First-person arms are now a dedicated model (Player_Arms.fbx) loaded by
    // Game._loadFPArms().  The character-model clone approach has been replaced.

    this._charModelReady=true;
    console.log("[Player] Character model applied. Scale="+charScale.toFixed(4)+", animations:", Object.keys(this._actions).join(", "));
  }

  /**
   * Add an animation clip to the character model after it has been applied.
   * This allows animations to be loaded incrementally without blocking model display.
   * @param {string} name     Animation name (e.g. "walking", "running")
   * @param {THREE.AnimationClip[]} clips  Array of clips from the loaded GLB
   * @param {number} [loopMode]  THREE.LoopRepeat or THREE.LoopOnce
   */
  addAnimationClip(name, clips, loopMode){
    if(!this._charModelReady||!this._mixer) return;
    if(!clips||clips.length===0) return;
    if(this._actions[name]) return; // already registered
    const clip=clips[0];
    clip.name=name;
    const action=this._mixer.clipAction(clip);
    action.clampWhenFinished=true;
    if(loopMode!==undefined) action.loop=loopMode;
    this._actions[name]=action;

    // Synthesize crouch from idle when idle is added late
    if(name==="idle" && !this._actions.crouch){
      const crouchClip=clip.clone();
      crouchClip.name="crouch";
      const crouchAction=this._mixer.clipAction(crouchClip);
      crouchAction.clampWhenFinished=true;
      crouchAction.loop=THREE.LoopRepeat;
      crouchAction.timeScale=0.7;
      this._actions.crouch=crouchAction;
    }

    // If this is idle and nothing is playing yet, start it
    if(name==="idle" && !this._currentAction){
      action.play();
      this._currentAction=action;
      this._prevAnimState="idle";
    }

  }

  /**
   * @deprecated Replaced by Game._loadFPArms() which loads a dedicated Player_Arms.fbx.
   * This stub is intentionally empty — the method is no longer called.
   */
  _buildFPArmsFromModel(_charScene, _animClips){
    // No-op: dedicated FP arms model loaded by Game._loadFPArms().
  }


  /**
   * Update character animation state based on player movement/actions.
   * Called each frame from updateModels().
   */
  _updateCharacterAnimation(dt){
    if(!this._charModelReady||!this._mixer) return;

    // Determine desired animation state
    const planar=Math.hypot(this.vel.x,this.vel.z);
    const isDead=this.hp<=0;
    let desired="idle";

    if(isDead){
      desired="dead";
    }else if(this.crouch>0.5){
      desired="crouch";
    }else if(planar>3.5){
      desired="running";
    }else if(planar>0.5){
      desired="walking";
    }

    // Handle attack/skill animations (one-shot, triggered externally)
    if(this._playingAttack) desired=this._attackAnimName||"attack";

    // Crossfade to new animation if state changed
    if(desired!==this._prevAnimState && this._actions[desired]){
      const newAction=this._actions[desired];
      const oldAction=this._currentAction;

      if(oldAction && oldAction!==newAction){
        newAction.reset();
        newAction.play();
        oldAction.crossFadeTo(newAction,0.25,true);
      }else{
        newAction.reset();
        newAction.play();
      }

      this._currentAction=newAction;
      this._prevAnimState=desired;

      // If attack or skill03 finished, return to previous state
      if(desired==="attack"||desired==="skill03"||desired==="dead"){
        if(desired!=="dead"){
          newAction.clampWhenFinished=false;
          const onFinish=()=>{
            this._playingAttack=false;
            this._mixer.removeEventListener("finished",onFinish);
          };
          this._mixer.addEventListener("finished",onFinish);
        }
      }
    }

    // Apply crouch visual: scale the model's Y slightly when crouching
    if(this._tpCharModel && !isDead){
      const crouchScale=1.0-this.crouch*0.25;
      this._tpCharModel.scale.y=this._tpCharModel.scale.x*crouchScale;
    }

    // Update animation mixer
    this._mixer.update(dt);

  }

  /**
   * Trigger an attack animation (called when firing melee weapon).
   * @param {string} animName  "attack" or "skill03"
   */
  playAttackAnimation(animName){
    if(!this._charModelReady) return;
    this._playingAttack=true;
    this._attackAnimName=animName||"attack";
    this._prevAnimState=""; // force crossfade
    this._prevFPAnimState=""; // force FP crossfade too
  }
  weight(){return invWeight(this.inv);}
  effectiveMaxHP(){
    // Radiation reduces max HP: at 100 rad => -50%. Floor at 35% of base hpMax.
    const factor=1-this.radiation*0.005;
    return Math.max(this.hpMax*0.35, Math.round(this.hpMax*factor));
  }
  armorReduction(dmg){
    // Armor reduces incoming damage: at 100 armor => 40% reduction. Clamp max 45%.
    const totalArmor=this.armor+this.skills.mutantHide*5;
    const reduction=clamp(totalArmor*0.006,0,0.45);
    return Math.max(1, dmg*(1-reduction));
  }
  setWeapon(i){
    this.equipped=clamp(i,0,WeaponDefs.length-1);
    this.weapon=WeaponDefs[this.equipped];
    this._updateFPWeapon();
  }
  _updateFPWeapon(){
    if(!this.fpWeapon) return;
    const id=this.weapon.id;
    const isMelee=this.weapon.fireMode==="melee";
    const barrel=this.fpWeapon.children[0];
    const body=this.fpWeapon.children[1];

    // Toggle muzzle-flash child visibility (index 6 = muzzle flash group)
    if(this.muzzleFlash) this.muzzleFlash.visible=false;

    // Show/hide FBX katana model when loaded
    if(this._fpKatanaModel) this._fpKatanaModel.visible=isMelee;
    // Show/hide placeholder geometry (barrel, body, grip, hand, sights)
    for(let i=0;i<this.fpWeapon.children.length;i++){
      const c=this.fpWeapon.children[i];
      if(c===this._fpKatanaModel||c===this.muzzleFlash) continue;
      c.visible=!isMelee||!this._fpKatanaModel;
    }

    // Weapon positions are relative to the camera and tuned to sit in the right hand
    // of the dedicated FP arms model (Player_Arms.fbx) centred at (0, -0.30, -0.40).
    // x > 0  = right side (right hand grip)
    // y ≈ -0.30 to -0.34 = matches arm height
    // z ≈ -0.38 to -0.43 = same depth plane as the arms
    if(id==="katana"){
      barrel.scale.set(0.15,0.15,2.8); body.scale.set(0.2,0.1,0.4);
      this._fpBasePos={x:0.16,y:-0.34,z:-0.38};
      this._fpAdsPos={x:0.08,y:-0.22,z:-0.34};
    }else if(id==="pistol"){
      barrel.scale.set(1,1,0.7); body.scale.set(1,1,0.8);
      this._fpBasePos={x:0.16,y:-0.31,z:-0.42};
      this._fpAdsPos={x:0.0,y:-0.17,z:-0.38};
    }else if(id==="rifle"){
      barrel.scale.set(1,1,1.4); body.scale.set(1.1,1.1,1.3);
      this._fpBasePos={x:0.13,y:-0.29,z:-0.40};
      this._fpAdsPos={x:0.0,y:-0.16,z:-0.34};
    }else{
      // shotgun / default
      barrel.scale.set(1.3,1.3,1.0); body.scale.set(1.4,1.2,1.0);
      this._fpBasePos={x:0.14,y:-0.30,z:-0.39};
      this._fpAdsPos={x:0.0,y:-0.16,z:-0.32};
    }
    this.fpWeapon.position.set(this._fpBasePos.x,this._fpBasePos.y,this._fpBasePos.z);
    // Update TP weapon scale
    if(this.tpWeapon){
      const tpBarrel=this.tpWeapon.children[0];
      const tpBody=this.tpWeapon.children[1];
      if(id==="katana"){
        tpBarrel.scale.set(0.15,0.15,2.4); tpBody.scale.set(0.2,0.1,0.4);
      }else if(id==="pistol"){
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
      radiation:this.radiation,armor:this.armor,armorEquipped:this.armorEquipped,xp:this.xp,level:this.level,skillPoints:this.skillPoints,skills:{...this.skills},hpMax:this.hpMax};
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
    this._lastRadThreshold=Math.floor(this.radiation/25)*25;
    this.armor=s.armor||0;
    this.armorEquipped=s.armorEquipped||null;
    this.xp=s.xp||0;
    this.level=s.level||1;
    this.skillPoints=s.skillPoints||0;
    if(s.skills) this.skills={...this.skills,...s.skills};
    this.hpMax=s.hpMax||100;
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

    // Terrain-aware grounding
    let groundY=0;
    if(!this.inVault && env.useHeightmap && env.terrain && env.terrain.ready){
      groundY=env.terrain.sampleHeight(this.pos.x,this.pos.z);
    }
    const minY=groundY+1.6-this.crouch*0.55;
    if(this.pos.y<minY){ this.pos.y=minY; this.vel.y=0; this.onGround=true; }

    if(this.inVault){
      this.pos.x=clamp(this.pos.x,-16.2,16.2);
      this.pos.z=clamp(this.pos.z,-12.5,12.5);
    }else if(env.useHeightmap){
      // Clamp to terrain bounds
      this.pos.x=clamp(this.pos.x,-MAP_HALF+5,MAP_HALF-5);
      this.pos.z=clamp(this.pos.z,-MAP_HALF+5,MAP_HALF-5);
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
        if(this.weapon.fireMode!=="melee"){
          const need=this.getModdedMagSize()-this.mag[id];
          const take=Math.min(need,this.reserve[id]);
          this.mag[id]+=take; this.reserve[id]-=take;
        }
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

    // Radiation sources (proximity-based)
    if(!this.inVault){
      let radGain=0;
      // Check nearby POIs for radiation via env callback
      if(env.getRadiationAtPos) radGain+=env.getRadiationAtPos(this.pos);
      this.radiation=Math.min(this.radiationMax,this.radiation+radGain*dt);
      // Radiation threshold toasts
      const thresholds=[25,50,75];
      for(const th of thresholds){
        if(this.radiation>=th && this._lastRadThreshold<th){
          this._lastRadThreshold=th;
          if(env.showToast) env.showToast(`Radiation rising… (${Math.round(this.radiation)} RAD)`);
        }
      }
      if(this.radiation<this._lastRadThreshold) this._lastRadThreshold=Math.floor(this.radiation/25)*25;
      // Clamp HP to effectiveMaxHP
      const effMax=this.effectiveMaxHP();
      if(this.hp>effMax) this.hp=effMax;
    }else{
      this.radiation=Math.max(0,this.radiation-3*dt);
      if(this.radiation<this._lastRadThreshold) this._lastRadThreshold=Math.floor(this.radiation/25)*25;
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
    this.model.rotation.y=this.yaw;

    // Third-person weapon visibility
    if(this.tpWeapon) this.tpWeapon.visible=(this.camMode==="tp");

    // Arm aiming animation — rotate arm pivots forward when aiming
    if(this._armRPivot && this._armLPivot){
      const aimRot=-this.adsAnim*1.2; // swing arms forward ~69° when fully aimed
      this._armRPivot.rotation.x=aimRot;
      this._armLPivot.rotation.x=aimRot;
    }

    // Update character skeletal animations (TP + FP arms)
    this._updateCharacterAnimation(dt);

    // First-person dedicated arms (Player_Arms.fbx) — hide when TP or Pip-Boy is up
    if(this._fpArms){
      this._fpArms.visible=(this.camMode==="fp")&&(this.pipboyAnim<0.3);
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
    // Stowed: rests on the left forearm of the dedicated FP arms model
    //   (arms centred at (0,-0.30,-0.40), left side ~x=-0.15).
    // Raised: swings up to a comfortable reading position.
    if(this.fpPipboy){
      this.fpPipboy.visible=(this.camMode==="fp");
      const t=this.pipboyAnim;
      const sx=-0.28, sy=-0.38, sz=-0.42;  // stowed — left wrist area of new arms
      const ex=-0.16, ey=-0.20, ez=-0.44;  // raised — tilted up to face player
      this.fpPipboy.position.set(lerp(sx,ex,t),lerp(sy,ey,t),lerp(sz,ez,t));
      this.fpPipboy.rotation.set(lerp(0.15,-0.55,t),lerp(0.25,0.10,t),0);
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
    if(this.weapon.fireMode==="melee") return; // melee weapons don't reload
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
    const isMelee=this.weapon.fireMode==="melee";

    // Melee weapons: no ammo check
    if(!isMelee){
      if(this.mag[id]<=0){ env.audio.click(); this.fireCd=0.18; return false; }
      this.mag[id]-=1;
    }

    this.fireCd=60/this.weapon.rpm;
    this.recoilKick+=this.weapon.recoil.kick;
    this.weaponKick=isMelee?0.6:id==="shotgun"?0.8:id==="rifle"?0.3:0.45;

    if(isMelee){
      // Melee swing — no muzzle flash, no casings
      env.audio.click(); // TODO: replace with proper melee swing sound
      env.shakeKick(0.06);
      // Trigger katana-specific animation (attack or skill03 alternating)
      if(id==="katana"){
        const useSkill=this._actions&&this._actions.skill03&&Math.random()<0.3;
        this.playAttackAnimation(useSkill?"skill03":"attack");
      }else{
        this.playAttackAnimation("attack");
      }
    }else{
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
    }

    const dir=env.getForward();
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

    this.renderer=new THREE.WebGLRenderer({antialias:true,powerPreference:"high-performance"});
    this.renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));
    this.renderer.setSize(innerWidth,innerHeight);
    this.renderer.shadowMap.enabled=true;
    this.renderer.shadowMap.type=THREE.PCFSoftShadowMap;
    this.renderer.outputColorSpace=THREE.SRGBColorSpace;
    this.renderer.autoClear=false; // manual clear for two-pass FP rendering
    document.body.appendChild(this.renderer.domElement);

    this.scene=new THREE.Scene();
    this.scene.fog=new THREE.Fog(0x0a1018,22,280);

    this.fov=70;
    this.resolutionScale=1.0;
    this.camera=new THREE.PerspectiveCamera(this.fov,innerWidth/innerHeight,0.1,500);
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

    // Asset pipeline + prop factory
    this.assetManager=new AssetManager();
    this.assetRegistry=new AssetRegistry();

    // Eagerly start loading the Meshy AI player character model right away
    // using known URLs — don't wait for the asset registry manifest.
    this._loadPlayerCharacter();
    // Load dedicated FP arms (Player_Arms.fbx + PlayerArms.png) immediately.
    // Uses fallback URLs so it doesn't need to wait for the registry either.
    this._loadFPArms();

    this.assetRegistry.load().then(()=>{
      if(this.assetRegistry.error) this.toast(this.assetRegistry.error);
      this.assetRegistry.printSummary();
      // Load katana model and PBR textures from registry
      this._loadKatanaAssets();
    }).catch(e=>console.warn("[AssetRegistry]",e));
    this.propFactory=new PropFactory(this.assetManager);
    this.propFactory.preload(Object.keys(WorldPropDefs)).catch(e=>console.warn("[PropFactory] preload:",e));

    this.world=new World(this.scene,this.save.world.seed,this.propFactory);

    // Heightmap terrain (replaces tile streaming for outside)
    this.useHeightmap=this.save.world.useHeightmap!==false;
    this.terrain=new HeightmapTerrain(this.scene,"./assets/world/heightmap_kuroshima_1024.png");
    this.terrain.setVisible(false);
    this.worldspace=new Worldspace(this.scene,this.terrain,"./assets/world/poi_kuroshima_act1.json",{world:this.world,registry:this.assetRegistry});
    this.worldspace.setVisible(false);

    this.npcMgr=new NPCManager(this.scene);
    this.npcMgr.spawnVaultNPCs();
    this.npcMgr.spawnOutsideNPCs();
    this.npcMgr.setOutsideVisible(false);
    this.dialogueCtrl=new DialogueController();

    // Build outpost (meshes + interactables)
    this.outpost=buildOutpost(this.scene, this.world);
    this.outpost.group.visible=false;
    this._outpostHostile=false; // tracks current hostility state for visuals/behavior

    // Build dungeon system
    this.dungeonMgr=new DungeonManager(this.scene, this.world);
    this.dungeonMgr.spawnDoors();
    this.dungeonMgr.setDoorsVisible(false);

    // Debug teleport index
    this._debugTeleportIdx=0;
    this._outpostGrounded=false;

    this.mode="title"; // title intro play pause inventory skills crafting pipboy dialogue dungeon
    this.autoFire=false;
    this.shake={amp:0,t:0};
    this.pipboyTab="journal";

    this.quest=this.save.world.quest;
    this.questSys=new Quest();
    this.questSys.fromSave(this.save.world.questSys);

    // Restore outpost hostility state from persisted quest data
    this._outpostHostile=isOutpostHostile(this.questSys);
    if(this._outpostHostile) applyHostileVisuals(this.outpost);

    // Faction world (patrol squads, skirmishes, POI ownership)
    this.factionWorld=new FactionWorld(this.scene, this.world, this.questSys, this.save.world.seed);
    if(this.save.world.factionWorld) this.factionWorld.fromSave(this.save.world.factionWorld);
    this.factionWorld.onPlayerDamage=(dmg)=>this.damagePlayer(dmg);
    this.world.addTileCallback({
      onCreated:(k,g,biome,tx,tz)=>this.factionWorld.onTileCreated(k,g,biome,tx,tz),
      onDisposed:(k)=>this.factionWorld.onTileDisposed(k)
    });

    // Companion system
    this.companionMgr=new CompanionManager(this.scene);
    if(this.save.world.companion) this.companionMgr.fromSave(this.save.world.companion, this.questSys, this.player.pos);

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

    // Editor mode (F10 toggle)
    this.editor=new Editor(this.scene, this.camera, this.renderer, { terrain:this.terrain, input:this.input });
    this.editor.onExit(()=>this.exitEditor());
    this.editor.loadSavedProps();

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
    const ambient=new THREE.AmbientLight(0xffffff,0.55);
    ambient.layers.enable(1); // also illuminate FP layer
    this.scene.add(ambient);

    this.sun=new THREE.DirectionalLight(0xfff4e0,1.6);
    this.sun.position.set(50,70,20);
    this.sun.castShadow=true;
    this.sun.shadow.mapSize.set(1024,1024);
    Object.assign(this.sun.shadow.camera,{near:1,far:150,left:-60,right:60,top:60,bottom:-60});
    this.sun.layers.enable(1); // also illuminate FP layer
    this.scene.add(this.sun);

    // Hemisphere light for better ambient variation
    this.hemiLight=new THREE.HemisphereLight(0x8899bb,0x223311,0.35);
    this.hemiLight.layers.enable(1); // also illuminate FP layer
    this.scene.add(this.hemiLight);

    this.vaultLight=new THREE.PointLight(0x9bd3ff,2.2,60,1.9);
    this.vaultLight.position.set(0,6.5,0);
    this.vaultLight.layers.enable(1); // also illuminate FP layer
    this.scene.add(this.vaultLight);
  }

  _makeSky(){
    const geo=new THREE.SphereGeometry(450,16,12);
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
    this.vault.setExteriorVisible(false);
    this.npcMgr.setVisible(true);
    if(this.terrain) this.terrain.setVisible(false);
    if(this.worldspace) this.worldspace.setVisible(false);
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
    pipboyClose(this.ui.pipUI);
    this.ui.dlg.panel.style.display="none";
    this.player.pipboyActive=false;
  }

  openPipboy(tab){
    // Block if in dialogue or terminal
    if(this.mode==="dialogue"||this.mode==="terminal"){ this.ui.showToast("Busy"); return; }
    if(this.mode==="pipboy"&&this.pipboyTab===tab){ this.closePipboy(); return; }
    this.mode="pipboy";
    this.pipboyTab=tab||"journal";
    this.player.pipboyActive=true;
    // Force first-person when opening pip-boy
    if(this.player.camMode==="tp"){ this.player.camMode="fp"; }
    this.ui.inv.style.display="none";
    this.ui.skillTree.style.display="none";
    this.ui.craftPanel.style.display="none";
    this.ui.scrim.style.display="none";
    pipboyOpen(this.ui.pipUI, tab);
    // Bind tab buttons once per open (onclick replaces, no leak)
    this.ui.pipUI.tabBtns.forEach(btn=>{
      btn.onclick=()=>{ this.pipboyTab=btn.dataset.tab; this.renderPipboy(); };
    });
    this.renderPipboy();
  }

  closePipboy(){
    this.player.pipboyActive=false;
    pipboyClose(this.ui.pipUI);
    this.mode="play";
  }

  renderPipboy(){
    pipboyRender(this.ui.pipUI, this.pipboyTab, this, {
      ItemDB,
      SkillDefs,
      WeaponDefs,
      useItem: (idx) => this.useItem(idx),
      dropItem: (idx) => this.dropItem(idx),
      renderCallback: () => this.renderPipboy(),
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

    const rowRes=document.createElement("div"); rowRes.className="row";
    rowRes.innerHTML=`<label>Resolution Scale: <span id="res-val">${Math.round(this.resolutionScale*100)}%</span></label>`;
    const resSlider=document.createElement("input");
    resSlider.type="range"; resSlider.min="0.25"; resSlider.max="2.0"; resSlider.step="0.05"; resSlider.value=String(this.resolutionScale);
    resSlider.addEventListener("input",()=>{
      this.resolutionScale=parseFloat(resSlider.value);
      rowRes.querySelector("#res-val").textContent=Math.round(this.resolutionScale*100)+"%";
      this.applyResolutionScale();
    });
    rowRes.appendChild(resSlider);

    const row3=document.createElement("div"); row3.className="row";
    row3.innerHTML=`<label>Master Volume</label>`;
    const vol=document.createElement("input");
    vol.type="range"; vol.min="0"; vol.max="1"; vol.step="0.01"; vol.value="0.6";
    vol.addEventListener("input",()=>this.audio.setMaster(parseFloat(vol.value)));
    row3.appendChild(vol);

    wrap.append(row1,row2,rowRes,row3);

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
    kb.innerHTML=`<div class="k">Keybinds: WASD Move • Mouse Look • C Camera • 1/2/3 Weapons (1-5 tabs in Pip-Boy) • R Reload • E Interact • Tab/P Pip-Boy (I Inv, K Stats, J Factions) • Esc Pause</div>`;
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
    this._qualityLevel=q;
    const rs=this.resolutionScale;
    if(q===0){
      this.renderer.setPixelRatio(Math.min(devicePixelRatio,1.25)*rs);
      this.renderer.shadowMap.enabled=false;
      this.scene.fog.near=16; this.scene.fog.far=190;
    }else if(q===1){
      this.renderer.setPixelRatio(Math.min(devicePixelRatio,1.6)*rs);
      this.renderer.shadowMap.enabled=true;
      this.scene.fog.near=18; this.scene.fog.far=240;
    }else{
      this.renderer.setPixelRatio(Math.min(devicePixelRatio,2)*rs);
      this.renderer.shadowMap.enabled=true;
      this.scene.fog.near=18; this.scene.fog.far=300;
    }
    this.renderer.setSize(innerWidth,innerHeight);
  }

  applyResolutionScale(){
    this.applyQuality(this._qualityLevel!=null?this._qualityLevel:1);
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
    this.factionWorld.questSys=this.questSys;
    this.factionWorld.fromSave(null); // reset for new game
    this._outpostHostile=false;
    applyNeutralVisuals(this.outpost);
    this.useHeightmap=true;
    this.vault.setVisible(true);
    this.vault.setExteriorVisible(false);
    this.npcMgr.setOutsideVisible(false);
    this.outpost.group.visible=false;
    this.factionWorld.setVisible(false);
    this.dungeonMgr.setDoorsVisible(false);
    if(this.useHeightmap){
      this.terrain.setVisible(false);
      this.worldspace.setVisible(false);
    }
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
    this.factionWorld.questSys=this.questSys;
    if(this.save.world.factionWorld) this.factionWorld.fromSave(this.save.world.factionWorld);
    // Restore outpost hostility visuals from quest state
    this._outpostHostile=isOutpostHostile(this.questSys);
    if(this._outpostHostile) applyHostileVisuals(this.outpost);
    else applyNeutralVisuals(this.outpost);
    this.useHeightmap=this.save.world.useHeightmap!==false;
    this.vault.setVisible(this.player.inVault);
    this.vault.setExteriorVisible(!this.player.inVault);
    this.npcMgr.setOutsideVisible(!this.player.inVault);
    this.outpost.group.visible=!this.player.inVault;
    this.factionWorld.setVisible(!this.player.inVault);
    this.dungeonMgr.setDoorsVisible(!this.player.inVault);
    if(this.useHeightmap){
      this.terrain.setVisible(!this.player.inVault);
      this.worldspace.setVisible(!this.player.inVault);
    }
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
    this.save.world.companion=this.companionMgr.toSave();
    this.save.world.factionWorld=this.factionWorld.toSave();
    this.save.world.useHeightmap=this.useHeightmap;
    // Save dungeon cleared states to prevent re-looting
    const clearedDungeons={};
    for(const [id,d] of Object.entries(this.dungeonMgr.dungeons)){
      if(d._contentSpawned) clearedDungeons[id]=true;
    }
    this.save.world.clearedDungeons=clearedDungeons;
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
    if(this.save.world.companion) this.companionMgr.fromSave(this.save.world.companion, this.questSys, this.player.pos);
    if(this.save.world.factionWorld) this.factionWorld.fromSave(this.save.world.factionWorld);
    // Restore outpost hostility visuals from quest state
    this._outpostHostile=isOutpostHostile(this.questSys);
    if(this._outpostHostile) applyHostileVisuals(this.outpost);
    else applyNeutralVisuals(this.outpost);
    // Restore dungeon cleared states to prevent re-looting
    if(this.save.world.clearedDungeons){
      for(const [id,cleared] of Object.entries(this.save.world.clearedDungeons)){
        if(cleared && this.dungeonMgr.dungeons[id]) this.dungeonMgr.dungeons[id]._contentSpawned=true;
      }
    }
    if(this.save.fov){ this.fov=this.save.fov; this.camera.fov=this.fov; this.camera.updateProjectionMatrix(); }
    this.useHeightmap=this.save.world.useHeightmap!==false;
    this.vault.setVisible(this.player.inVault);
    this.vault.setExteriorVisible(!this.player.inVault);
    this.npcMgr.setOutsideVisible(!this.player.inVault);
    this.outpost.group.visible=!this.player.inVault;
    this.factionWorld.setVisible(!this.player.inVault);
    this.dungeonMgr.setDoorsVisible(!this.player.inVault);
    if(this.useHeightmap){
      this.terrain.setVisible(!this.player.inVault);
      this.worldspace.setVisible(!this.player.inVault);
    }
    this.audio.startAmbient(this.player.inVault?"vault":"waste");
    this.ui.showToast("Loaded.");
  }

  enterEditor(){
    if(this.mode==="editor") return;
    this._preEditorMode=this.mode;
    this.mode="editor";
    // Hide all game UI
    this.ui.scrim.style.display="none";
    this.ui.inv.style.display="none";
    this.ui.hud.style.display="none";
    // Release pointer lock
    if(document.pointerLockElement) document.exitPointerLock();
    this.editor.enter(this.player.pos, this.player.yaw, this.player.pitch);
    this.ui.showToast("Editor Mode — F10 to exit");
  }

  exitEditor(){
    if(this.mode!=="editor") return;
    this.editor.exit();
    this.mode="play";
    // Restore game UI
    this.ui.hud.style.display="";
    // Restore player camera position from editor fly position
    this.player.pos.copy(this.editor.flyPos);
    this.player.yaw=this.editor.flyYaw;
    this.player.pitch=this.editor.flyPitch;
    this.ui.showToast("Editor Mode OFF");
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
          if(sk==="toughness"){ p.hpMax=computeHpMax(p); p.hp=Math.min(p.hp,p.hpMax); }
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

    const effMax=this.player.effectiveMaxHP();
    const totalArmor=this.player.armor+this.player.skills.mutantHide*5;
    this.ui.panel.innerHTML=`
      <div style="font-weight:950;font-size:14px;margin-bottom:8px">Status</div>
      <div class="k">HP: ${Math.round(this.player.hp)} / ${effMax}${effMax<this.player.hpMax?` (base ${this.player.hpMax})`:""}</div>
      <div class="k">Stamina: ${Math.round(this.player.stamina)} / ${this.player.staminaMax}</div>
      <div class="k">Radiation: ${Math.round(this.player.radiation)} / ${this.player.radiationMax}</div>
      <div class="k">Armor: ${totalArmor}</div>
      <div class="k">Level: ${this.player.level} (XP: ${this.player.xp}/${this.player.level*100})</div>
      <div style="height:10px"></div>
      <div style="font-weight:950;font-size:14px;margin-bottom:8px">Ammo</div>
      <div class="k">Pistol: ${this.player.mag.pistol}/${this.player.reserve.pistol}</div>
      <div class="k">Rifle: ${this.player.mag.rifle}/${this.player.reserve.rifle}</div>
      <div class="k">Shotgun: ${this.player.mag.shotgun}/${this.player.reserve.shotgun}</div>
      <div style="height:10px"></div>
      <div style="font-weight:950;font-size:14px;margin-bottom:8px">Controls</div>
      <div class="k">• Tab/P: Pip-Boy (I Inv, K Stats, J Factions) • C: camera</div>
      <div class="k">• R: reload • E: interact • Esc: pause</div>
    `;
  }

  useItem(idx){
    const it=this.player.inv[idx]; if(!it) return;
    const def=ItemDB[it.id];
    if(it.id==="stim"){ const effMax=this.player.effectiveMaxHP(); this.player.hp=clamp(this.player.hp+35,0,effMax); this.ui.showToast("Used Field Stim (+35 HP)"); }
    else if(it.id==="ration"){ const effMax=this.player.effectiveMaxHP(); this.player.hp=clamp(this.player.hp+20,0,effMax); this.ui.showToast("Ate Ration Pack (+20 HP)"); }
    else if(it.id==="radaway"){ this.player.radiation=Math.max(0,this.player.radiation-20); this.ui.showToast("Used Rad-Away (-20 RAD)"); }
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
    m.position.copy(pos);
    // Ground loot on terrain when outside with heightmap
    if(!this.player.inVault && this.useHeightmap && this.terrain.ready){
      m.position.y=this.terrain.sampleHeight(pos.x,pos.z)+0.45;
    }else{
      m.position.y=0.45;
    }
    m.userData={loot:true,item:{...item},name:def?.name||item.id};
    m.castShadow=true;
    this.scene.add(m);
    this._loots.push(m);
  }

  /**
   * Load the katana FBX model and PBR textures via AssetManager/AssetRegistry,
   * then attach the loaded model to the player's first-person weapon group.
   */
  _loadKatanaAssets(){
    const reg=this.assetRegistry;
    const mgr=this.assetManager;

    // Model — use the unsheathed variant (katana_no_case)
    const modelEntry=reg.getModel("katana_no_case")||reg.getModel("katana");
    const modelUrl=modelEntry?modelEntry.url:"assets/models/weapons/melee/katana_no_case.fbx";

    // PBR texture keys from the manifest
    const texKeys=[
      "katana_material_base_color",
      "katana_material_normal_directx",
      "katana_material_roughness",
      "katana_material_metallic",
      "katana_material_mixed_ao",
      "katana_material_height",
    ];
    const texUrls={};
    for(const k of texKeys){
      const entry=reg.getTexture(k);
      texUrls[k]=entry?entry.url:`assets/textures/weapons/melee/${k}.png`;
    }

    // Load textures in parallel
    const texPromises=texKeys.map(k=>{
      const cs=k.includes("base_color")?THREE.SRGBColorSpace:THREE.LinearSRGBColorSpace;
      return mgr.loadTexture(k,texUrls[k],{colorSpace:cs}).catch(e=>{
        console.warn(`[Katana] texture load failed: ${k}`,e);
        return null;
      });
    });

    // Load model
    const modelPromise=mgr.loadModel("katana_no_case",modelUrl).catch(e=>{
      console.warn("[Katana] model load failed:",e);
      return null;
    });

    Promise.all([modelPromise,...texPromises]).then(([model,...textures])=>{
      if(!model){
        console.warn("[Katana] model not available — using placeholder geometry.");
        return;
      }
      // Build PBR material from loaded textures, with a visible fallback color
      const [baseColor,normal,roughness,metallic,ao]=textures;
      const hasAnyTexture=baseColor||normal||roughness||metallic||ao;
      const matOpts={
        color:0xc0c0c8,
        roughness:hasAnyTexture?1:0.35,
        metalness:hasAnyTexture?1:0.7,
      };
      if(baseColor) matOpts.map=baseColor;
      if(normal) matOpts.normalMap=normal;
      if(roughness) matOpts.roughnessMap=roughness;
      if(metallic) matOpts.metalnessMap=metallic;
      if(ao) matOpts.aoMap=ao;
      const katanaMat=new THREE.MeshStandardMaterial(matOpts);

      // Apply material to all meshes in the loaded model
      model.traverse(child=>{
        if(child.isMesh){
          child.material=katanaMat;
          child.castShadow=true;
          child.receiveShadow=false;
        }
      });

      // Auto-scale the model to fit first-person view based on bounding box
      const box=new THREE.Box3().setFromObject(model);
      const size=new THREE.Vector3();
      box.getSize(size);
      const maxDim=Math.max(size.x,size.y,size.z);
      const targetLength=0.7;
      const autoScale=maxDim>0?targetLength/maxDim:0.006;
      model.scale.setScalar(autoScale);

      model.rotation.set(0,0,Math.PI/2);
      model.position.set(0,0,0.15);

      // Only visible when katana is equipped
      model.visible=this.player.weapon.id==="katana";
      // Place katana on FP layer so it renders in the second pass
      model.traverse(c=>c.layers.set(1));
      this.player.fpWeapon.add(model);
      this.player._fpKatanaModel=model;

      // If katana is currently equipped, refresh visuals
      if(this.player.weapon.id==="katana") this.player._updateFPWeapon();

      console.log("[Katana] model + textures loaded successfully. scale="+autoScale.toFixed(6));
    });
  }

  /**
   * Load the Meshy AI character model and all animation clips, then apply
   * them to the player. The model replaces the procedural placeholder in
   * both first-person (arms) and third-person (full body) views.
   *
   * The base character model is applied immediately once loaded so it
   * appears on screen as fast as possible. Animation clips are added
   * incrementally as they finish loading — no Promise.all gate.
   */
  _loadPlayerCharacter(){
    const reg=this.assetRegistry;
    const mgr=this.assetManager;

    // Resolve URLs from manifest (with fallbacks)
    const charUrl=(reg.getModel("player_character")||{}).url||"assets/models/characters/player/Meshy_AI_Character_output.glb";

    const animDefs={
      idle:     {url:(reg.getModel("player_anim_idle")||{}).url||"assets/models/characters/player/Meshy_AI_Animation_Idle_withSkin.glb",    loop:THREE.LoopRepeat},
      walking:  {url:(reg.getModel("player_anim_walking")||{}).url||"assets/models/characters/player/Meshy_AI_Animation_Walking_withSkin.glb",loop:THREE.LoopRepeat},
      running:  {url:(reg.getModel("player_anim_running")||{}).url||"assets/models/characters/player/Meshy_AI_Animation_Running_withSkin.glb",loop:THREE.LoopRepeat},
      run03:    {url:(reg.getModel("player_anim_run03")||{}).url||"assets/models/characters/player/Meshy_AI_Animation_Run_03_withSkin.glb",  loop:THREE.LoopRepeat},
      attack:   {url:(reg.getModel("player_anim_attack")||{}).url||"assets/models/characters/player/Meshy_AI_Animation_Attack_withSkin.glb", loop:THREE.LoopOnce},
      skill03:  {url:(reg.getModel("player_anim_skill03")||{}).url||"assets/models/characters/player/Meshy_AI_Animation_Skill_03_withSkin.glb",loop:THREE.LoopOnce},
      dead:     {url:(reg.getModel("player_anim_dead")||{}).url||"assets/models/characters/player/Meshy_AI_Animation_Dead_withSkin.glb",     loop:THREE.LoopOnce},
    };

    // Load the base character model — apply it as soon as it arrives
    mgr.loadGLTF("player_character",charUrl).then(charGltf=>{
      if(!charGltf){
        console.warn("[PlayerChar] character model not available — keeping placeholder.");
        return;
      }

      // Apply model immediately with empty animations so it appears on screen right away
      const oldParent=this.player.model.parent;
      this.player.applyCharacterModel(charGltf.scene, {});

      // Re-add to scene if the parent changed
      if(oldParent && !this.player.model.parent){
        oldParent.add(this.player.model);
      }else if(!this.player.model.parent){
        this.scene.add(this.player.model);
      }

      console.log("[PlayerChar] Meshy AI character model applied instantly. Loading animations…");

      // Load each animation independently and add as it arrives
      for(const[name,def] of Object.entries(animDefs)){
        mgr.loadGLTF("player_anim_"+name,def.url).then(gltf=>{
          const clips=gltf.animations||[];
          this.player.addAnimationClip(name, clips, def.loop);
        }).catch(e=>{
          console.warn(`[PlayerChar] animation "${name}" load failed:`,e);
        });
      }
    }).catch(e=>{
      console.warn("[PlayerChar] base model load failed:",e);
    });
  }

  /**
   * Load the dedicated first-person arms model (Player_Arms.fbx) and its texture,
   * position them in camera space, and assign to player._fpArms for visibility control.
   *
   * This replaces the old "character model clone" approach entirely.  The FP arms are
   * future-proof: weapon models parent themselves to fpWeapon (also layer 1) which is
   * independently positioned per weapon type, so new weapons just need an _fpBasePos.
   */
  _loadFPArms(){
    const reg=this.assetRegistry;
    const mgr=this.assetManager;

    const fbxUrl=(reg.getModel("player_arms")||{}).url||"assets/models/characters/player_arms.fbx";
    const texUrl=(reg.getTexture("playerarms")||{}).url||"assets/textures/characters/playerarms.png";

    const modelP=mgr.loadModel("player_arms",fbxUrl).catch(e=>{
      console.warn("[FPArms] FBX load failed:",e); return null;
    });
    const texP=mgr.loadTexture("playerarms",texUrl,{colorSpace:THREE.SRGBColorSpace}).catch(e=>{
      console.warn("[FPArms] texture load failed:",e); return null;
    });

    Promise.all([modelP,texP]).then(([model,texture])=>{
      if(!model){ console.warn("[FPArms] arms model unavailable, FP arms skipped."); return; }

      // --- Material ---
      // Use the PNG texture if loaded; fall back to a skin-tone flat colour.
      const armMat=new THREE.MeshStandardMaterial({
        map: texture||null,
        color: texture?0xffffff:0xc49a6c,
        roughness:0.82,
        metalness:0.04,
        side:THREE.FrontSide,
        transparent:false,
        depthWrite:true,
      });

      model.traverse(child=>{
        if(child.isMesh){
          child.material=armMat;
          child.castShadow=false;
          child.receiveShadow=false;
          child.frustumCulled=false; // always draw FP arms
        }
      });

      // --- Scale ---
      // Normalise so the arms span ~0.55 m across their largest dimension.
      model.updateMatrixWorld(true);
      const box=new THREE.Box3().setFromObject(model);
      const size=new THREE.Vector3();
      box.getSize(size);
      const targetHeight=0.55;
      const autoScale=targetHeight/Math.max(size.x,size.y,size.z,0.001);
      model.scale.setScalar(autoScale);

      // --- Orientation ---
      // FBXLoader already converts Blender Z-up → Three.js Y-up (applies -90° X internally).
      // No additional rotation needed.
      model.rotation.set(0,0,0);

      // --- Position in camera space ---
      // Centre the arms at the lower-centre of the screen; individual weapon offsets
      // will shift fpWeapon (right hand region) without moving the arms mesh itself.
      model.position.set(0,-0.30,-0.40);

      // --- Group & layer ---
      const fpArmsGroup=new THREE.Group();
      fpArmsGroup.name="fpArms";
      fpArmsGroup.add(model);
      fpArmsGroup.traverse(c=>c.layers.set(1)); // FP layer — traverse sets ALL descendants

      this.camera.add(fpArmsGroup);
      this.player._fpArms=fpArmsGroup;
      this.player._fpArmsModel=model;

      console.log("[FPArms] Dedicated arms loaded. autoScale="+autoScale.toFixed(4));
    });
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
    if(this.vault.exterior) add(this.vault.exterior);
    add(this.world.enemies);
    add(this.world.interact);
    add(this.npcMgr.group);
    add(this.npcMgr.outsideGroup);
    if(this.outpost) add(this.outpost.group);
    // Faction world units + banners
    if(this.factionWorld) add(this.factionWorld.group);
    // Terrain mesh for ground intersection
    if(this.useHeightmap && this.terrain.mesh && !this.player.inVault) add(this.terrain.mesh);
    // Worldspace POI interactables
    if(this.worldspace && this.worldspace.poiGroup.visible) add(this.worldspace.poiGroup);
    // Dungeon doors + interiors
    if(this.dungeonMgr){
      for(const dm of this.dungeonMgr.doorMeshes) add(dm.group);
      for(const [,d] of Object.entries(this.dungeonMgr.dungeons)) add(d.group);
      if(this._dungeonEnemies) for(const e of this._dungeonEnemies) add(e);
    }
    for(const l of this._loots) add(l);
    const hits=rc.intersectObjects(meshes,true);
    if(!hits.length) return null;
    const h=hits[0];
    return {point:h.point.clone(),object:h.object,parent:this.findRoot(h.object),dist:h.distance};
  }

  findRoot(obj){
    let o=obj;
    while(o && o.parent && o.parent!==this.scene){
      if(o.userData.enemy||o.userData.loot||o.userData.interact||o.userData.npc||o.userData.factionUnit||o.userData.factionBanner) return o;
      if(o.parent.userData.enemy||o.parent.userData.loot||o.parent.userData.interact||o.parent.userData.npc||o.parent.userData.factionUnit||o.parent.userData.factionBanner) return o.parent;
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
    }else if(root?.userData?.factionUnit){
      // Faction unit hit: damage + rep penalty for attacking faction members
      const ud=root.userData;
      ud.hp-=weapon.damage*(1+this.player.skills.ironSights*0.08);
      this.audio.hit();
      this.enemyBarShow(ud);
      // Attacking a faction lowers rep with that faction
      this.questSys.changeRep(ud.faction,-3);
      // Make the unit and squad-mates hostile toward the player
      ud.state="engage"; ud._targetRef={userData:{isPlayer:true,hp:1}}; ud.targetId="__player__";
      for(const u of this.factionWorld.allUnits){
        if(u.userData.squadId===ud.squadId && u!==root){
          u.userData.state="engage"; u.userData._targetRef={userData:{isPlayer:true,hp:1}}; u.userData.targetId="__player__";
        }
      }
      if(ud.hp<=0) this.killFactionUnit(root);
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
      this.player.hpMax=computeHpMax(this.player);
      this.player.hp=Math.min(this.player.hp,this.player.hpMax);
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
    // Also remove from dungeon enemy tracking
    if(this._dungeonEnemies){
      const idx=this._dungeonEnemies.indexOf(root);
      if(idx>=0) this._dungeonEnemies.splice(idx,1);
    }
    root.parent?.remove(root);
    this.scene.remove(root);
  }

  killFactionUnit(root){
    const ud=root.userData;
    // XP for killing faction units
    const xpGain=30;
    this.player.xp+=xpGain;
    const xpForLevel=this.player.level*100;
    if(this.player.xp>=xpForLevel){
      this.player.xp-=xpForLevel; this.player.level++; this.player.skillPoints++;
      this.player.hpMax=computeHpMax(this.player);
      this.player.hp=Math.min(this.player.hp,this.player.hpMax);
      this.ui.showToast(`Level Up! Lv.${this.player.level} (+1 Skill Point)`,2.5);
    }
    // Killing a faction unit adds +5 heat
    this.questSys.changeHeat(ud.faction, 5);
    // Loot drop (low chance)
    if(!ud.lootDone){
      ud.lootDone=true;
      const r=Math.random();
      if(r<0.20) this.spawnLoot(root.position.clone(),{id:"scrap",qty:Math.floor(1+Math.random()*2)});
      else if(r<0.35) this.spawnLoot(root.position.clone(),{id:"cloth",qty:1});
      else if(r<0.45) this.spawnLoot(root.position.clone(),{id:"circuits",qty:1});
    }
    // Particles
    for(let i=0;i<6;i++) this.particles.spawn(root.position.clone().add(v3(0,0.8,0)),v3(rand(-2,2),rand(1,3),rand(-2,2)),0.35,0.05);
    // Remove from faction world
    this.factionWorld._killUnit(root);
  }

  // Interaction (throttled to reduce per-frame raycast cost)
  _interactTimer=0;
  updateInteract(){
    this._interactTimer-=1/60;
    if(this._interactTimer>0 && this.player.interactTarget) return;
    this._interactTimer=0.1; // check ~10 times per second
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
      let hintText;
      const ud=t.userData;
      if(ud.lockId && ud.lockLevel && !isUnlocked(this.questSys, ud.lockId)){
        hintText=`E: Pick Lock [${lockHintLabel(ud.lockLevel)}] ${ud.name||"Object"}`;
      } else if(ud.kind==="dungeonDoor"){
        if(ud.lockId && !isUnlocked(this.questSys, ud.lockId)){
          hintText=ud.lockType==="terminal"
            ?`E: Locked — Use nearby terminal (${ud.name})`
            :`E: Pick Lock [${lockHintLabel(ud.lockLevel)}] ${ud.name}`;
        }else{
          hintText=`E: Enter ${ud.name}`;
        }
      } else if(ud.kind==="dungeonExit"){
        hintText=`E: ${ud.name}`;
      } else if(ud.kind==="vaultDoor"){
        hintText=`E: Open ${ud.name||"Object"}`;
      } else if(ud.kind==="vaultEntryDoor"){
        hintText=`E: Enter ${ud.name||"Vault 811"}`;
      } else if(ud.kind==="terminal"){
        hintText=`E: Access ${ud.name||"Terminal"}`;
      } else if(ud.kind==="restPoint"){
        hintText=`E: Rest at ${ud.name||"Object"}`;
      } else if(ud.kind==="noticeBoard"){
        hintText=`E: Read ${ud.name||"Object"}`;
      } else if(ud.kind==="factionBanner"){
        hintText=`E: Inspect ${ud.name||"Banner"}`;
      } else {
        hintText=`E: Use ${ud.name||"Object"}`;
      }
      this.ui.hint.textContent=hintText;
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
        // Lock check
        if(ud.lockId && ud.lockLevel && !isUnlocked(this.questSys, ud.lockId)){
          const result=attemptLockpick(this.player, this.questSys, ud);
          if(!result.success){
            this.ui.showToast(result.message);
            this.audio.click();
            // Forced-attempt noise: increment alarm counter
            this.questSys.incFlag("lockpick_failures");
            return;
          }
          // Unlocked
          this.ui.showToast(result.message);
          this.audio.hit();
          if(result.forced){
            this.questSys.incFlag("lockpick_alarms");
          }
          return; // next interact will open the now-unlocked container
        }
        if(ud.opened){ this.ui.showToast("Empty."); this.audio.click(); }
        else{
          ud.opened=true;
          const roll=Math.random();
          if(roll<0.35) this.spawnLoot(t.position.clone(),{id:"scrap",qty:Math.floor(1+Math.random()*3)});
          else if(roll<0.65) this.spawnLoot(t.position.clone(),{id:"ration",qty:1});
          else if(roll<0.85) this.spawnLoot(t.position.clone(),{id:"stim",qty:1});
          else this.spawnLoot(t.position.clone(),{id:"radaway",qty:1});
          // Tainted container: deterministic chance based on lockId or name hash
          if(!this.player.inVault){
            const taintSeed=(ud.lockId||ud.name||"crate").split("").reduce((a,c)=>a+c.charCodeAt(0),0);
            if(taintSeed%5===0){
              const radBurst=8+Math.floor(taintSeed%12);
              this.player.radiation=Math.min(this.player.radiationMax,this.player.radiation+radBurst);
              this.ui.showToast(`Tainted! (+${radBurst} RAD)`,2.0);
            }
          }
          this.ui.showToast(`${ud.name} opened.`);
          this.audio.hit();
        }
      }else if(ud.kind==="terminal"){
        this.openTerminal(ud.terminalId || "vault_terminal");
        this.audio.click();
      }else if(ud.kind==="vaultDoor"){
        this.exitVault();
      }else if(ud.kind==="vaultEntryDoor"){
        this.enterVault();
      }else if(ud.kind==="restPoint"){
        this.player.hp=this.player.effectiveMaxHP();
        this.player.stamina=this.player.staminaMax;
        if(this.companionMgr.active) this.companionMgr.revive();
        this.doSave();
        this.ui.showToast("Rested. Saved.",2.5);
        this.audio.click();
      }else if(ud.kind==="dungeonDoor"){
        this.enterDungeon(ud.dungeonId);
      }else if(ud.kind==="dungeonExit"){
        this.exitDungeon();
      }else if(ud.kind==="noticeBoard"){
        const topObj=this.questSys.topObjective();
        const lore="The shrine protects those who honor the old ways.";
        const msg=topObj?`${lore}\nObjective: ${topObj}`:lore;
        this.ui.showToast(msg,3.5);
        this.questSys.setFlag("discoveredShrineOutpost",true);
        this.audio.click();
      }else if(ud.kind==="factionBanner"){
        // Show who controls this POI
        const faction=ud.faction;
        const fName=faction===FACTIONS.WARDENS?"Shrine Wardens":"Rail Ghost Union";
        const stance=this.factionWorld.getStanceToPlayer(faction);
        this.ui.showToast(`${fName} territory. Stance: ${stance}.`,3);
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

  // ---- Terminal ----
  openTerminal(terminalId){
    const def=TerminalDefs[terminalId];
    if(!def){ this.ui.showToast("Terminal offline."); return; }
    this.mode="terminal";
    this._activeTerminalId=terminalId;
    this.ui.hint.style.display="none";
    this._renderActiveTerminal();
    this.audio.click();
  }

  _renderActiveTerminal(){
    const def=TerminalDefs[this._activeTerminalId];
    if(!def) return;
    renderTerminal(this.ui.term, def, this.questSys, {
      onClose: ()=>this.closeTerminalUI(),
      onAction: (act)=>this._terminalAction(act),
      showToast: (msg)=>this.ui.showToast(msg)
    });
  }

  _terminalAction(act){
    if(act.kind==="unlock"){
      const flagKey=`unlocked:${act.targetLockId}`;
      if(this.questSys.getFlag(flagKey)){
        this.ui.showToast("Already unlocked.");
        return;
      }
      this.questSys.setFlag(flagKey, true);
      this.ui.showToast(`Remote unlock: ${act.displayName || act.targetLockId}.`);
      this.audio.hit();
      // Re-render terminal to update button states
      this._renderActiveTerminal();
    }
  }

  closeTerminalUI(){
    closeTerminal(this.ui.term);
    this._activeTerminalId=null;
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
    this.vault.setExteriorVisible(true);
    this.npcMgr.setOutsideVisible(true);
    this.outpost.group.visible=true;
    this.factionWorld.setVisible(true);
    // Show terrain + worldspace POIs when using heightmap
    if(this.useHeightmap){
      this.terrain.setVisible(true);
      this.worldspace.setVisible(true);
    }
    // Spawn player just outside the vault entrance facing away
    const spawnX=0, spawnZ=6;
    const spawnY=this.useHeightmap&&this.terrain.ready?this.terrain.sampleHeight(spawnX,spawnZ)+1.6:1.6;
    this.player.pos.set(spawnX,spawnY,spawnZ);
    this.player.yaw=0;
    this.audio.startAmbient("waste");

    // Music swell
    this.audio.tone(220,1.5,"sine",0.15);
    setTimeout(()=>this.audio.tone(330,1.2,"sine",0.12),200);
    setTimeout(()=>this.audio.tone(440,1.0,"sine",0.10),500);

    // Dramatic reveal lighting
    this._revealLight=new THREE.PointLight(0xffe0aa,3.0,80,1.5);
    this._revealLight.position.set(0,spawnY+6,8);
    this.scene.add(this._revealLight);
    this._revealTimer=3.0;

    this.ui.showToast("The air tastes like old lightning.",3.0);

    // Enemy intro moment — spawn a nearby enemy for tension (far enough to not teleport-attack)
    if(this.world.enemies.children.length===0){
      const e=this.world.makeEnemy("crawler");
      const eX=20, eZ=40;
      const eY=this.useHeightmap&&this.terrain.ready?this.terrain.sampleHeight(eX,eZ):0;
      e.position.set(eX,eY,eZ);
      this.world.enemies.add(e);
    }
  }

  enterVault(){
    this.player.inVault=true;
    this.vault.setVisible(true);
    this.vault.setExteriorVisible(false);
    this.npcMgr.setVisible(true);
    this.npcMgr.setOutsideVisible(false);
    this.outpost.group.visible=false;
    this.factionWorld.setVisible(false);
    if(this.useHeightmap){
      this.terrain.setVisible(false);
      this.worldspace.setVisible(false);
    }
    this.player.pos.set(0,1.6,10);
    this.player.yaw=Math.PI;
    this.audio.startAmbient("vault");
    this.audio.tone(80,0.4,"sawtooth",0.1);
    this.ui.showToast("Entered Vault 811.",2.0);
  }

  // ---- Dungeon enter/exit ----
  enterDungeon(dungeonId){
    const def=DungeonDefs[dungeonId];
    if(!def){ this.ui.showToast("Access denied."); return; }
    // Lock check
    const flagKey=`unlocked:${def.lockId}`;
    if(!this.questSys.getFlag(flagKey)){
      if(def.doorLockType==="lockpick"){
        // Try lockpick
        const result=attemptLockpick(this.player,this.questSys,{lockId:def.lockId,lockLevel:def.lockLevel});
        if(!result.success){ this.ui.showToast(result.message); this.audio.click(); return; }
        this.ui.showToast(result.message); this.audio.hit();
        return; // next interact will enter
      }else{
        this.ui.showToast("Locked. Find a terminal to unlock this door."); this.audio.click();
        return;
      }
    }
    // Enter dungeon
    const ok=this.dungeonMgr.enter(dungeonId,this.player,this.questSys);
    if(!ok){ this.ui.showToast("Cannot enter."); return; }
    // Hide outside world
    this.world.static.visible=false;
    this.world.interact.visible=false;
    this.world.enemies.visible=false;
    this.factionWorld.setVisible(false);
    this.outpost.group.visible=false;
    this.npcMgr.setOutsideVisible(false);
    this.vault.setExteriorVisible(false);
    this.dungeonMgr.setDoorsVisible(false);
    if(this.useHeightmap){
      this.terrain.setVisible(false);
      this.worldspace.setVisible(false);
    }
    // Spawn dungeon enemies + loot on first enter
    const d=this.dungeonMgr.dungeons[dungeonId];
    if(d && !d._contentSpawned){
      d._contentSpawned=true;
      const data=this.dungeonMgr.getSpawnData(dungeonId);
      if(data){
        for(const eDef of data.enemies){
          const e=this.world.makeEnemy(eDef.kind);
          e.position.set(eDef.pos.x,eDef.pos.y,eDef.pos.z);
          this.scene.add(e);
          this.dungeonMgr.addEnemy(dungeonId,e);
          this._dungeonEnemies=this._dungeonEnemies||[];
          this._dungeonEnemies.push(e);
        }
        for(const lDef of data.loot){
          this.spawnLoot(v3(lDef.pos.x,lDef.pos.y,lDef.pos.z),{id:lDef.id,qty:lDef.qty});
          const lastLoot=this._loots[this._loots.length-1];
          if(lastLoot) this.dungeonMgr.addLoot(dungeonId,lastLoot);
        }
      }
    }
    this.audio.startAmbient("vault"); // reuse vault ambient for dungeons
    this.ui.showToast(`Entered: ${def.name}`,2.5);
  }

  exitDungeon(){
    if(!this.dungeonMgr.isInDungeon()) return;
    const ret=this.dungeonMgr.exit(this.player);
    // Clean up dungeon enemies from tracking
    if(this._dungeonEnemies){
      for(const e of this._dungeonEnemies) this.scene.remove(e);
      this._dungeonEnemies=[];
    }
    // Show outside world
    if(this.useHeightmap){
      this.world.static.visible=false; // tiles hidden; terrain replaces them
      this.terrain.setVisible(true);
      this.worldspace.setVisible(true);
    }else{
      this.world.static.visible=true;
    }
    this.world.interact.visible=true;
    this.world.enemies.visible=true;
    this.factionWorld.setVisible(true);
    this.outpost.group.visible=true;
    this.npcMgr.setOutsideVisible(true);
    this.vault.setExteriorVisible(true);
    this.dungeonMgr.setDoorsVisible(true);
    // Restore player position
    if(ret){
      this.player.pos.copy(ret.pos);
      this.player.yaw=ret.yaw;
    }
    // Teleport companion to player after dungeon exit to prevent desync
    if(this.companionMgr.isActive() && this.companionMgr.active.mesh){
      this.companionMgr.active.mesh.position.copy(this.player.pos).add(v3(-2,0,-1));
      this.companionMgr.active.mesh.position.y=0;
    }
    this.audio.startAmbient("waste");
    this.ui.showToast("Returned to the surface.",2.0);
  }

  // Enemies AI — reusable vectors to reduce per-frame allocations
  _enemyToP=new THREE.Vector3();
  _enemyDir=new THREE.Vector3();
  updateEnemies(dt){
    const p=this.player.pos;
    for(const e of this.world.enemies.children){
      const ud=e.userData; if(!ud?.enemy) continue;
      ud.atkCd=Math.max(0,ud.atkCd-dt);
      ud.spitCd=Math.max(0,ud.spitCd-dt);
      ud.lastSeen+=dt;

      this._enemyToP.copy(p).sub(e.position);
      this._enemyToP.y=0;
      const dist=this._enemyToP.length();
      const sees=dist<22 && !this.player.inVault;
      if(sees){ ud.aggro=Math.min(1,ud.aggro+2.0*dt); ud.lastSeen=0; }
      else ud.aggro=Math.max(0,ud.aggro-0.35*dt);

      ud.state = ud.aggro>0.2 ? "chase":"wander";

      // Cap max movement per frame to prevent teleporting
      const maxStep=ud.speed*dt;
      const maxStepClamped=Math.min(maxStep,0.5);

      if(ud.state==="wander"){
        ud.wanderT-=dt;
        if(ud.wanderT<=0){
          ud.wanderT=1.5+Math.random()*2.8;
          const a=Math.random()*Math.PI*2;
          ud.wanderDir.set(Math.cos(a),0,Math.sin(a));
        }
        const wanderStep=Math.min(ud.speed*0.25*dt,0.3);
        e.position.addScaledVector(ud.wanderDir,wanderStep);
      }else{
        if(dist>1.2){
          this._enemyDir.copy(this._enemyToP).normalize();
          const chaseStep=Math.min(maxStepClamped,dist-1.0);
          e.position.addScaledVector(this._enemyDir,chaseStep);
        }

        if(ud.kind==="crawler"){
          if(dist<1.6 && ud.atkCd<=0){
            ud.atkCd=0.9;
            // Sometimes attack companion if closer
            if(this.companionMgr.isActive()){
              const compPos=this.companionMgr.active.mesh.position;
              const compDist=e.position.distanceTo(compPos);
              if(compDist<dist && compDist<2.0){
                const killed=this.companionMgr.damage(ud.dmg);
                if(killed) this.ui.showToast(this.companionMgr.active.def.deathMsg,2.5);
              }else{ this.damagePlayer(ud.dmg); }
            }else{ this.damagePlayer(ud.dmg); }
          }
        }else{
          if(dist<2.0 && ud.atkCd<=0){
            ud.atkCd=1.2;
            if(this.companionMgr.isActive()){
              const compPos=this.companionMgr.active.mesh.position;
              const compDist=e.position.distanceTo(compPos);
              if(compDist<dist && compDist<2.5){
                const killed=this.companionMgr.damage(ud.dmg);
                if(killed) this.ui.showToast(this.companionMgr.active.def.deathMsg,2.5);
              }else{ this.damagePlayer(ud.dmg); }
            }else{ this.damagePlayer(ud.dmg); }
          }
          else if(dist<12 && ud.spitCd<=0){ ud.spitCd=2.2; this.spawnSpit(e.position.clone().add(v3(0,1.1,0)), p.clone().add(v3(0,0.6,0))); }
        }
      }

      if(dist>0.001){
        const ang=Math.atan2(this._enemyToP.x,this._enemyToP.z);
        e.rotation.y=lerp(e.rotation.y,ang,6*dt);
      }
      // Ground enemy on terrain
      if(this.useHeightmap && this.terrain.ready){
        e.position.y=this.terrain.sampleHeight(e.position.x,e.position.z);
      }else{
        e.position.y=0;
      }
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

  /** Update enemies that live inside a dungeon (same AI as world enemies) */
  _updateDungeonEnemies(dt){
    if(!this._dungeonEnemies) return;
    const p=this.player.pos;
    for(let i=this._dungeonEnemies.length-1;i>=0;i--){
      const e=this._dungeonEnemies[i];
      const ud=e.userData; if(!ud?.enemy) continue;
      if(ud.hp<=0) continue;
      ud.atkCd=Math.max(0,ud.atkCd-dt);
      ud.spitCd=Math.max(0,ud.spitCd-dt);
      ud.lastSeen+=dt;
      this._enemyToP.copy(p).sub(e.position);
      this._enemyToP.y=0;
      const dist=this._enemyToP.length();
      ud.aggro=Math.min(1,ud.aggro+2.0*dt); ud.lastSeen=0;
      ud.state="chase";
      const maxStepClamped=Math.min(ud.speed*dt,0.5);
      if(dist>1.2){
        this._enemyDir.copy(this._enemyToP).normalize();
        e.position.addScaledVector(this._enemyDir,Math.min(maxStepClamped,dist-1.0));
      }
      if(ud.kind==="crawler"){
        if(dist<1.6 && ud.atkCd<=0){ ud.atkCd=0.9; this.damagePlayer(ud.dmg); }
      }else{
        if(dist<2.0 && ud.atkCd<=0){ ud.atkCd=1.2; this.damagePlayer(ud.dmg); }
        else if(dist<12 && ud.spitCd<=0){ ud.spitCd=2.2; this.spawnSpit(e.position.clone().add(v3(0,1.1,0)),p.clone().add(v3(0,0.6,0))); }
      }
      if(dist>0.001){
        const ang=Math.atan2(this._enemyToP.x,this._enemyToP.z);
        e.rotation.y=lerp(e.rotation.y,ang,6*dt);
      }
      e.position.y=0;
    }
  }

  updateSpit(dt){
    for(let i=this._spit.length-1;i>=0;i--){
      const s=this._spit[i];
      s.userData.life-=dt;
      s.position.addScaledVector(s.userData.vel,dt);
      s.userData.vel.y-=8*dt;

      if(s.position.distanceTo(this.player.pos)<0.8){
        this.damagePlayer(8);
        // Stalker spit adds small radiation burst
        this.player.radiation=Math.min(this.player.radiationMax,this.player.radiation+3);
        this.particles.spawn(s.position.clone(),v3(rand(-2,2),2,rand(-2,2)),0.25,0.06);
        this.scene.remove(s);
        this._spit.splice(i,1);
        continue;
      }
      const groundY=(this.useHeightmap&&this.terrain.ready&&!this.player.inVault)?this.terrain.sampleHeight(s.position.x,s.position.z)+0.1:0.1;
      if(s.position.y<groundY || s.userData.life<=0){
        this.particles.spawn(s.position.clone(),v3(rand(-1,1),1.5,rand(-1,1)),0.2,0.05);
        this.scene.remove(s);
        this._spit.splice(i,1);
      }
    }
  }

  damagePlayer(amount){
    if(this.mode!=="play") return;
    const reduced=this.player.armorReduction(amount);
    this.player.hp=Math.max(0,this.player.hp-reduced);
    this.audio.hurt();
    this.shakeKick(0.12);
    this.ui.showToast(`Hit! (-${Math.round(reduced)} HP)`,1.1);
    if(this.player.hp<=0) this.onPlayerDead();
  }

  onPlayerDead(){
    this.ui.showToast("You fell. The wasteland keeps what it takes.",2.8);
    // Exit dungeon cleanly if inside one
    if(this.dungeonMgr.isInDungeon()){
      this.dungeonMgr.exit(this.player);
      if(this._dungeonEnemies){
        for(const e of this._dungeonEnemies) this.scene.remove(e);
        this._dungeonEnemies=[];
      }
    }
    this.player.hp=this.player.effectiveMaxHP();
    this.player.stamina=this.player.staminaMax;
    this.player.inVault=true;
    this.vault.setVisible(true);
    this.vault.setExteriorVisible(false);
    if(this.useHeightmap){
      this.terrain.setVisible(false);
      this.worldspace.setVisible(false);
    }
    this.dungeonMgr.setDoorsVisible(false);
    this.factionWorld.setVisible(false);
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
  /**
   * Two-pass render:
   *  Pass 1 – world (all layers except 1).  Full clear.
   *  Pass 2 – FP elements on layer 1 only.  Depth-clear only so they
   *            always appear in front of the world without Z-fighting.
   */
  renderScene(){
    // Pass 1: world geometry (layer 0 and everything except layer 1)
    this.camera.layers.enableAll();
    this.camera.layers.disable(1);
    this.renderer.clear();
    this.renderer.render(this.scene,this.camera);

    // Pass 2: first-person overlay (layer 1) – only when in FP mode
    if(this.player && this.player.camMode==="fp"){
      this.camera.layers.set(1);
      this.renderer.clearDepth();
      this.renderer.render(this.scene,this.camera);
    }

    // Restore camera to see all layers for next frame's raycasts / UI etc.
    this.camera.layers.enableAll();
  }

  renderHUD(){
    const p=this.player;
    const effMax=p.effectiveMaxHP();
    this.ui.hpFill.style.width=`${(p.hp/effMax)*100}%`;
    this.ui.stFill.style.width=`${(p.stamina/p.staminaMax)*100}%`;
    this.ui.radFill.style.width=`${(p.radiation/p.radiationMax)*100}%`;
    const xpForLevel=p.level*100;
    this.ui.xpFill.style.width=`${(p.xp/xpForLevel)*100}%`;
    this.ui.armorLbl.textContent=`Armor: ${p.armor+p.skills.mutantHide*5}  Lv.${p.level}${p.skillPoints>0?" ["+p.skillPoints+" SP]":""}`;

    const w=p.weapon, id=w.id;
    this.ui.ammo.querySelector(".small").textContent=w.name;
    if(w.fireMode==="melee"){
      this.ui.ammo.querySelector(".big").textContent="MELEE";
    }else{
      this.ui.ammo.querySelector(".big").textContent=`${p.mag[id]} / ${p.reserve[id]}`;
    }

    const yaw=((p.yaw%(Math.PI*2))+Math.PI*2)%(Math.PI*2);
    const deg=Math.round(yaw*180/Math.PI);
    this.ui.comp.textContent=`Heading: ${deg}°  •  ${p.inVault?"Vault 811":"Wasteland"}`;

    // Quest objectives: prefer new questSys, fall back to legacy quest.log for backward compat
    const qObj=this.questSys.topObjective();
    this.ui.obj.textContent=qObj?`Objective: ${qObj}`:(this.quest?.log?.length?`Objective: ${this.quest.log[0]}`:"");

    // Radiation warning flash
    if(p.radiation>60){
      this.ui.radFill.style.background=`rgba(255,${Math.floor(100-p.radiation)},50,.85)`;
    }else if(p.radiation>25){
      this.ui.radFill.style.background=`rgba(200,255,50,.75)`;
    }else{
      this.ui.radFill.style.background="rgba(100,255,50,.75)";
    }
  }

  _bindMouseShooting(){
    window.addEventListener("mousedown",e=>{
      if(e.button!==0) return;
      if(this.mode!=="play") return;
      if(!this.input.mouse.locked) return;
      if(this.player.weapon.fireMode==="semi"||this.player.weapon.fireMode==="melee") this.player.tryFire(this);
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

  /** Returns radiation gain per second at a world position based on nearby POI sources */
  getRadiationAtPos(pos){
    let rad=0;
    // Base ambient wasteland radiation (very low)
    if(!this.player.inVault) rad+=0.3;
    // Worldspace radiation zones (heightmap POIs)
    if(this.useHeightmap && this.worldspace){
      rad+=this.worldspace.getRadiationAtPos(pos);
    }
    // Industrial stacks (Coastal Works POI): high radiation within 30m
    // Rail station wreckage: moderate radiation within 25m
    for(const [,tile] of this.world.tiles){
      tile.g.traverse(child=>{
        if(!child.userData?.poi) return;
        const wp=new THREE.Vector3();
        child.getWorldPosition(wp);
        const dx=pos.x-wp.x, dz=pos.z-wp.z;
        const distSq=dx*dx+dz*dz;
        if(child.userData.poi==="Coastal Works" && distSq<900){ // within 30m
          rad+=3.0*(1-Math.sqrt(distSq)/30);
        }else if((child.userData.poi==="Collapsed Rail Station"||child.userData.poi==="Destroyed Railway") && distSq<625){ // within 25m
          rad+=1.8*(1-Math.sqrt(distSq)/25);
        }
      });
    }
    return rad;
  }

  showToast(msg,dur){this.ui.showToast(msg,dur);}

  async loop(){
    requestAnimationFrame(()=>this.loop());
    const dt=Math.min(0.033,this.clock.getDelta());

    // global hotkeys
    if(this.input.pressed("Escape")){
      if(this.mode==="editor") this.exitEditor();
      else if(this.mode==="play") this.showPause();
      else if(this.mode==="dialogue") this.closeDialogue();
      else if(this.mode==="terminal") this.closeTerminalUI();
      else if(this.mode==="pipboy") this.closePipboy();
      else if(this.mode==="pause"||this.mode==="inventory"||this.mode==="skills"||this.mode==="crafting"){ this.resume(); this.ui.inv.style.display="none"; this.ui.skillTree.style.display="none"; this.ui.craftPanel.style.display="none"; }
      else if(this.mode==="intro") this.endIntro();
    }
    if(this.input.pressed("F10")){
      if(this.mode==="play") this.enterEditor();
      else if(this.mode==="editor") this.exitEditor();
    }
    if(this.input.pressed("Tab")){
      if(this.mode==="play") this.openPipboy("journal");
      else if(this.mode==="pipboy") this.closePipboy();
      // dialogue/terminal: blocked by openPipboy guard
    }
    if(this.input.pressed("KeyP")){
      if(this.mode==="play") this.openPipboy("journal");
      else if(this.mode==="pipboy") this.closePipboy();
    }

    if(this.mode==="play"){
      // lazily start audio after any action
      if(!this.audio.started && (this.input.pressed("KeyW")||this.input.pressed("KeyA")||this.input.pressed("KeyS")||this.input.pressed("KeyD")||this.input.pressed("KeyE"))) await this.ensureAudio();

      if(this.input.pressed("KeyC")){ this.player.camMode=this.player.camMode==="fp"?"tp":"fp"; this.ui.showToast(this.player.camMode==="fp"?"First-person":"Third-person"); }
      if(this.input.pressed("Digit1")) this.player.setWeapon(0);
      if(this.input.pressed("Digit2")) this.player.setWeapon(1);
      if(this.input.pressed("Digit3")) this.player.setWeapon(2);
      if(this.input.pressed("Digit4")) this.player.setWeapon(3);
      if(this.input.pressed("KeyR")) this.player.requestReload(this);
      if(this.input.pressed("KeyI")) this.openPipboy("inv");
      if(this.input.pressed("KeyE")) this.doInteract();
      if(this.input.pressed("KeyK")) this.openPipboy("stats");
      if(this.input.pressed("KeyJ")) this.openPipboy("factions");

      // Debug: F8 toggle POI markers, F9 teleport to POIs
      if(this.input.pressed("F8") && this.worldspace){
        const on=this.worldspace.toggleDebug();
        this.ui.showToast(on?"POI markers ON":"POI markers OFF");
      }
      if(this.input.pressed("F9") && this.worldspace && !this.player.inVault){
        const targets=this.worldspace.getTeleportTargets();
        if(targets.length>0){
          const t=targets[this._debugTeleportIdx % targets.length];
          this._debugTeleportIdx++;
          const ty=this.terrain.ready?this.terrain.sampleHeight(t.x,t.z)+1.6:(t.y||0)+1.6;
          this.player.pos.set(t.x,ty,t.z);
          this.ui.showToast(`Teleported to: ${t.name}`);
        }
      }

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

    // Pip-Boy mode: number keys to switch tabs (1-5)
    if(this.mode==="pipboy"){
      const pipTabKeys=["journal","inv","stats","factions","settings"];
      for(let i=0;i<5;i++){
        if(this.input.pressed("Digit"+(i+1))){
          this.pipboyTab=pipTabKeys[i];
          this.renderPipboy();
          break;
        }
      }
    }

    // mode-specific updates
    if(this.mode==="editor"){
      this.updateTime(dt);
      this.editor.update(dt);
      this.renderScene();
      return;
    }
    if(this.mode==="intro"){
      this.vault.setVisible(true);
      this.vault.setExteriorVisible(false);
      this.updateTime(dt);
      this.updateCutscene(dt);
      this.renderHUD();
      this.renderScene();
      return;
    }
    if(this.mode==="title"){
      this.updateTime(dt);
      this.camera.position.set(0,3.4,10);
      this.camera.lookAt(0,3.2,0);
      this.renderHUD();
      this.renderScene();
      return;
    }
    if(this.mode==="pause"||this.mode==="inventory"||this.mode==="skills"||this.mode==="crafting"){
      this.updateTime(dt);
      this.renderHUD();
      this.renderScene();
      return;
    }
    if(this.mode==="pipboy"){
      this.updateTime(dt);
      // Keep updating player models for smooth Pip-Boy animation
      this.player.updateModels(dt);
      this.player.updateCamera(dt,this);
      this.renderHUD();
      this.renderScene();
      return;
    }
    if(this.mode==="dialogue"){
      this.updateTime(dt);
      this.npcMgr.update(dt, this.player.pos, this.dialogueCtrl.currentNpcId);
      if(!this.player.inVault) this.npcMgr.updateOutside(dt, this.player.pos);
      this.renderHUD();
      this.renderScene();
      return;
    }
    if(this.mode==="terminal"){
      this.updateTime(dt);
      this.renderHUD();
      this.renderScene();
      return;
    }

    // PLAY update
    this.updateTime(dt);
    this.player.update(dt,this.input,this);
    const inDungeon=this.dungeonMgr.isInDungeon();
    this.vault.setVisible(this.player.inVault && !inDungeon);
    this.vault.setExteriorVisible(!this.player.inVault && !inDungeon);
    this.npcMgr.setVisible(this.player.inVault && !inDungeon);
    this.npcMgr.setOutsideVisible(!this.player.inVault && !inDungeon);
    this.outpost.group.visible=!this.player.inVault && !inDungeon;
    this.dungeonMgr.setDoorsVisible(!this.player.inVault && !inDungeon);

    // Heightmap terrain + worldspace visibility
    const outsideActive=!this.player.inVault && !inDungeon;
    if(this.useHeightmap){
      this.terrain.setVisible(outsideActive);
      this.worldspace.setVisible(outsideActive);
      // Hide tile-based static geometry when heightmap is active outside
      this.world.static.visible=!outsideActive;
      this.world.interact.visible=outsideActive; // keep interactables (crates from tiles)
      this.world.enemies.visible=outsideActive;
      this.factionWorld.setVisible(outsideActive);
    }
    if(inDungeon){
      this.world.static.visible=false;
      this.world.interact.visible=false;
      this.world.enemies.visible=false;
      this.factionWorld.setVisible(false);
      if(this.useHeightmap){
        this.terrain.setVisible(false);
        this.worldspace.setVisible(false);
      }
    }

    if(!this.player.inVault && !inDungeon){
      if(this.useHeightmap){
        // Use heightmap terrain — still update world for enemies/interactables only
        this.world.update(this.player.pos);
        // Ground enemies on terrain
        for(const e of this.world.enemies.children){
          if(e.userData?.enemy && this.terrain.ready){
            e.position.y=this.terrain.sampleHeight(e.position.x,e.position.z);
          }
        }
        // One-time: ground outpost on terrain
        if(this.terrain.ready && !this._outpostGrounded){
          this._outpostGrounded=true;
          const oc=OUTPOST_CENTER;
          this.outpost.group.position.y=this.terrain.sampleHeight(oc.x,oc.z);
          // Ground vault exterior on terrain
          const vaultPoi=this.worldspace.pois.find(p=>p.type==="vault");
          if(vaultPoi){
            const vy=this.terrain.sampleHeight(vaultPoi.world.x,vaultPoi.world.z);
            this.vault.exterior.position.y=vy;
          }
          // Ground dungeon doors on terrain
          for(const dm of this.dungeonMgr.doorMeshes){
            const dp=dm.group.position;
            dp.y=this.terrain.sampleHeight(dp.x,dp.z);
          }
          // Ground outside NPCs on terrain
          if(this.npcMgr.outsideNPCs){
            for(const npc of this.npcMgr.outsideNPCs){
              const np=npc.position;
              const ty=this.terrain.sampleHeight(np.x,np.z);
              np.y=ty;
              if(npc.userData) npc.userData._baseY=ty;
            }
          }
        }
      }else{
        this.world.update(this.player.pos);
      }
      // Update faction world (patrols, skirmishes, rep hostility)
      this.factionWorld.setVisible(true);
      const loadedKeys=new Set(this.world.tiles.keys());
      this.factionWorld.update(dt, this.player.pos, loadedKeys, this.useHeightmap?this.terrain:null);
      // Ambush encounter toast
      if(this.factionWorld._ambushTriggered){
        this.ui.showToast("You feel watched...",3.0);
      }
      // Roadblock warning toast
      if(this.questSys.getFlag("roadblock_warned") && !this._roadblockToastShown){
        this._roadblockToastShown=true;
        this.ui.showToast("Warden Roadblock: \"Halt! You are not welcome here.\"",3.5);
      }
      if(!this.questSys.getFlag("roadblock_warned")){ this._roadblockToastShown=false; }
      // Decay faction heat slowly over time
      this.questSys.decayHeat(dt);
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

      // --- Outpost hostility state update ---
      const nowHostile=isOutpostHostile(this.questSys);
      if(nowHostile && !this._outpostHostile){
        // Transition to hostile
        this._outpostHostile=true;
        applyHostileVisuals(this.outpost);
        // Make outpost-area faction units (Wardens) attack on sight via heat
        this.questSys.changeHeat("wardens",40);
      } else if(!nowHostile && this._outpostHostile && isOutpostRecovered(this.questSys)){
        // Transition to neutral (recovery)
        this._outpostHostile=false;
        applyNeutralVisuals(this.outpost);
      }

      // --- Safe zone enforcement (every 3 seconds, not every frame) ---
      // Disabled when outpost is hostile
      this._safeZoneTimer=(this._safeZoneTimer||0)+dt;
      if(this._safeZoneTimer>SAFE_ZONE_CHECK_INTERVAL){
        this._safeZoneTimer=0;
        if(!this._outpostHostile){
          enforceSafeZone(this.world.enemies);
        }
      }

      // World trigger: torii proximity (Q4 Shrine Warden Warning)
      const TORII_TRIGGER_RADIUS=30;
      if(!this.questSys.getFlag("reachedTorii")){
        this._toriiCheckTimer=(this._toriiCheckTimer||0)+dt;
        if(this._toriiCheckTimer>2.0){ // check every 2 seconds, not every frame
          this._toriiCheckTimer=0;
          const pp=this.player.pos;
          let found=false;
          // Check worldspace POIs (heightmap mode)
          if(this.useHeightmap && this.worldspace){
            for(const poi of this.worldspace.pois){
              if(poi.type==="torii"){
                const dx=pp.x-poi.world.x, dz=pp.z-poi.world.z;
                if(dx*dx+dz*dz<TORII_TRIGGER_RADIUS*TORII_TRIGGER_RADIUS){ found=true; break; }
              }
            }
          }
          // Also check tile-based POIs (legacy/fallback)
          if(!found){
            for(const [,tile] of this.world.tiles){
              tile.g.traverse(child=>{
                if(child.userData?.poi==="Silent Torii" && !found){
                  const wp=new THREE.Vector3();
                  child.getWorldPosition(wp);
                  const dx=pp.x-wp.x, dz=pp.z-wp.z;
                  if(dx*dx+dz*dz<TORII_TRIGGER_RADIUS*TORII_TRIGGER_RADIUS){ found=true; }
                }
              });
            }
          }
          if(found){
            this.questSys.setFlag("reachedTorii",true);
            this.questSys.addObjective("Heed the Shrine Warden warning");
            this.questSys.addLog("Reached a torii gate. The Shrine Wardens are watching.");
            this.questSys.setStage("q4_shrine_warning",10);
            this.questSys.changeRep("wardens",-5);
            this.ui.showToast("The air feels heavy near the torii. You are being watched.",3.0);
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
          let railFound=false;
          // Check worldspace POIs (heightmap mode)
          if(this.useHeightmap && this.worldspace){
            for(const poi of this.worldspace.pois){
              if(poi.type==="rail"){
                const dx=pp.x-poi.world.x, dz=pp.z-poi.world.z;
                if(dx*dx+dz*dz<RAIL_TRIGGER_RADIUS*RAIL_TRIGGER_RADIUS){ railFound=true; break; }
              }
            }
          }
          if(!railFound){
            for(const [,tile] of this.world.tiles){
              tile.g.traverse(child=>{
                if((child.userData?.poi==="Collapsed Rail Station"||child.userData?.poi==="Destroyed Railway") && !railFound){
                  const wp=new THREE.Vector3();
                  child.getWorldPosition(wp);
                  const dx=pp.x-wp.x, dz=pp.z-wp.z;
                  if(dx*dx+dz*dz<RAIL_TRIGGER_RADIUS*RAIL_TRIGGER_RADIUS){ railFound=true; }
                }
              });
            }
          }
          if(railFound){
            this.questSys.setFlag("reachedRailStation",true);
            this.questSys.completeObjective("Investigate radio signals near the rail stations");
            this.questSys.addObjective("Report findings to Guard Kenji");
            this.questSys.addLog("Reached a rail station. Faint coded radio pings detected — the Rail Ghost Union is here.");
            this.questSys.setStage("q3_rail_whisper",20);
            this.ui.showToast("Radio static crackles. Coded pings echo in the tunnels. Someone is out here.",3.0);
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
    if(this.player.inVault && !inDungeon) this.npcMgr.update(dt, this.player.pos, null);
    if(!this.player.inVault && !inDungeon) this.updateEnemies(dt);
    // Update dungeon enemies
    if(inDungeon && this._dungeonEnemies){
      this._updateDungeonEnemies(dt);
    }
    this.updateSpit(dt);
    this.particles.update(dt);
    this.updateShake(dt);

    // Update companion
    if(this.companionMgr.isActive()){
      this.companionMgr.setVisible(!this.player.inVault && !inDungeon);
      const enemyGroup=inDungeon?null:this.world.enemies;
      this.companionMgr.update(dt, this.player.pos, enemyGroup, (enemy, dmg)=>{
        enemy.userData.hp-=dmg;
        enemy.userData.aggro=1;
        this.enemyBarShow(enemy.userData);
        if(enemy.userData.hp<=0) this.killEnemy(enemy);
      });
      // Ground companion on terrain when outside
      if(!this.player.inVault && this.useHeightmap && this.terrain.ready && this.companionMgr.active?.mesh){
        const cm=this.companionMgr.active.mesh;
        cm.position.y=this.terrain.sampleHeight(cm.position.x,cm.position.z);
      }
    }

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
      this.player.hp=Math.min(this.player.effectiveMaxHP(),this.player.hp+3.5*dt);
    }

    this.renderHUD();
    this.renderScene();
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
let game;
try{
  game=new Game();
  // Hide loading overlay once the game is up
  const loadEl=document.getElementById("loading");
  if(loadEl) loadEl.style.display="none";
}catch(err){
  console.error("Game failed to start:",err);
  const loadEl=document.getElementById("loading");
  if(loadEl){loadEl.className="error";const sub=loadEl.querySelector(".sub");if(sub)sub.textContent="Error: "+err.message+" — try clearing your cache and refreshing.";}
}

// Start audio on first gesture (optional)
window.addEventListener("click", async ()=>{
  if(game) await game.ensureAudio();
}, {once:true});
