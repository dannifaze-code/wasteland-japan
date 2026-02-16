// Dialogue UI for Wasteland Japan — Vault 811
// Creates and manages the dialogue panel DOM + styles.
// Updated only when dialogue state changes (no per-frame DOM updates).

// ---- CSS for Dialogue Panel ----
export const DIALOGUE_CSS = `
  .dlg-panel{position:absolute;left:50%;bottom:6%;transform:translateX(-50%);width:min(680px,90vw);border-radius:16px;border:1px solid rgba(255,255,255,.2);background:rgba(8,10,16,.88);box-shadow:0 12px 60px rgba(0,0,0,.6);display:none;pointer-events:auto;overflow:hidden}
  .dlg-header{padding:12px 16px 4px;display:flex;align-items:center;gap:10px}
  .dlg-speaker{font-weight:900;font-size:15px;letter-spacing:.5px;color:#e7f0ff}
  .dlg-role{font-size:11px;opacity:.55;margin-left:4px}
  .dlg-text{padding:4px 16px 12px;font-size:14px;line-height:1.5;opacity:.92;color:#d8e0f0}
  .dlg-choices{padding:0 12px 12px;display:flex;flex-direction:column;gap:6px}
  .dlg-choice{padding:10px 14px;border-radius:10px;border:1px solid rgba(255,255,255,.14);background:rgba(255,255,255,.04);cursor:pointer;pointer-events:auto;font-size:13px;color:#d8e0f0;transition:background .12s,border-color .12s}
  .dlg-choice:hover{background:rgba(255,255,255,.1);border-color:rgba(255,255,255,.25)}
  .dlg-choice.disabled{opacity:.35;cursor:default;pointer-events:none}
  .dlg-choice .skill-tag{color:#ffcc44;font-weight:700;margin-right:4px}
  .dlg-choice .fail-tag{color:#ff5544;font-weight:700;margin-right:4px}
  .dlg-hint{padding:0 16px 10px;font-size:11px;opacity:.45;color:#b8c0d0}
`;

// ---- Build Dialogue UI Elements ----
export function buildDialogueUI(uiRoot) {
  const panel = document.createElement("div");
  panel.className = "dlg-panel";
  uiRoot.appendChild(panel);

  const header = document.createElement("div");
  header.className = "dlg-header";
  panel.appendChild(header);

  const speaker = document.createElement("div");
  speaker.className = "dlg-speaker";
  header.appendChild(speaker);

  const role = document.createElement("div");
  role.className = "dlg-role";
  header.appendChild(role);

  const text = document.createElement("div");
  text.className = "dlg-text";
  panel.appendChild(text);

  const choices = document.createElement("div");
  choices.className = "dlg-choices";
  panel.appendChild(choices);

  const hint = document.createElement("div");
  hint.className = "dlg-hint";
  hint.textContent = "Click a response or press 1-9";
  panel.appendChild(hint);

  return { panel, speaker, role, text, choices, hint };
}

// ---- Render a dialogue node into the UI ----
export function renderDialogueNode(ui, node, npcData, player, onChoicePick, game) {
  if (!node) {
    ui.panel.style.display = "none";
    return;
  }

  ui.panel.style.display = "block";
  ui.speaker.textContent = node.speaker || npcData?.displayName || "???";
  ui.role.textContent = npcData ? `(${npcData.faction} — ${npcData.role})` : "";
  ui.text.textContent = node.text;
  ui.choices.innerHTML = "";

  node.choices.forEach((choice, idx) => {
    const btn = document.createElement("div");
    btn.className = "dlg-choice";

    let label = "";
    let passesCheck = true;

    if (choice.condition) {
      passesCheck = choice.condition(player, game);
      if (passesCheck) {
        label += `<span class="skill-tag">${choice.conditionLabel || "[Check]"}</span>`;
      } else {
        label += `<span class="fail-tag">${choice.conditionLabel || "[Check]"}</span>`;
        btn.classList.add("disabled");
      }
    }
    label += escapeHtml(choice.text);
    btn.innerHTML = `<span style="opacity:.5;margin-right:6px">${idx + 1}.</span>${label}`;

    if (passesCheck) {
      btn.addEventListener("click", () => onChoicePick(idx));
    }

    ui.choices.appendChild(btn);
  });
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}
