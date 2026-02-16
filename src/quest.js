// Quest & Reputation System for Wasteland Japan — Vault 811
// Manages quest stages, flags, objectives, and faction reputation.
// Designed to be data-driven and persisted via the existing save/load system.

// ---- Quest State Manager ----
export class Quest {
  constructor() {
    this.stages = {};      // questId -> stage number (0/10/20/30 etc.)
    this.flags = {};       // string -> primitive (bool/number/string)
    this.objectives = [];  // { text, status:"active"|"done"|"failed" }
    this.log = [];         // { text, time } journal entries

    // Faction reputation: -100 to +100, start at 0
    this.rep = {
      vault: 0,
      wardens: 0,
      rail: 0
    };
  }

  // ---- Stage API ----
  setStage(questId, stage) {
    this.stages[questId] = stage;
  }

  getStage(questId) {
    return this.stages[questId] || 0;
  }

  advanceStage(questId, stage) {
    if ((this.stages[questId] || 0) < stage) {
      this.stages[questId] = stage;
    }
  }

  // ---- Flag API ----
  setFlag(key, val) {
    this.flags[key] = val;
  }

  getFlag(key, defaultVal) {
    return this.flags[key] !== undefined ? this.flags[key] : (defaultVal !== undefined ? defaultVal : false);
  }

  incFlag(key, amount) {
    this.flags[key] = (this.flags[key] || 0) + (amount || 1);
  }

  // ---- Objective API ----
  addObjective(text) {
    const existing = this.objectives.find(o => o.text === text);
    if (!existing) {
      this.objectives.push({ text, status: "active" });
    }
  }

  completeObjective(text) {
    const obj = this.objectives.find(o => o.text === text);
    if (obj) obj.status = "done";
  }

  failObjective(text) {
    const obj = this.objectives.find(o => o.text === text);
    if (obj) obj.status = "failed";
  }

  isObjectiveActive(text) {
    const obj = this.objectives.find(o => o.text === text);
    return obj ? obj.status === "active" : false;
  }

  /** Returns the first active objective text, or empty string */
  topObjective() {
    const active = this.objectives.find(o => o.status === "active");
    return active ? active.text : "";
  }

  // ---- Log API ----
  addLog(text) {
    this.log.push({ text, time: Date.now() });
  }

  // ---- Reputation API ----
  changeRep(faction, amount) {
    if (this.rep[faction] !== undefined) {
      this.rep[faction] = Math.max(-100, Math.min(100, this.rep[faction] + amount));
    }
  }

  getRep(faction) {
    return this.rep[faction] || 0;
  }

  /** Vendor price multiplier based on faction rep. Friendly = cheaper, hostile = more expensive. */
  vendorMultiplier(faction) {
    const r = this.getRep(faction);
    if (r >= 50) return 0.8;
    if (r >= 20) return 0.9;
    if (r <= -50) return 1.4;
    if (r <= -20) return 1.2;
    return 1.0;
  }

  // ---- Serialization ----
  toSave() {
    return {
      stages: { ...this.stages },
      flags: { ...this.flags },
      objectives: this.objectives.map(o => ({ ...o })),
      log: this.log.map(l => ({ ...l })),
      rep: { ...this.rep }
    };
  }

  fromSave(data) {
    if (!data) return;
    if (data.stages) this.stages = { ...data.stages };
    if (data.flags) this.flags = { ...data.flags };
    if (data.objectives) this.objectives = data.objectives.map(o => ({ ...o }));
    if (data.log) this.log = data.log.map(l => ({ ...l }));
    if (data.rep) this.rep = { vault: 0, wardens: 0, rail: 0, ...data.rep };
  }

  // ---- Debug ----
  debugDump() {
    console.log("=== QUEST DEBUG DUMP ===");
    console.log("Stages:", JSON.stringify(this.stages));
    console.log("Flags:", JSON.stringify(this.flags));
    console.log("Objectives:", JSON.stringify(this.objectives));
    console.log("Rep:", JSON.stringify(this.rep));
    console.log("Log:", this.log.map(l => l.text));
    console.log("========================");
  }
}
