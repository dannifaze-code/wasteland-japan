// FactionWorld — Control-point ownership layer for POIs.
// Tracks which faction owns each POI, updates banner visuals, and
// integrates with the Quest flag system for automatic ownership flips.

import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.159.0/build/three.module.js";

/** Faction → banner colour mapping. */
const FACTION_COLORS = {
  vault:   0x9bd3ff,
  wardens: 0x33ff66,
  rail:    0xffaa00
};

const BANNER_HEIGHT = 6;
const BANNER_WIDTH  = 1.2;
const BANNER_DEPTH  = 0.15;

const FLAG_PREFIX = "poi:";
const FLAG_SUFFIX = ":owner";

/**
 * Manages faction ownership of world POIs.
 *
 * Usage:
 *   const fw = new FactionWorld(worldspace);
 *   fw.fromSave(save.world.poiOwners);   // restore persisted state
 *   fw.syncFromQuest(questSys);           // honour quest flags
 *   // … later …
 *   save.world.poiOwners = fw.toSave();
 */
export class FactionWorld {
  /**
   * @param {import("./worldspace.js").Worldspace} worldspace
   */
  constructor(worldspace) {
    /** @type {import("./worldspace.js").Worldspace} */
    this.worldspace = worldspace;

    /** poiId → faction string (e.g. "wardens") */
    this._owners = {};

    /** poiId → THREE.Mesh banner reference (for colour updates) */
    this._banners = {};
  }

  // ---- Public API ----

  /**
   * Set or change the owning faction of a POI.
   * - Updates internal ownership map immediately.
   * - Creates or recolours the banner mesh at the POI location.
   * - Logs the change to console.
   *
   * @param {string} poiId   e.g. "shrine_outpost"
   * @param {string} faction e.g. "wardens"
   */
  setOwner(poiId, faction) {
    const prev = this._owners[poiId];
    this._owners[poiId] = faction;
    this._updateBanner(poiId, faction);
    console.log(`POI ${poiId} flipped to ${faction}`);

    return prev;
  }

  /**
   * Returns the current owner of a POI, or undefined if unowned.
   * @param {string} poiId
   * @returns {string|undefined}
   */
  getOwner(poiId) {
    return this._owners[poiId];
  }

  /**
   * Scans quest flags for any `poi:<poiId>:owner` entries and
   * applies ownership changes that have not yet been reflected.
   *
   * @param {import("./quest.js").Quest} questSys
   */
  syncFromQuest(questSys) {
    const flags = questSys.flags;
    for (const key of Object.keys(flags)) {
      // Expected format: "poi:<poiId>:owner" → faction string
      if (!key.startsWith(FLAG_PREFIX) || !key.endsWith(FLAG_SUFFIX)) continue;
      const poiId = key.slice(FLAG_PREFIX.length, key.length - FLAG_SUFFIX.length);
      const faction = flags[key];
      if (typeof faction === "string" && faction && this._owners[poiId] !== faction) {
        this.setOwner(poiId, faction);
      }
    }
  }

  // ---- Persistence ----

  /** Returns a plain object suitable for JSON serialisation. */
  toSave() {
    return { ...this._owners };
  }

  /** Restores ownership state from a previously-saved plain object. */
  fromSave(data) {
    if (!data || typeof data !== "object") return;
    for (const [poiId, faction] of Object.entries(data)) {
      if (typeof faction === "string" && faction) {
        this.setOwner(poiId, faction);
      }
    }
  }

  // ---- Internal helpers ----

  /**
   * Creates or updates the banner mesh at the given POI location.
   * @param {string} poiId
   * @param {string} faction
   */
  _updateBanner(poiId, faction) {
    const color = FACTION_COLORS[faction] ?? 0xffffff;

    // Re-colour existing banner if present
    if (this._banners[poiId]) {
      this._banners[poiId].material.color.setHex(color);
      this._banners[poiId].material.emissive.setHex(color);
      return;
    }

    // Locate POI world position from Worldspace data
    const poiEntry = this.worldspace.pois.find(p => p.id === poiId);
    if (!poiEntry) return; // POI not yet placed or unknown

    const x = poiEntry.world.x;
    const z = poiEntry.world.z;
    const y = poiEntry.worldY ?? 0;

    const mat = new THREE.MeshStandardMaterial({
      color,
      emissive: color,
      emissiveIntensity: 0.5,
      roughness: 0.6,
      side: THREE.DoubleSide
    });
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(BANNER_WIDTH, BANNER_HEIGHT, BANNER_DEPTH),
      mat
    );
    mesh.position.set(x, y + BANNER_HEIGHT / 2 + 0.5, z);
    mesh.castShadow = true;
    mesh.userData.factionBanner = poiId;

    this.worldspace.poiGroup.add(mesh);
    this._banners[poiId] = mesh;
  }
}
