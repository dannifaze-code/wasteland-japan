// Companion System for Wasteland Japan — Vault 811
// One recruitable companion that follows the player and helps fight.
// Recruited via dialogue (faction-aligned). Persists via quest flags.

import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.159.0/build/three.module.js";

const v3 = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const lerp = (a, b, t) => a + (b - a) * t;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

// ---- Companion Definitions ----
export const CompanionDefs = {
  warden_scout: {
    id: "warden_scout",
    displayName: "Warden Scout Hana",
    faction: "wardens",
    recruitFlag: "companion_recruited_hana",
    dismissFlag: "companion_dismissed_hana",
    bodyColor: 0x2a4a2a,
    accentColor: 0x88cc44,
    height: 1.7,
    hp: 120,
    hpMax: 120,
    damage: 12,
    attackRange: 2.0,
    attackCd: 1.0,
    followDist: 3.0,
    aggroRange: 15,
    speed: 5.0,
    greeting: "I'll watch your back. Don't make me regret it.",
    dismissMsg: "Hana returns to the outpost.",
    deathMsg: "Hana is down! She'll recover at the outpost.",
  }
};

// ---- Build companion mesh ----
function buildCompanionMesh(def) {
  const g = new THREE.Group();
  const scale = def.height / 1.8;

  const bodyMat = new THREE.MeshStandardMaterial({ color: def.bodyColor, roughness: 0.85 });
  const skinMat = new THREE.MeshStandardMaterial({ color: 0xc49a6c, roughness: 0.9 });
  const accentMat = new THREE.MeshStandardMaterial({ color: def.accentColor, roughness: 0.7, emissive: def.accentColor, emissiveIntensity: 0.15 });

  // Torso
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.5 * scale, 0.65 * scale, 0.28 * scale), bodyMat);
  torso.position.y = 1.12 * scale;
  torso.castShadow = true;

  // Head
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.18 * scale, 12, 12), skinMat);
  head.position.y = 1.62 * scale;
  head.castShadow = true;

  // Legs
  const legGeom = new THREE.BoxGeometry(0.16 * scale, 0.6 * scale, 0.2 * scale);
  const legL = new THREE.Mesh(legGeom, bodyMat);
  legL.position.set(-0.12 * scale, 0.38 * scale, 0);
  legL.castShadow = true;
  const legR = legL.clone();
  legR.position.x = 0.12 * scale;

  // Arms
  const armGeom = new THREE.BoxGeometry(0.13 * scale, 0.5 * scale, 0.16 * scale);
  const armL = new THREE.Mesh(armGeom, bodyMat);
  armL.position.set(-0.35 * scale, 0.95 * scale, 0);
  armL.castShadow = true;
  const armR = armL.clone();
  armR.position.x = 0.35 * scale;

  // Accent: shoulder marking
  const badge = new THREE.Mesh(new THREE.BoxGeometry(0.1 * scale, 0.06 * scale, 0.08 * scale), accentMat);
  badge.position.set(-0.28 * scale, 1.35 * scale, 0.14 * scale);
  badge.castShadow = true;

  // Companion marker (small green diamond above head)
  const markerMat = new THREE.MeshStandardMaterial({ color: 0x44ff88, emissive: 0x44ff88, emissiveIntensity: 0.5, roughness: 0.4 });
  const marker = new THREE.Mesh(new THREE.OctahedronGeometry(0.06, 0), markerMat);
  marker.position.y = 1.85 * scale;
  marker.userData._compMarker = true;

  g.add(torso, head, legL, legR, armL, armR, badge, marker);

  g.traverse(o => { if (o.isMesh) o.castShadow = true; });
  return g;
}

// ---- Companion Manager ----
export class CompanionManager {
  constructor(scene) {
    this.scene = scene;
    this.active = null;     // { def, mesh, hp, hpMax, atkCd, state, target }
    this._markerT = 0;
    this._atkDir = new THREE.Vector3();
  }

  /** Recruit a companion by definition id. Returns true if successful. */
  recruit(compId, questSys, playerPos) {
    const def = CompanionDefs[compId];
    if (!def) return false;
    if (this.active) this.dismiss(questSys);

    questSys.setFlag(def.recruitFlag, true);
    questSys.setFlag(def.dismissFlag, false);

    const mesh = buildCompanionMesh(def);
    mesh.position.copy(playerPos).add(v3(-2, 0, -1));
    mesh.position.y = 0;
    this.scene.add(mesh);

    this.active = {
      def,
      mesh,
      hp: def.hp,
      hpMax: def.hpMax,
      atkCd: 0,
      state: "follow", // follow, fight, dead
      target: null,
      _bobT: 0,
    };

    return true;
  }

  /** Dismiss active companion */
  dismiss(questSys) {
    if (!this.active) return;
    questSys.setFlag(this.active.def.dismissFlag, true);
    this.scene.remove(this.active.mesh);
    this.active = null;
  }

  /** Check if companion is active */
  isActive() {
    return this.active !== null && this.active.state !== "dead";
  }

  /** Get active companion def */
  getActiveDef() {
    return this.active?.def || null;
  }

  /** Damage companion. Returns true if killed. */
  damage(amount) {
    if (!this.active || this.active.state === "dead") return false;
    this.active.hp = Math.max(0, this.active.hp - amount);
    if (this.active.hp <= 0) {
      this.active.state = "dead";
      this.active.mesh.visible = false;
      return true;
    }
    return false;
  }

  /** Revive companion (e.g., at rest point or outpost) */
  revive() {
    if (!this.active) return;
    this.active.hp = this.active.hpMax;
    this.active.state = "follow";
    this.active.mesh.visible = true;
  }

  /** Main update: follow player, fight nearby enemies */
  update(dt, playerPos, enemiesGroup, onCompanionHit) {
    if (!this.active || this.active.state === "dead") return;

    const comp = this.active;
    const def = comp.def;
    const mesh = comp.mesh;

    comp.atkCd = Math.max(0, comp.atkCd - dt);

    // Marker bob
    comp._bobT += dt * 2.5;
    mesh.traverse(c => {
      if (c.userData._compMarker) {
        c.position.y = def.height * 1.03 + Math.sin(comp._bobT) * 0.05;
        c.rotation.y += dt * 2;
      }
    });

    // Find nearest enemy
    let nearestEnemy = null;
    let nearestDist = def.aggroRange;
    if (enemiesGroup) {
      for (const e of enemiesGroup.children) {
        if (!e.userData?.enemy || e.userData.hp <= 0) continue;
        const d = mesh.position.distanceTo(e.position);
        if (d < nearestDist) {
          nearestDist = d;
          nearestEnemy = e;
        }
      }
    }

    if (nearestEnemy && nearestDist < def.aggroRange) {
      comp.state = "fight";
      comp.target = nearestEnemy;

      // Move toward enemy
      this._atkDir.copy(nearestEnemy.position).sub(mesh.position);
      this._atkDir.y = 0;
      const dist = this._atkDir.length();

      if (dist > def.attackRange * 0.8) {
        this._atkDir.normalize();
        const step = Math.min(def.speed * dt, dist - def.attackRange * 0.5);
        mesh.position.addScaledVector(this._atkDir, step);
      }

      // Face enemy
      if (dist > 0.1) {
        const ang = Math.atan2(this._atkDir.x, this._atkDir.z);
        mesh.rotation.y = lerp(mesh.rotation.y, ang, 8 * dt);
      }

      // Attack
      if (dist < def.attackRange && comp.atkCd <= 0) {
        comp.atkCd = def.attackCd;
        if (onCompanionHit) onCompanionHit(nearestEnemy, def.damage);
      }
    } else {
      comp.state = "follow";
      comp.target = null;

      // Follow player
      this._atkDir.copy(playerPos).sub(mesh.position);
      this._atkDir.y = 0;
      const dist = this._atkDir.length();

      if (dist > def.followDist) {
        this._atkDir.normalize();
        const step = Math.min(def.speed * dt, dist - def.followDist * 0.7);
        mesh.position.addScaledVector(this._atkDir, step);
      }

      // Teleport if too far (e.g., after area transition)
      if (dist > 40) {
        mesh.position.copy(playerPos).add(v3(-2, 0, -1));
      }

      // Face player direction of travel
      if (dist > def.followDist && dist > 0.1) {
        const ang = Math.atan2(this._atkDir.x, this._atkDir.z);
        mesh.rotation.y = lerp(mesh.rotation.y, ang, 6 * dt);
      }
    }

    mesh.position.y = 0;
  }

  /** Set visibility (hide in vault, show outside) */
  setVisible(v) {
    if (this.active && this.active.mesh) {
      this.active.mesh.visible = v && this.active.state !== "dead";
    }
  }

  /** Serialize companion state */
  toSave() {
    if (!this.active) return null;
    return {
      id: this.active.def.id,
      hp: this.active.hp,
      state: this.active.state
    };
  }

  /** Restore companion from save */
  fromSave(data, questSys, playerPos) {
    if (!data || !data.id) return;
    const def = CompanionDefs[data.id];
    if (!def) return;
    if (!questSys.getFlag(def.recruitFlag)) return;
    if (questSys.getFlag(def.dismissFlag)) return;

    const mesh = buildCompanionMesh(def);
    mesh.position.copy(playerPos).add(v3(-2, 0, -1));
    mesh.position.y = 0;
    this.scene.add(mesh);

    this.active = {
      def,
      mesh,
      hp: data.hp || def.hp,
      hpMax: def.hpMax,
      atkCd: 0,
      state: data.state || "follow",
      target: null,
      _bobT: 0,
    };

    if (this.active.state === "dead") {
      this.active.mesh.visible = false;
    }
  }
}
