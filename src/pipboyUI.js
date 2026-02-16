// Pip-Boy 811 UI for Wasteland Japan — Vault 811
// Unified meta screen: Journal, Inventory, Stats, Factions, Settings
// DOM overlay with Fallout-ish monospace aesthetic.

const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));

export const PIPBOY_CSS = `
  .pipboy-overlay{position:absolute;left:50%;top:52%;transform:translate(-50%,-50%);width:min(640px,88vw);max-height:72vh;overflow:auto;border-radius:10px;border:2px solid rgba(80,255,80,.45);background:rgba(5,18,5,.94);color:#33ff66;font-family:"Courier New",Courier,monospace;display:none;pointer-events:auto;padding:0;box-shadow:0 0 40px rgba(30,255,60,.15),inset 0 0 30px rgba(0,0,0,.5)}
  .pipboy-overlay *{color:#33ff66}
  .pipboy-header{padding:10px 16px 6px;border-bottom:1px solid rgba(80,255,80,.2);font-size:11px;letter-spacing:1px;display:flex;justify-content:space-between;align-items:center;opacity:.75}
  .pipboy-header-title{font-weight:900;font-size:13px;letter-spacing:2px}
  .pipboy-tabs{display:flex;border-bottom:1px solid rgba(80,255,80,.3);background:rgba(0,0,0,.3)}
  .pipboy-tab{flex:1;text-align:center;padding:10px 6px;cursor:pointer;pointer-events:auto;font-size:12px;font-weight:800;letter-spacing:1px;text-transform:uppercase;opacity:.6;border-bottom:2px solid transparent;transition:opacity .15s}
  .pipboy-tab:hover{opacity:.85}
  .pipboy-tab.active{opacity:1;border-bottom-color:#33ff66;background:rgba(50,255,80,.06)}
  .pipboy-content{padding:14px 16px;min-height:200px}
  .pipboy-content .k{color:#33ff66}
  .pipboy-content .section-title{font-weight:900;font-size:14px;margin:12px 0 6px;letter-spacing:1px;text-transform:uppercase;border-bottom:1px solid rgba(80,255,80,.15);padding-bottom:4px}
  .pipboy-content .section-title:first-child{margin-top:0}
  .pipboy-content .obj-active{opacity:1;font-weight:700}
  .pipboy-content .obj-done{opacity:.55;text-decoration:line-through}
  .pipboy-content .obj-failed{opacity:.45;text-decoration:line-through;color:#ff6644}
  .pipboy-content .obj-failed *{color:#ff6644}
  .pipboy-content .log-entry{padding:4px 0;border-bottom:1px solid rgba(80,255,80,.08);font-size:12px;opacity:.85}
  .pipboy-content .clue-known{opacity:1}.pipboy-content .clue-unknown{opacity:.4}
  .pipboy-content .inv-item{display:flex;gap:10px;justify-content:space-between;align-items:center;padding:8px 10px;border-bottom:1px solid rgba(80,255,80,.1)}
  .pipboy-content .inv-list{border:1px solid rgba(80,255,80,.2);border-radius:8px;overflow:hidden}
  .pipboy-content .chip{padding:5px 9px;border-radius:999px;border:1px solid rgba(80,255,80,.35);background:rgba(50,255,80,.08);color:#33ff66;cursor:pointer;pointer-events:auto;font-size:11px;font-family:inherit}
  .pipboy-content .chip:hover{background:rgba(50,255,80,.18)}
  .pipboy-content .skill-row{display:flex;justify-content:space-between;align-items:center;padding:7px 0;border-bottom:1px solid rgba(80,255,80,.12)}
  .pipboy-content .stat-line{padding:3px 0;font-size:13px}
  .pipboy-content .rep-bar-wrap{display:flex;align-items:center;gap:8px;margin:4px 0}
  .pipboy-content .rep-bar{width:180px;height:10px;border:1px solid rgba(80,255,80,.3);background:rgba(0,0,0,.3);position:relative;border-radius:3px;overflow:hidden}
  .pipboy-content .rep-fill{position:absolute;top:0;height:100%;background:rgba(50,255,80,.5);border-radius:3px}
  .pipboy-content .rep-marker{position:absolute;top:-1px;width:2px;height:12px;background:#33ff66}
  .pipboy-content .faction-block{margin-bottom:14px}
  .pipboy-content .faction-name{font-weight:900;font-size:13px;letter-spacing:.5px}
  .pipboy-content .faction-desc{font-size:11px;opacity:.65;margin:2px 0 4px}
  .pipboy-content .settings-row{display:flex;align-items:center;gap:12px;padding:8px 0;border-bottom:1px solid rgba(80,255,80,.1)}
  .pipboy-content .settings-row label{min-width:160px;font-size:12px;opacity:.85}
  .pipboy-content .settings-row input[type=range]{pointer-events:auto;accent-color:#33ff66;flex:1}
  .pipboy-footer{padding:6px 16px 8px;border-top:1px solid rgba(80,255,80,.2);font-size:11px;opacity:.5;letter-spacing:.5px;text-align:center}
  .pipboy-scanline{pointer-events:none;position:absolute;inset:0;background:repeating-linear-gradient(0deg,transparent,transparent 2px,rgba(0,0,0,.06) 2px,rgba(0,0,0,.06) 4px);border-radius:10px}
`;

const TAB_NAMES = ["JOURNAL", "INV", "STATS", "FACTIONS", "SETTINGS"];

const STORY_CLUE_FLAGS = [
  { key: "readVaultRedactionLog", label: "Vault Redaction Log" },
  { key: "railFrequencyDecoded", label: "Rail Frequency Decoded" },
  { key: "discoveredShrineOutpost", label: "Shrine Outpost Discovered" },
  { key: "soldIntelToJiro", label: "Intel Sold to Jiro" },
  { key: "reportedJiroToKenji", label: "Reported Jiro to Kenji" },
  { key: "vaultLieRevealed", label: "Vault Lie Revealed" },
];

const FACTION_INFO = {
  vault: { name: "Vault Directorate", desc: "Internal power bloc running Vault 811. Maintains order through information control." },
  wardens: { name: "Shrine Wardens", desc: "Wasteland faction that protects old sacred sites. Anti-technology, suspicious of vault dwellers." },
  rail: { name: "Rail Ghost Union", desc: "Salvagers and traders in collapsed rail tunnels. Pragmatic survivors who trade information and scrap." },
};

const SKILL_HINTS = {
  toughness: "Used in dialogue intimidation checks",
  quickHands: "Used for lockpicking and reload speed",
  scavenger: "Used for loot chance and dialogue checks",
  ironSights: "Boosts weapon damage per level",
  mutantHide: "Adds passive armor per level",
};

/**
 * Build the Pip-Boy DOM structure and attach to a UI root.
 * Returns a controller object with references.
 */
export function buildPipboyUI(uiRoot) {
  const overlay = document.createElement("div");
  overlay.className = "pipboy-overlay";
  uiRoot.appendChild(overlay);

  // Header
  const header = document.createElement("div");
  header.className = "pipboy-header";
  overlay.appendChild(header);
  const headerTitle = document.createElement("span");
  headerTitle.className = "pipboy-header-title";
  headerTitle.textContent = "PIP-BOY 811";
  header.appendChild(headerTitle);
  const headerInfo = document.createElement("span");
  header.appendChild(headerInfo);

  // Tabs
  const tabsBar = document.createElement("div");
  tabsBar.className = "pipboy-tabs";
  overlay.appendChild(tabsBar);
  const tabBtns = TAB_NAMES.map((name, i) => {
    const t = document.createElement("div");
    t.className = "pipboy-tab";
    t.textContent = name;
    t.dataset.tab = name.toLowerCase();
    t.dataset.idx = String(i);
    tabsBar.appendChild(t);
    return t;
  });

  // Content
  const content = document.createElement("div");
  content.className = "pipboy-content";
  overlay.appendChild(content);

  // Footer
  const footer = document.createElement("div");
  footer.className = "pipboy-footer";
  footer.textContent = "Tab/P: Close \u2022 1-5: Tabs \u2022 Esc: Close";
  overlay.appendChild(footer);

  // Scanline effect
  const scanline = document.createElement("div");
  scanline.className = "pipboy-scanline";
  overlay.appendChild(scanline);

  return { overlay, headerInfo, tabBtns, content, tabNames: TAB_NAMES };
}

/**
 * Open the Pip-Boy and show a specific tab.
 */
export function openPipboy(ui, tabName) {
  ui.overlay.style.display = "block";
}

/**
 * Close the Pip-Boy.
 */
export function closePipboy(ui) {
  ui.overlay.style.display = "none";
}

/**
 * Render Pip-Boy content from live game state.
 * @param {object} ui - from buildPipboyUI
 * @param {string} activeTab - current tab key
 * @param {object} game - Game instance with player, questSys, save, audio, etc.
 * @param {object} deps - { ItemDB, SkillDefs, WeaponDefs, useItem, dropItem }
 */
export function renderPipboy(ui, activeTab, game, deps) {
  // Update header info
  const loc = game.player.inVault ? "Vault 811" : "Wasteland";
  const t = game.save.timeOfDay;
  const hours = Math.floor(t * 24);
  const mins = Math.floor((t * 24 - hours) * 60);
  ui.headerInfo.textContent = `${loc} \u2022 ${String(hours).padStart(2, "0")}:${String(mins).padStart(2, "0")}`;

  // Highlight active tab
  ui.tabBtns.forEach(btn => {
    btn.classList.toggle("active", btn.dataset.tab === activeTab);
  });

  const c = ui.content;
  c.innerHTML = "";

  switch (activeTab) {
    case "journal": _renderJournal(c, game); break;
    case "inv": _renderInv(c, game, deps); break;
    case "stats": _renderStats(c, game, deps); break;
    case "factions": _renderFactions(c, game); break;
    case "settings": _renderSettings(c, game, deps); break;
    default: _renderJournal(c, game);
  }
}

// ---- Tab Renderers ----

function _renderJournal(c, game) {
  const qs = game.questSys;
  let html = "";

  // Top objective
  const top = qs.topObjective();
  html += `<div class="section-title">Current Objective</div>`;
  html += top
    ? `<div class="stat-line obj-active" style="font-size:14px">\u25B6 ${esc(top)}</div>`
    : `<div class="stat-line" style="opacity:.5">No active objective</div>`;

  // All objectives
  html += `<div class="section-title">Objectives</div>`;
  if (qs.objectives.length === 0) {
    html += `<div class="stat-line" style="opacity:.5">None yet.</div>`;
  } else {
    for (const obj of qs.objectives) {
      const cls = obj.status === "done" ? "obj-done" : obj.status === "failed" ? "obj-failed" : "obj-active";
      const icon = obj.status === "done" ? "\u2713" : obj.status === "failed" ? "\u2717" : "\u25CB";
      html += `<div class="stat-line ${cls}">${icon} ${esc(obj.text)}</div>`;
    }
  }

  // Quest log
  html += `<div class="section-title">Quest Log</div>`;
  if (qs.log.length === 0) {
    html += `<div class="stat-line" style="opacity:.5">No entries.</div>`;
  } else {
    const entries = [...qs.log].reverse();
    for (const entry of entries) {
      const ago = _relativeTime(entry.time);
      html += `<div class="log-entry"><span style="opacity:.5">[${ago}]</span> ${esc(entry.text)}</div>`;
    }
  }

  // Story clues
  html += `<div class="section-title">Story Clues</div>`;
  for (const clue of STORY_CLUE_FLAGS) {
    const known = qs.getFlag(clue.key);
    html += `<div class="stat-line ${known ? "clue-known" : "clue-unknown"}">${known ? "\u2713" : "?"} ${clue.label}</div>`;
  }

  c.innerHTML = html;
}

function _renderInv(c, game, deps) {
  const p = game.player;
  const w = p.weight();
  const { ItemDB, useItem, dropItem, renderCallback } = deps;
  let html = `<div class="section-title">Inventory</div>`;
  html += `<div class="k" style="margin-bottom:8px;font-size:12px">Weight: ${w.toFixed(1)}/${p.maxWeight} \u2022 Equipped: ${p.weapon.name} \u2022 Armor: ${p.armor}</div>`;
  html += `<div class="inv-list">`;
  if (p.inv.length === 0) {
    html += `<div class="inv-item" style="opacity:.5;justify-content:center">Empty</div>`;
  } else {
    p.inv.forEach((item, idx) => {
      const def = ItemDB[item.id] || { name: item.id, type: "junk", weight: 0, desc: "" };
      const useLabel = def.type === "consumable" ? "Use" : def.type === "weapon" ? "Equip" : def.type === "armor" ? "Wear" : def.type === "mod" ? "Apply" : "Inspect";
      html += `<div class="inv-item">
        <div><div style="font-weight:800">${esc(def.name)} <span class="k">x${item.qty || 1}</span></div><div class="k" style="font-size:11px">${esc(def.desc)} \u2022 ${def.weight}wt</div></div>
        <div style="display:flex;gap:6px">
          <div class="chip" data-pipuse="${idx}">${useLabel}</div>
          <div class="chip" data-pipdrop="${idx}">Drop</div>
        </div>
      </div>`;
    });
  }
  html += `</div>`;

  // Ammo snapshot
  html += `<div class="section-title" style="margin-top:14px">Ammo</div>`;
  html += `<div class="stat-line">Pistol: ${p.mag.pistol}/${p.reserve.pistol}</div>`;
  html += `<div class="stat-line">Rifle: ${p.mag.rifle}/${p.reserve.rifle}</div>`;
  html += `<div class="stat-line">Shotgun: ${p.mag.shotgun}/${p.reserve.shotgun}</div>`;

  c.innerHTML = html;

  // Bind use/drop
  c.querySelectorAll("[data-pipuse]").forEach(btn => {
    btn.addEventListener("click", () => { useItem(parseInt(btn.dataset.pipuse, 10)); renderCallback(); });
  });
  c.querySelectorAll("[data-pipdrop]").forEach(btn => {
    btn.addEventListener("click", () => { dropItem(parseInt(btn.dataset.pipdrop, 10)); renderCallback(); });
  });
}

function _renderStats(c, game, deps) {
  const p = game.player;
  const { SkillDefs, renderCallback } = deps;
  let html = "";

  const effMax = p.effectiveMaxHP ? p.effectiveMaxHP() : p.hpMax;
  const totalArmor = p.armor + (p.skills.mutantHide || 0) * 5;
  const armorPct = Math.round(clamp(totalArmor * 0.006, 0, 0.45) * 100);

  html += `<div class="section-title">Vitals</div>`;
  html += `<div class="stat-line">HP: ${Math.round(p.hp)} / ${effMax}${effMax < p.hpMax ? ` <span style="color:#ff8844">(base ${p.hpMax})</span>` : ""}</div>`;
  html += `<div class="stat-line">Stamina: ${Math.round(p.stamina)} / ${p.staminaMax}</div>`;
  html += `<div class="stat-line">Radiation: ${Math.round(p.radiation)} / ${p.radiationMax}${p.radiation > 25 ? ` <span style="color:#ff8844">(-${Math.round(p.radiation * 0.5)}% max HP)</span>` : ""}</div>`;
  html += `<div class="stat-line">Armor: ${totalArmor} <span style="opacity:.6">(${armorPct}% reduction)</span></div>`;
  html += `<div class="stat-line">Level: ${p.level}${p.xp !== undefined ? ` (XP: ${p.xp}/${p.level * 100})` : ""}</div>`;

  html += `<div class="section-title">Current Weapon</div>`;
  html += `<div class="stat-line">${esc(p.weapon.name)} \u2022 Mag: ${p.mag[p.weapon.id]}/${p.reserve[p.weapon.id]}</div>`;

  html += `<div class="section-title">Skills${p.skillPoints > 0 ? ` <span style="color:#ffdd44;font-size:12px">(${p.skillPoints} point${p.skillPoints > 1 ? "s" : ""} available)</span>` : ""}</div>`;
  const skillOrder = ["toughness", "scavenger", "quickHands", "ironSights", "mutantHide"];
  for (const key of skillOrder) {
    const def = SkillDefs[key];
    if (!def) continue;
    const lvl = p.skills[key] || 0;
    const canUp = p.skillPoints > 0 && lvl < def.maxLvl;
    const hint = SKILL_HINTS[key] || "";
    html += `<div class="skill-row">
      <div><div style="font-weight:800;font-size:13px">${esc(def.name)}</div><div class="k" style="font-size:11px">${esc(def.desc)}${hint ? " \u2014 " + esc(hint) : ""}</div></div>
      <div style="display:flex;align-items:center;gap:8px">
        <span style="font-size:13px;opacity:.9">${lvl}/${def.maxLvl}</span>
        ${canUp ? `<div class="chip" data-pipskill="${key}">+</div>` : (lvl >= def.maxLvl ? `<span class="k">MAX</span>` : "")}
      </div>
    </div>`;
  }

  c.innerHTML = html;

  // Bind skill upgrade buttons
  c.querySelectorAll("[data-pipskill]").forEach(btn => {
    btn.addEventListener("click", () => {
      const sk = btn.dataset.pipskill;
      if (p.skillPoints > 0 && p.skills[sk] < SkillDefs[sk].maxLvl) {
        p.skills[sk]++;
        p.skillPoints--;
        if (sk === "toughness") p.hpMax = 100 + p.skills.toughness * 15;
        if (sk === "mutantHide") p.armor = p.skills.mutantHide * 5;
        if (renderCallback) renderCallback();
      }
    });
  });
}

function _repBarStyle(rep) {
  const pct = ((rep + 100) / 200) * 100;
  if (rep >= 0) return `left:50%;width:${(rep / 200) * 100}%`;
  return `left:${pct}%;width:${50 - pct}%`;
}

function _renderFactions(c, game) {
  const qs = game.questSys;
  let html = `<div class="section-title">Faction Reputation</div>`;

  for (const [factionKey, info] of Object.entries(FACTION_INFO)) {
    const rep = qs.getRep(factionKey);
    const mult = qs.vendorMultiplier(factionKey);

    let repLabel = "Neutral";
    if (rep >= 50) repLabel = "Allied";
    else if (rep >= 20) repLabel = "Friendly";
    else if (rep <= -50) repLabel = "Hostile";
    else if (rep <= -20) repLabel = "Unfriendly";

    html += `<div class="faction-block">
      <div class="faction-name">${esc(info.name)}</div>
      <div class="faction-desc">${esc(info.desc)}</div>
      <div class="rep-bar-wrap">
        <span style="font-size:11px;opacity:.5;min-width:30px">-100</span>
        <div class="rep-bar">
          <div class="rep-marker" style="left:50%"></div>
          <div class="rep-fill" style="${_repBarStyle(rep)}"></div>
        </div>
        <span style="font-size:11px;opacity:.5;min-width:30px">+100</span>
      </div>
      <div class="stat-line" style="font-size:12px">Rep: ${rep} (${repLabel}) \u2022 Vendor prices: x${mult.toFixed(1)}</div>
    </div>`;
  }

  c.innerHTML = html;
}

function _renderSettings(c, game, deps) {
  let html = `<div class="section-title">Settings</div>`;
  html += `<div class="settings-row"><label>Mouse Sensitivity</label><input type="range" id="pb-sens" min="0.001" max="0.006" step="0.0001"></div>`;
  html += `<div class="settings-row"><label>Graphics Quality</label><input type="range" id="pb-quality" min="0" max="2" step="1"></div>`;
  html += `<div class="settings-row"><label>Master Volume</label><input type="range" id="pb-volume" min="0" max="1" step="0.01"></div>`;
  c.innerHTML = html;

  // Set current values and bind
  const sens = c.querySelector("#pb-sens");
  sens.value = String(game.input.mouse.sens);
  sens.addEventListener("input", () => { game.input.mouse.sens = parseFloat(sens.value); });

  const quality = c.querySelector("#pb-quality");
  quality.value = "1";
  quality.addEventListener("input", () => { if (game.applyQuality) game.applyQuality(parseInt(quality.value, 10)); });

  const vol = c.querySelector("#pb-volume");
  vol.value = String(game.audio?.master?.gain?.value ?? 0.6);
  vol.addEventListener("input", () => { game.audio.setMaster(parseFloat(vol.value)); });
}

// ---- Helpers ----

function esc(str) {
  const d = document.createElement("div");
  d.textContent = str;
  return d.innerHTML;
}

function _relativeTime(ts) {
  if (!ts) return "???";
  const diff = Date.now() - ts;
  if (diff < 60000) return "just now";
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  return `${Math.floor(diff / 86400000)}d ago`;
}
