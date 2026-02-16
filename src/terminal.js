// Terminal UI for Wasteland Japan — Vault 811
// Minimal in-game terminal overlay: shows log entries, allows unlocking doors.
// Persistence via quest flags. Integrated with existing UI root.

// ---- Terminal CSS (appended to style once) ----
export const TERMINAL_CSS = `
  .term-overlay{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);width:min(540px,85vw);max-height:70vh;overflow:auto;border-radius:8px;border:2px solid rgba(80,255,80,.5);background:rgba(5,14,5,.94);color:#33ff66;font-family:"Courier New",Courier,monospace;display:none;pointer-events:auto;padding:0;box-shadow:0 0 40px rgba(30,255,60,.12),inset 0 0 20px rgba(0,0,0,.5)}
  .term-overlay *{color:#33ff66}
  .term-header{padding:10px 14px 6px;border-bottom:1px solid rgba(80,255,80,.25);font-weight:900;font-size:14px;letter-spacing:1px;text-transform:uppercase;display:flex;justify-content:space-between;align-items:center}
  .term-close{cursor:pointer;pointer-events:auto;opacity:.7;font-size:12px}
  .term-close:hover{opacity:1}
  .term-body{padding:10px 14px 14px;font-size:13px;line-height:1.5}
  .term-entry{padding:8px 0;border-bottom:1px solid rgba(80,255,80,.1)}
  .term-entry:last-child{border-bottom:none}
  .term-entry-title{font-weight:800;font-size:12px;letter-spacing:.5px;margin-bottom:2px}
  .term-entry-body{opacity:.85;font-size:12px}
  .term-actions{padding:8px 14px 12px;border-top:1px solid rgba(80,255,80,.2);display:flex;flex-wrap:wrap;gap:8px}
  .term-btn{padding:7px 12px;border-radius:4px;border:1px solid rgba(80,255,80,.35);background:rgba(50,255,80,.06);cursor:pointer;pointer-events:auto;font-size:12px;font-family:inherit;color:#33ff66;letter-spacing:.5px}
  .term-btn:hover{background:rgba(50,255,80,.16)}
  .term-btn.disabled{opacity:.35;cursor:default;pointer-events:none}
  .term-scanline{pointer-events:none;position:absolute;inset:0;background:repeating-linear-gradient(0deg,transparent,transparent 2px,rgba(0,0,0,.05) 2px,rgba(0,0,0,.05) 4px);border-radius:8px}
`;

// ---- Terminal Data Definitions ----
// Each terminal has: id, title, logs[], actions[]
// actions: { label, kind:"unlock", targetLockId, requireFlag?, doneFlag? }
export const TerminalDefs = {
  vault_terminal: {
    id: "vault_terminal",
    title: "VAULT 811 — MAIN TERMINAL",
    logs: [
      { title: "ENTRY 001 — VAULT STATUS", body: "Vault 811 systems nominal. Population: 47 active residents. Surface clearance protocol remains in effect. All exits require Overseer authorization." },
      { title: "ENTRY 002 — SURFACE REPORT", body: "Recon teams report elevated radiation north of the vault. Crawler nests confirmed in sectors 3–7. Recommend armed escort for all surface excursions." },
      { title: "ENTRY 003 — CLASSIFIED", body: "< REDACTED — OVERSEER EYES ONLY > \nProtocol 9 remains active. Do not discuss surface clearance criteria with residents. The 'restoration timeline' narrative must hold." },
      { title: "ENTRY 004 — ARMORY NOTE", body: "Armory locker combination reset. Standard security lock (Average difficulty) applied. Contact security chief for access override." }
    ],
    actions: [
      { label: "[Unlock Armory Locker]", kind: "unlock", targetLockId: "armory_locker", doneFlag: "unlocked:armory_locker" },
    ]
  }
};

/**
 * Build terminal DOM elements and attach to a UI root.
 * Returns a controller object for show/hide/update.
 */
export function buildTerminalUI(uiRoot) {
  const overlay = document.createElement("div");
  overlay.className = "term-overlay";
  uiRoot.appendChild(overlay);

  const header = document.createElement("div");
  header.className = "term-header";
  overlay.appendChild(header);

  const titleEl = document.createElement("span");
  header.appendChild(titleEl);

  const closeBtn = document.createElement("span");
  closeBtn.className = "term-close";
  closeBtn.textContent = "[ESC] Close";
  header.appendChild(closeBtn);

  const body = document.createElement("div");
  body.className = "term-body";
  overlay.appendChild(body);

  const actions = document.createElement("div");
  actions.className = "term-actions";
  overlay.appendChild(actions);

  // scanline effect
  const scanline = document.createElement("div");
  scanline.className = "term-scanline";
  overlay.appendChild(scanline);

  return { overlay, titleEl, closeBtn, body, actions };
}

/**
 * Render a terminal definition into the terminal UI.
 * @param {object} termUI  - from buildTerminalUI
 * @param {object} termDef - from TerminalDefs
 * @param {object} questSys - Quest instance
 * @param {object} callbacks - { onClose, onAction(actionDef), showToast }
 */
export function renderTerminal(termUI, termDef, questSys, callbacks) {
  termUI.overlay.style.display = "block";
  termUI.titleEl.textContent = termDef.title;

  // Logs
  termUI.body.innerHTML = "";
  for (const log of termDef.logs) {
    const entry = document.createElement("div");
    entry.className = "term-entry";
    const t = document.createElement("div");
    t.className = "term-entry-title";
    t.textContent = log.title;
    const b = document.createElement("div");
    b.className = "term-entry-body";
    b.textContent = log.body;
    entry.appendChild(t);
    entry.appendChild(b);
    termUI.body.appendChild(entry);
  }

  // Actions
  termUI.actions.innerHTML = "";
  for (const act of termDef.actions) {
    const btn = document.createElement("div");
    btn.className = "term-btn";
    const done = act.doneFlag && questSys.getFlag(act.doneFlag);
    if (done) {
      btn.textContent = act.label + " ✓ Done";
      btn.classList.add("disabled");
    } else {
      btn.textContent = act.label;
      btn.addEventListener("click", () => {
        if (callbacks.onAction) callbacks.onAction(act);
      });
    }
    termUI.actions.appendChild(btn);
  }

  // Close button
  termUI.closeBtn.onclick = () => {
    termUI.overlay.style.display = "none";
    if (callbacks.onClose) callbacks.onClose();
  };
}

/**
 * Close / hide the terminal UI.
 */
export function closeTerminal(termUI) {
  termUI.overlay.style.display = "none";
}
