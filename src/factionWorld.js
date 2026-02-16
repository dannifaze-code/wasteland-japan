// FactionWorld — Wardens vs Rail faction tension layer for Wasteland Japan
// Spawns patrol squads, runs AI-vs-AI skirmishes, handles rep-based hostility,
// and manages faction-controlled POI ownership.
// Plugs into World tile streaming via onTileCreated / onTileDisposed hooks.

import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.159.0/build/three.module.js";

// ---- Constants ----
export const FACTIONS = { WARDENS: "wardens", RAIL: "rail" };
const REP_HOSTILE  = -20;
const REP_FRIENDLY =  20;
const REP_ALLY     =  50;

const SKIRMISH_RADIUS       = 18;
const PATROL_SPAWN_CHANCE   = 0.25;
const MAX_SQUADS            = 6;
const SQUAD_SIZE_MIN        = 2;
const SQUAD_SIZE_MAX        = 3;

// Lightweight seeded RNG (same algo as main.js)
function mulberry32(seed) {
  return function () {
    let t = (seed += 0x6D2B79F5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---- Faction-controlled POIs (hand-placed, deterministic) ----
export const FACTION_POIS = [
  { id: "kuroshima_relay",     name: "Kuroshima Rail Relay",          position: new THREE.Vector3(-160, 0, 40),   radius: 22, defaultOwner: FACTIONS.RAIL,    biomeHint: 2 },
  { id: "warden_torii",        name: "Warden Checkpoint Torii",       position: new THREE.Vector3( 100, 0, 120),  radius: 20, defaultOwner: FACTIONS.WARDENS, biomeHint: 1 },
  { id: "coastal_yard",        name: "Coastal Yard",                  position: new THREE.Vector3(-180, 0, -80),  radius: 24, defaultOwner: FACTIONS.RAIL,    biomeHint: 2 },
  { id: "shrine_outpost_edge", name: "Shrine Outpost Perimeter",      position: new THREE.Vector3(  60, 0, 80),   radius: 18, defaultOwner: FACTIONS.WARDENS, biomeHint: 1 },
  { id: "depot_junction",      name: "Rail Depot Junction",           position: new THREE.Vector3(-120, 0, -140), radius: 20, defaultOwner: FACTIONS.RAIL,    biomeHint: 2 },
  { id: "hilltop_shrine",      name: "Hilltop Shrine Watch",          position: new THREE.Vector3( 140, 0, -60),  radius: 18, defaultOwner: FACTIONS.WARDENS, biomeHint: 1 },
];

// ---- Shared materials (created once) ----
let _matWardens, _matRail, _matWardensBand, _matRailBand;
function ensureMaterials() {
  if (_matWardens) return;
  _matWardens     = new THREE.MeshStandardMaterial({ color: 0x2b4a8a, roughness: 0.9 });
  _matRail        = new THREE.MeshStandardMaterial({ color: 0x8a6a2b, roughness: 0.9 });
  _matWardensBand = new THREE.MeshStandardMaterial({ color: 0x5588ff, emissive: 0x3366dd, emissiveIntensity: 0.6, roughness: 0.5 });
  _matRailBand    = new THREE.MeshStandardMaterial({ color: 0xffaa33, emissive: 0xcc8822, emissiveIntensity: 0.6, roughness: 0.5 });
}

// Shared geometries (created once)
let _bodyGeom, _bandGeom;
function ensureGeometries() {
  if (_bodyGeom) return;
  _bodyGeom = new THREE.SphereGeometry(0.45, 10, 10);
  _bandGeom = new THREE.CylinderGeometry(0.48, 0.48, 0.12, 10);
}

// ---- Unit factory ----
function makeFactionUnit(faction, role, squadId, tileKey) {
  ensureMaterials();
  ensureGeometries();

  const g = new THREE.Group();
  const bodyMat = faction === FACTIONS.WARDENS ? _matWardens : _matRail;
  const bandMat = faction === FACTIONS.WARDENS ? _matWardensBand : _matRailBand;

  // Body sphere
  const body = new THREE.Mesh(_bodyGeom, bodyMat);
  body.position.y = 0.85;
  body.castShadow = true;
  g.add(body);

  // Emissive armband/marker (readable at distance)
  const band = new THREE.Mesh(_bandGeom, bandMat);
  band.position.y = 1.05;
  g.add(band);

  // Legs (simple cylinders)
  const legGeom = new THREE.CylinderGeometry(0.08, 0.1, 0.65, 6);
  const legMat = bodyMat;
  for (let i = -1; i <= 1; i += 2) {
    const leg = new THREE.Mesh(legGeom, legMat);
    leg.position.set(i * 0.2, 0.32, 0);
    g.add(leg);
  }

  const isRanged = role === "rifle";
  g.userData = {
    factionUnit: true,
    faction,
    hp: isRanged ? 55 : 70,
    hpMax: isRanged ? 55 : 70,
    dmg: isRanged ? 8 : 14,
    speed: isRanged ? 2.8 : 3.6,
    range: isRanged ? 16 : 2.2,
    atkCd: 0,
    atkRate: isRanged ? 1.2 : 0.8,
    role,
    state: "patrol",
    squadId,
    tileKey,
    targetId: null,
    patrolOrigin: null,    // set after placement
    patrolAngle: 0,
    patrolRadius: 8,
    name: `${faction === FACTIONS.WARDENS ? "Warden" : "Rail"} ${isRanged ? "Rifleman" : "Brawler"}`,
    lootDone: false,
  };

  return g;
}

// ---- Banner / control marker for POIs ----
function makeBanner(faction) {
  ensureMaterials();
  const g = new THREE.Group();
  const poleMat = new THREE.MeshStandardMaterial({ color: 0x3a3a3a, roughness: 0.9 });
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 3.2, 6), poleMat);
  pole.position.y = 1.6;
  pole.castShadow = true;
  g.add(pole);

  const flagMat = faction === FACTIONS.WARDENS ? _matWardensBand : _matRailBand;
  const flag = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 0.7), flagMat);
  flag.position.set(0.65, 2.8, 0);
  flag.castShadow = true;
  g.add(flag);

  g.userData = { factionBanner: true, faction, interact: true, kind: "factionBanner",
    name: `${faction === FACTIONS.WARDENS ? "Warden" : "Rail"} Territory Banner` };
  return g;
}

// ---- FactionWorld class ----
export class FactionWorld {
  /**
   * @param {THREE.Scene} scene
   * @param {object} world   — the World instance from main.js
   * @param {object} questSys — Quest instance
   * @param {number} seed
   */
  constructor(scene, world, questSys, seed) {
    this.scene = scene;
    this.world = world;
    this.questSys = questSys;
    this.seed = seed;

    // Callback for faction units damaging player: set by game
    this.onPlayerDamage = null;

    // Per-tile data: Map<tileKey, { squads: Group[], banner: Group|null }>
    this.tileData = new Map();

    // Scene group for all faction entities
    this.group = new THREE.Group();
    scene.add(this.group);

    // All active squad units (flat list for quick iteration)
    this.allUnits = [];

    // POI ownership (persisted)
    this.poiOwnership = {};
    for (const poi of FACTION_POIS) {
      this.poiOwnership[poi.id] = questSys.getFlag(`poiOwner:${poi.id}`, poi.defaultOwner);
    }

    // Resolved skirmishes (set of "squadA_squadB" keys to avoid replaying)
    this.resolvedSkirmishes = new Set();

    // Squad counter
    this._nextSquadId = 0;

    // Throttle skirmish checks (every 0.5s)
    this._skirmishTimer = 0;
  }

  // ---- Tile lifecycle hooks ----

  onTileCreated(tileKey, tileGroup, biome, tx, tz) {
    if (this.tileData.has(tileKey)) return;

    const td = { squads: [], banner: null };
    this.tileData.set(tileKey, td);

    const tileSize = this.world.tileSize;
    const rng = mulberry32(
      (this.seed * 73856093) ^ (tx * 19349663) ^ (tz * 83492791) ^ 0xFACE
    );

    // --- Faction-controlled POI banners ---
    for (const poi of FACTION_POIS) {
      const ptx = Math.floor(poi.position.x / tileSize);
      const ptz = Math.floor(poi.position.z / tileSize);
      if (ptx === tx && ptz === tz) {
        const owner = this.poiOwnership[poi.id];
        const banner = makeBanner(owner);
        banner.position.copy(poi.position);
        banner.position.y = 0;
        this.group.add(banner);
        td.banner = banner;
        td.poiId = poi.id;
      }
    }

    // --- Patrol squad spawn (deterministic, capped) ---
    if (this.allUnits.length >= MAX_SQUADS * SQUAD_SIZE_MAX) return;
    if (rng() > PATROL_SPAWN_CHANCE) return;

    // Decide faction: near a POI → that POI's owner; else alternate
    let faction;
    const cx = tx * tileSize + tileSize / 2;
    const cz = tz * tileSize + tileSize / 2;
    const nearPOI = FACTION_POIS.find(p => {
      const dx = p.position.x - cx, dz = p.position.z - cz;
      return Math.sqrt(dx * dx + dz * dz) < tileSize * 1.2;
    });
    if (nearPOI) {
      faction = this.poiOwnership[nearPOI.id];
    } else {
      faction = (tx + tz) % 2 === 0 ? FACTIONS.WARDENS : FACTIONS.RAIL;
    }

    const squadId = `sq_${this._nextSquadId++}`;
    const size = SQUAD_SIZE_MIN + Math.floor(rng() * (SQUAD_SIZE_MAX - SQUAD_SIZE_MIN + 1));

    for (let i = 0; i < size; i++) {
      const role = rng() < 0.5 ? "rifle" : "melee";
      const unit = makeFactionUnit(faction, role, squadId, tileKey);

      const wx = tx * tileSize + (rng() - 0.5) * tileSize * 0.7;
      const wz = tz * tileSize + (rng() - 0.5) * tileSize * 0.7;
      unit.position.set(wx, 0, wz);
      unit.userData.patrolOrigin = new THREE.Vector3(wx, 0, wz);
      unit.userData.patrolAngle = rng() * Math.PI * 2;

      this.group.add(unit);
      td.squads.push(unit);
      this.allUnits.push(unit);
    }
  }

  onTileDisposed(tileKey) {
    const td = this.tileData.get(tileKey);
    if (!td) return;

    for (const unit of td.squads) {
      this.group.remove(unit);
      const idx = this.allUnits.indexOf(unit);
      if (idx >= 0) this.allUnits.splice(idx, 1);
    }
    if (td.banner) this.group.remove(td.banner);
    this.tileData.delete(tileKey);
  }

  // ---- Per-frame update ----

  update(dt, playerPos, loadedTileKeys, terrain) {
    this._skirmishTimer -= dt;

    for (let i = this.allUnits.length - 1; i >= 0; i--) {
      const u = this.allUnits[i];
      if (!u.parent) { this.allUnits.splice(i, 1); continue; }
      const ud = u.userData;
      ud.atkCd = Math.max(0, ud.atkCd - dt);

      // Ground on terrain
      if (terrain && terrain.ready) {
        u.position.y = terrain.sampleHeight(u.position.x, u.position.z);
      }

      switch (ud.state) {
        case "patrol":
          this._doPatrol(u, ud, dt);
          break;
        case "engage":
          this._doEngage(u, ud, dt, playerPos);
          break;
        case "retreat":
          this._doRetreat(u, ud, dt);
          break;
      }
    }

    // Skirmish detection (throttled)
    if (this._skirmishTimer <= 0) {
      this._skirmishTimer = 0.5;
      this._detectSkirmishes(playerPos);
    }
  }

  // ---- AI states ----

  _doPatrol(u, ud, dt) {
    if (!ud.patrolOrigin) return;
    ud.patrolAngle += dt * 0.3;
    const tx = ud.patrolOrigin.x + Math.cos(ud.patrolAngle) * ud.patrolRadius;
    const tz = ud.patrolOrigin.z + Math.sin(ud.patrolAngle) * ud.patrolRadius;
    const dx = tx - u.position.x, dz = tz - u.position.z;
    const dist = Math.sqrt(dx * dx + dz * dz);
    if (dist > 0.2) {
      const s = Math.min(ud.speed * dt, dist);
      u.position.x += (dx / dist) * s;
      u.position.z += (dz / dist) * s;
      u.rotation.y = Math.atan2(dx, dz);
    }
  }

  _doEngage(u, ud, dt, playerPos) {
    const target = this._findTargetForUnit(ud);
    if (!target || (!target.parent && !target.userData?.isPlayer)) {
      ud.state = "patrol";
      ud.targetId = null;
      return;
    }

    // Check target HP
    const tud = target.userData;
    if ((tud.factionUnit && tud.hp <= 0) || (tud.isPlayer && tud.hp <= 0)) {
      ud.state = "patrol";
      ud.targetId = null;
      return;
    }

    const tPos = tud.isPlayer ? playerPos : target.position;
    const dx = tPos.x - u.position.x, dz = tPos.z - u.position.z;
    const dist = Math.sqrt(dx * dx + dz * dz);

    // Move toward target if out of range
    if (dist > ud.range * 0.9) {
      const s = Math.min(ud.speed * dt, dist);
      u.position.x += (dx / dist) * s;
      u.position.z += (dz / dist) * s;
    }
    u.rotation.y = Math.atan2(dx, dz);

    // Attack
    if (dist <= ud.range && ud.atkCd <= 0) {
      ud.atkCd = ud.atkRate;
      if (tud.factionUnit) {
        tud.hp -= ud.dmg;
        if (tud.hp <= 0) {
          this._killUnit(target);
        }
      } else if (tud.isPlayer && this.onPlayerDamage) {
        this.onPlayerDamage(ud.dmg);
      }
    }
  }

  _doRetreat(u, ud, dt) {
    if (!ud.patrolOrigin) { ud.state = "patrol"; return; }
    const dx = ud.patrolOrigin.x - u.position.x;
    const dz = ud.patrolOrigin.z - u.position.z;
    const dist = Math.sqrt(dx * dx + dz * dz);
    if (dist < 3) { ud.state = "patrol"; return; }
    const s = Math.min(ud.speed * 1.2 * dt, dist);
    u.position.x += (dx / dist) * s;
    u.position.z += (dz / dist) * s;
    u.rotation.y = Math.atan2(dx, dz);
  }

  // ---- Skirmish detection ----

  _detectSkirmishes(playerPos) {
    for (let i = 0; i < this.allUnits.length; i++) {
      const a = this.allUnits[i];
      const aud = a.userData;
      if (aud.state === "retreat" || aud.hp <= 0) continue;

      for (let j = i + 1; j < this.allUnits.length; j++) {
        const b = this.allUnits[j];
        const bud = b.userData;
        if (bud.state === "retreat" || bud.hp <= 0) continue;
        if (aud.faction === bud.faction) continue; // same faction

        const dx = a.position.x - b.position.x, dz = a.position.z - b.position.z;
        const dist2 = dx * dx + dz * dz;
        if (dist2 < SKIRMISH_RADIUS * SKIRMISH_RADIUS) {
          // Engage each other
          if (aud.state === "patrol") {
            aud.state = "engage";
            aud.targetId = bud.squadId + "_" + this.allUnits.indexOf(b);
            aud._targetRef = b;
          }
          if (bud.state === "patrol") {
            bud.state = "engage";
            bud.targetId = aud.squadId + "_" + i;
            bud._targetRef = a;
          }
        }
      }

      // Rep-based hostility toward player
      if (aud.state === "patrol" && playerPos) {
        const pdx = playerPos.x - a.position.x, pdz = playerPos.z - a.position.z;
        const pdist2 = pdx * pdx + pdz * pdz;
        if (pdist2 < SKIRMISH_RADIUS * SKIRMISH_RADIUS) {
          const rep = this.questSys.getRep(aud.faction);
          if (rep <= REP_HOSTILE) {
            aud.state = "engage";
            aud._targetRef = { userData: { isPlayer: true, hp: 1 } };
            aud.targetId = "__player__";
          }
        }
      }
    }
  }

  _findTarget(targetId) {
    if (!targetId) return null;
    // Direct reference cache
    for (const u of this.allUnits) {
      if (u.userData._targetRef) return u.userData._targetRef;
    }
    return null;
  }

  // Override _findTarget to use cached ref per unit
  _findTargetForUnit(ud) {
    return ud._targetRef && ud._targetRef.parent ? ud._targetRef : null;
  }

  _killUnit(unit) {
    const ud = unit.userData;
    ud.hp = 0;
    ud.state = "dead";

    // Remove from scene after brief delay (recycle)
    this.group.remove(unit);
    const idx = this.allUnits.indexOf(unit);
    if (idx >= 0) this.allUnits.splice(idx, 1);
  }

  // ---- Hostility query (used by main.js for player interactions) ----

  getStanceToPlayer(faction) {
    const rep = this.questSys.getRep(faction);
    if (rep <= REP_HOSTILE)  return "hostile";
    if (rep >= REP_ALLY)     return "ally";
    if (rep >= REP_FRIENDLY) return "friendly";
    return "neutral";
  }

  isHostileToPlayer(faction) {
    return this.getStanceToPlayer(faction) === "hostile";
  }

  // ---- POI ownership ----

  getPoiOwner(poiId) {
    return this.poiOwnership[poiId] || null;
  }

  setPoiOwner(poiId, newOwner) {
    this.poiOwnership[poiId] = newOwner;
    this.questSys.setFlag(`poiOwner:${poiId}`, newOwner);

    // Update banner visuals in the relevant tile
    for (const [, td] of this.tileData) {
      if (td.poiId === poiId && td.banner) {
        this.group.remove(td.banner);
        const poi = FACTION_POIS.find(p => p.id === poiId);
        if (poi) {
          td.banner = makeBanner(newOwner);
          td.banner.position.copy(poi.position);
          td.banner.position.y = 0;
          this.group.add(td.banner);
        }
      }
    }
  }

  // ---- Visibility ----

  setVisible(v) {
    this.group.visible = v;
  }

  // ---- Save / Load ----

  toSave() {
    return {
      poiOwnership: { ...this.poiOwnership },
      resolvedSkirmishes: [...this.resolvedSkirmishes],
    };
  }

  fromSave(data) {
    if (!data) return;
    if (data.poiOwnership) {
      this.poiOwnership = { ...data.poiOwnership };
      // Sync back to quest flags
      for (const [id, owner] of Object.entries(this.poiOwnership)) {
        this.questSys.setFlag(`poiOwner:${id}`, owner);
      }
    }
    if (data.resolvedSkirmishes) {
      this.resolvedSkirmishes = new Set(data.resolvedSkirmishes);
    }
  }

  // ---- Debug ----

  debugDump() {
    console.log("=== FACTION WORLD DEBUG ===");
    console.log("Active units:", this.allUnits.length);
    console.log("Tile data entries:", this.tileData.size);
    console.log("POI ownership:", JSON.stringify(this.poiOwnership));
    for (const u of this.allUnits) {
      const ud = u.userData;
      console.log(`  [${ud.faction}] ${ud.name} HP:${ud.hp}/${ud.hpMax} state:${ud.state} pos:(${u.position.x.toFixed(1)},${u.position.z.toFixed(1)})`);
    }
    console.log("===========================");
  }
}
