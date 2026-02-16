// NPC Entity System for Wasteland Japan — Vault 811
// Manages NPC data, 3D mesh creation, idle animation, wander behavior, and facing logic.

import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.159.0/build/three.module.js";

const v3=(x=0,y=0,z=0)=>new THREE.Vector3(x,y,z);
const lerp=(a,b,t)=>a+(b-a)*t;
const rand=(a=0,b=1)=>a+Math.random()*(b-a);

// ---- NPC Definitions for Vault 811 ----
export const NPCDefs = [
  {
    id: "overseer_tanaka",
    displayName: "Overseer Tanaka",
    faction: "Vault 811",
    role: "questgiver",
    position: { x: -6, y: 0, z: -8 },
    bodyColor: 0x2a3a5a,
    accentColor: 0xffcc44,
    height: 1.85,
    interactDistance: 2.5,
    wander: false,
    dialogueId: "overseer_tanaka"
  },
  {
    id: "medic_yuki",
    displayName: "Medic Yuki",
    faction: "Vault 811",
    role: "vendor",
    position: { x: 10, y: 0, z: -4 },
    bodyColor: 0x4a6a5a,
    accentColor: 0x66ffaa,
    height: 1.65,
    interactDistance: 2.5,
    wander: false,
    dialogueId: "medic_yuki"
  },
  {
    id: "guard_kenji",
    displayName: "Guard Kenji",
    faction: "Vault 811",
    role: "questgiver",
    position: { x: 6, y: 0, z: 8 },
    bodyColor: 0x3a3a3a,
    accentColor: 0xff6644,
    height: 1.9,
    interactDistance: 2.5,
    wander: true,
    wanderRadius: 3,
    dialogueId: "guard_kenji"
  },
  {
    id: "scavenger_rin",
    displayName: "Scavenger Rin",
    faction: "Drifters",
    role: "ambient",
    position: { x: -10, y: 0, z: 4 },
    bodyColor: 0x5a4a3a,
    accentColor: 0xcc9944,
    height: 1.7,
    interactDistance: 2.5,
    wander: true,
    wanderRadius: 2,
    dialogueId: "scavenger_rin"
  }
];

// ---- Outside NPC Definitions ----
export const OutsideNPCDefs = [
  {
    id: "warden_aoi",
    displayName: "Warden Aoi",
    faction: "Wardens",
    role: "questgiver",
    position: { x: 15, y: 0, z: 210 }, // at outpost center
    bodyColor: 0x2a4a2a,
    accentColor: 0x88cc44,
    height: 1.75,
    interactDistance: 2.5,
    wander: false,
    dialogueId: "warden_aoi"
  },
  {
    id: "broker_jiro",
    displayName: "Broker Jiro",
    faction: "Rail Ghost Union",
    role: "vendor",
    position: { x: -80, y: 0, z: 15 }, // near rail station center
    bodyColor: 0x3a3a4a,
    accentColor: 0x44aacc,
    height: 1.8,
    interactDistance: 2.5,
    wander: true,
    wanderRadius: 2,
    dialogueId: "broker_jiro"
  }
];

// ---- NPC Mesh Builder ----
function buildNPCMesh(def) {
  const g = new THREE.Group();
  const scale = def.height / 1.8;

  const bodyMat = new THREE.MeshStandardMaterial({ color: def.bodyColor, roughness: 0.85 });
  const skinMat = new THREE.MeshStandardMaterial({ color: 0xc49a6c, roughness: 0.9 });
  const accentMat = new THREE.MeshStandardMaterial({ color: def.accentColor, roughness: 0.7, emissive: def.accentColor, emissiveIntensity: 0.15 });

  // Torso
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.55 * scale, 0.7 * scale, 0.3 * scale), bodyMat);
  torso.position.y = 1.15 * scale;
  torso.castShadow = true;

  // Head
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.19 * scale, 12, 12), skinMat);
  head.position.y = 1.68 * scale;
  head.castShadow = true;

  // Legs
  const legGeom = new THREE.BoxGeometry(0.18 * scale, 0.65 * scale, 0.22 * scale);
  const legL = new THREE.Mesh(legGeom, bodyMat);
  legL.position.set(-0.13 * scale, 0.4 * scale, 0);
  legL.castShadow = true;
  const legR = legL.clone();
  legR.position.x = 0.13 * scale;

  // Arms
  const armGeom = new THREE.BoxGeometry(0.15 * scale, 0.55 * scale, 0.18 * scale);
  const armL = new THREE.Mesh(armGeom, bodyMat);
  armL.position.set(-0.38 * scale, 1.0 * scale, 0);
  armL.castShadow = true;
  const armR = armL.clone();
  armR.position.x = 0.38 * scale;

  // Accent: shoulder pauldron or badge (visual distinction)
  const badge = new THREE.Mesh(new THREE.BoxGeometry(0.12 * scale, 0.08 * scale, 0.1 * scale), accentMat);
  badge.position.set(-0.3 * scale, 1.4 * scale, 0.15 * scale);
  badge.castShadow = true;

  g.add(torso, head, legL, legR, armL, armR, badge);

  // Role-specific accessories
  if (def.role === "vendor") {
    // Backpack
    const pack = new THREE.Mesh(new THREE.BoxGeometry(0.35 * scale, 0.35 * scale, 0.15 * scale), accentMat);
    pack.position.set(0, 1.0 * scale, -0.22 * scale);
    pack.castShadow = true;
    g.add(pack);
  } else if (def.role === "questgiver") {
    // Marker above head (small floating diamond)
    const marker = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.08, 0),
      new THREE.MeshStandardMaterial({ color: 0xffdd44, emissive: 0xffdd44, emissiveIntensity: 0.6, roughness: 0.4 })
    );
    marker.position.y = 1.95 * scale;
    marker.userData._marker = true;
    g.add(marker);
  }

  g.position.set(def.position.x, def.position.y, def.position.z);

  g.userData = {
    npc: true,
    npcId: def.id,
    displayName: def.displayName,
    faction: def.faction,
    role: def.role,
    dialogueId: def.dialogueId,
    interactDistance: def.interactDistance || 2.5,
    // Idle animation state
    _swayT: Math.random() * Math.PI * 2,
    _baseY: def.position.y,
    // Wander state
    _wander: def.wander || false,
    _wanderRadius: def.wanderRadius || 0,
    _wanderOrigin: v3(def.position.x, def.position.y, def.position.z),
    _wanderT: 0,
    _wanderDir: v3(),
    _wanderSpeed: 0.6,
    // Dialogue state
    _inDialogue: false
  };

  g.traverse(o => { if (o.isMesh) o.castShadow = true; });
  return g;
}

// ---- NPC Manager ----
export class NPCManager {
  constructor(scene) {
    this.scene = scene;
    this.group = new THREE.Group();
    this.outsideGroup = new THREE.Group();
    scene.add(this.group);
    scene.add(this.outsideGroup);
    this.npcs = [];
    this.outsideNPCs = [];
    this._outsideSpawned = false;
  }

  spawnVaultNPCs() {
    for (const def of NPCDefs) {
      const mesh = buildNPCMesh(def);
      this.group.add(mesh);
      this.npcs.push(mesh);
    }
  }

  /** Spawn outside NPCs (Warden Aoi, Broker Jiro). Safe to call multiple times — only spawns once. */
  spawnOutsideNPCs() {
    if (this._outsideSpawned) return;
    this._outsideSpawned = true;
    for (const def of OutsideNPCDefs) {
      const mesh = buildNPCMesh(def);
      this.outsideGroup.add(mesh);
      this.outsideNPCs.push(mesh);
    }
  }

  /** Update idle sway, wander, quest markers for a list of NPCs */
  _updateList(list, dt, playerPos) {
    for (const npc of list) {
      const ud = npc.userData;

      // Idle sway (subtle body rotation)
      ud._swayT += dt * 1.2;
      if (!ud._inDialogue) {
        npc.rotation.y += Math.sin(ud._swayT) * 0.0008;
      }

      // Quest marker bob
      npc.traverse(c => {
        if (c.userData._marker) {
          c.position.y += Math.sin(ud._swayT * 2.5) * 0.0015;
          c.rotation.y += dt * 1.8;
        }
      });

      // Face player when in dialogue
      if (ud._inDialogue) {
        const toPlayer = playerPos.clone().sub(npc.position);
        toPlayer.y = 0;
        if (toPlayer.lengthSq() > 0.001) {
          const targetYaw = Math.atan2(toPlayer.x, toPlayer.z);
          npc.rotation.y = lerp(npc.rotation.y, targetYaw, 8 * dt);
        }
        continue; // skip wander while talking
      }

      // Wander behavior (only in hub/vault)
      if (ud._wander && ud._wanderRadius > 0) {
        ud._wanderT -= dt;
        if (ud._wanderT <= 0) {
          ud._wanderT = 2.0 + Math.random() * 3.0;
          const a = Math.random() * Math.PI * 2;
          ud._wanderDir.set(Math.cos(a), 0, Math.sin(a));
        }
        const next = npc.position.clone().addScaledVector(ud._wanderDir, ud._wanderSpeed * dt);
        const distFromOrigin = next.clone().sub(ud._wanderOrigin);
        distFromOrigin.y = 0;
        if (distFromOrigin.length() < ud._wanderRadius) {
          npc.position.copy(next);
        } else {
          // Reverse direction
          ud._wanderDir.negate();
          ud._wanderT = 0.5;
        }
        npc.position.y = ud._baseY;

        // Face wander direction
        if (ud._wanderDir.lengthSq() > 0.001) {
          const targetYaw = Math.atan2(ud._wanderDir.x, ud._wanderDir.z);
          npc.rotation.y = lerp(npc.rotation.y, targetYaw, 4 * dt);
        }
      }
    }
  }

  /** Update idle sway, wander, quest markers */
  update(dt, playerPos, inDialogueWith) {
    this._updateList(this.npcs, dt, playerPos);
  }

  /** Update outside NPCs separately (called when player is outside) */
  updateOutside(dt, playerPos) {
    this._updateList(this.outsideNPCs, dt, playerPos);
  }

  /** Get NPC mesh by id (searches both vault and outside) */
  getById(id) {
    return this.npcs.find(n => n.userData.npcId === id)
      || this.outsideNPCs.find(n => n.userData.npcId === id)
      || null;
  }

  setVisible(v) {
    this.group.visible = v;
  }

  setOutsideVisible(v) {
    this.outsideGroup.visible = v;
  }
}
