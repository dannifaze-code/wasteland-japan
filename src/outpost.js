// Shrine Outpost — Outside Hub for Wasteland Japan / Vault 811
// Builds settlement meshes, interactables, campfire light, and exposes safe-zone logic.

import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.159.0/build/three.module.js";

// Deterministic outpost center — placed near the first forest tile where torii gates spawn.
// Forest biome is north (tz > 1), so we place the outpost at tile (0,2) offset.
export const OUTPOST_CENTER = new THREE.Vector3(15, 0, 2 * 90 + 30); // x=15, z=210
export const OUTPOST_SAFE_RADIUS = 35;
export const OUTPOST_DISCOVER_RADIUS = 45;
export const OUTPOST_KILL_RADIUS = 60;
export const SAFE_ZONE_CHECK_INTERVAL = 3.0;

// Rail station deterministic reference — city biome tile (1,0) center area
export const RAIL_STATION_CENTER = new THREE.Vector3(-1 * 90 + 10, 0, 0 * 90 + 15);
export const RAIL_DISCOVER_RADIUS = 40;

export function buildOutpost(scene, worldRef) {
  const g = new THREE.Group();
  g.position.copy(OUTPOST_CENTER);

  const matWood = new THREE.MeshStandardMaterial({ color: 0x3a2e22, roughness: 0.9 });
  const matConcrete = new THREE.MeshStandardMaterial({ color: 0x2b2f36, roughness: 0.95 });
  const matShrine = new THREE.MeshStandardMaterial({ color: 0x3d1a1a, roughness: 0.85 });
  const matRust = new THREE.MeshStandardMaterial({ color: 0x5d3b2a, roughness: 1, metalness: 0.05 });

  // --- Barricade walls (boxes) ---
  const wallMat = new THREE.MeshStandardMaterial({ color: 0x3a3a2e, roughness: 1 });
  const walls = [
    { pos: [-10, 1.5, -8], size: [1, 3, 8] },
    { pos: [10, 1.5, -8], size: [1, 3, 8] },
    { pos: [0, 1.5, -13], size: [20, 3, 1] },
    { pos: [-6, 1, 6], size: [3, 2, 1] },
    { pos: [7, 1, 6], size: [4, 2, 1] },
  ];
  for (const w of walls) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(...w.size), wallMat);
    m.position.set(...w.pos);
    m.castShadow = true;
    m.receiveShadow = true;
    g.add(m);
  }

  // --- Shrine shelter (roof + 4 posts) ---
  const roofMat = matShrine;
  const roof = new THREE.Mesh(new THREE.BoxGeometry(7, 0.3, 6), roofMat);
  roof.position.set(0, 3.8, -5);
  roof.castShadow = true;
  g.add(roof);
  for (const sx of [-3, 3]) {
    for (const sz of [-7.5, -2.5]) {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.18, 3.8, 8), matWood);
      post.position.set(sx, 1.9, sz);
      post.castShadow = true;
      g.add(post);
    }
  }

  // --- Campfire (emissive glow + point light) ---
  const fireMat = new THREE.MeshStandardMaterial({
    color: 0xff6622, emissive: 0xff6622, emissiveIntensity: 0.9, roughness: 0.6
  });
  const fireBase = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.8, 0.3, 12), matRust);
  fireBase.position.set(0, 0.15, 0);
  g.add(fireBase);
  const flame = new THREE.Mesh(new THREE.ConeGeometry(0.35, 0.9, 8), fireMat);
  flame.position.set(0, 0.75, 0);
  g.add(flame);

  const fireLight = new THREE.PointLight(0xff8833, 2.5, 25, 1.5);
  fireLight.position.set(0, 1.5, 0);
  g.add(fireLight);

  // --- Crafting bench marker ---
  const bench = new THREE.Mesh(new THREE.BoxGeometry(2, 0.9, 1.2), matWood);
  bench.position.set(-5, 0.45, -4);
  bench.castShadow = true;
  g.add(bench);

  // --- Ground platform ---
  const platform = new THREE.Mesh(
    new THREE.PlaneGeometry(24, 22),
    new THREE.MeshStandardMaterial({ color: 0x252820, roughness: 1 })
  );
  platform.rotation.x = -Math.PI / 2;
  platform.position.y = 0.02;
  platform.receiveShadow = true;
  g.add(platform);

  // --- Bedroll Rest Point (interactable) ---
  const bedroll = new THREE.Mesh(
    new THREE.BoxGeometry(1.6, 0.15, 2.8),
    new THREE.MeshStandardMaterial({ color: 0x5a4a3a, roughness: 1 })
  );
  bedroll.position.set(4, 0.08, -5);
  bedroll.castShadow = true;
  bedroll.userData = {
    interact: true,
    kind: "restPoint",
    name: "Bedroll"
  };
  g.add(bedroll);

  // --- Notice Board / Shrine Tablet (interactable) ---
  const board = new THREE.Mesh(
    new THREE.BoxGeometry(1.5, 2.0, 0.2),
    matWood
  );
  board.position.set(-3, 1.2, -10);
  board.castShadow = true;
  board.userData = {
    interact: true,
    kind: "noticeBoard",
    name: "Shrine Tablet"
  };
  g.add(board);
  // Small text plaque on top
  const plaque = new THREE.Mesh(
    new THREE.BoxGeometry(1.2, 0.6, 0.05),
    new THREE.MeshStandardMaterial({ color: 0xccbb99, roughness: 0.8 })
  );
  plaque.position.set(-3, 2.5, -10);
  g.add(plaque);

  // --- Outpost banner (flag on a pole, tinted by hostility) ---
  const bannerPoleMat = new THREE.MeshStandardMaterial({ color: 0x3a3a3a, roughness: 0.9 });
  const bannerPole = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 3.2, 6), bannerPoleMat);
  bannerPole.position.set(6, 1.6, -10);
  bannerPole.castShadow = true;
  g.add(bannerPole);

  const bannerMat = new THREE.MeshStandardMaterial({
    color: 0x5588ff, emissive: 0x3366dd, emissiveIntensity: 0.6, roughness: 0.5
  });
  const bannerFlag = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 0.7), bannerMat);
  bannerFlag.position.set(6.65, 2.8, -10);
  bannerFlag.castShadow = true;
  g.add(bannerFlag);

  scene.add(g);

  return { group: g, bedroll, board, fireLight, flame, bannerFlag, bannerMat };
}

// ---- Default visual values (used for hostile/neutral transitions) ----
const FIRE_LIGHT_INTENSITY_NORMAL = 2.5;
const FIRE_LIGHT_INTENSITY_HOSTILE = 0.8;
const BANNER_COLOR_NORMAL = 0x5588ff;
const BANNER_EMISSIVE_NORMAL = 0x3366dd;
const BANNER_COLOR_HOSTILE = 0x1a1a2a;
const BANNER_EMISSIVE_HOSTILE = 0x110011;

/**
 * Check whether the Shrine Outpost should be hostile to the player.
 * Conditions: player betrayed Wardens in Q5 OR warden reputation ≤ -50.
 */
export function isOutpostHostile(questSys) {
  if (questSys.getFlag("q5_betrayed")) return true;
  if (questSys.getRep("wardens") <= -50) return true;
  return false;
}

/**
 * Check whether the outpost has recovered from hostility.
 * Recovery: reputation above -10 AND not permanently betrayed (betrayal can be forgiven when rep recovers).
 */
export function isOutpostRecovered(questSys) {
  return questSys.getRep("wardens") > -10;
}

/**
 * Apply hostile visual changes to the outpost (darker banner, dimmer campfire).
 */
export function applyHostileVisuals(outpostRef) {
  if (!outpostRef) return;
  if (outpostRef.fireLight) outpostRef.fireLight.intensity = FIRE_LIGHT_INTENSITY_HOSTILE;
  if (outpostRef.bannerMat) {
    outpostRef.bannerMat.color.setHex(BANNER_COLOR_HOSTILE);
    outpostRef.bannerMat.emissive.setHex(BANNER_EMISSIVE_HOSTILE);
  }
}

/**
 * Restore neutral visual state to the outpost.
 */
export function applyNeutralVisuals(outpostRef) {
  if (!outpostRef) return;
  if (outpostRef.fireLight) outpostRef.fireLight.intensity = FIRE_LIGHT_INTENSITY_NORMAL;
  if (outpostRef.bannerMat) {
    outpostRef.bannerMat.color.setHex(BANNER_COLOR_NORMAL);
    outpostRef.bannerMat.emissive.setHex(BANNER_EMISSIVE_NORMAL);
  }
}

/**
 * Check if a position is inside the safe zone.
 */
export function isInSafeZone(pos) {
  const dx = pos.x - OUTPOST_CENTER.x;
  const dz = pos.z - OUTPOST_CENTER.z;
  return (dx * dx + dz * dz) < OUTPOST_SAFE_RADIUS * OUTPOST_SAFE_RADIUS;
}

/**
 * Remove enemies within the safe zone radius. Called periodically (not every frame).
 */
export function enforceSafeZone(enemiesGroup) {
  const toRemove = [];
  for (const e of enemiesGroup.children) {
    if (!e.userData?.enemy) continue;
    const dx = e.position.x - OUTPOST_CENTER.x;
    const dz = e.position.z - OUTPOST_CENTER.z;
    if (dx * dx + dz * dz < OUTPOST_SAFE_RADIUS * OUTPOST_SAFE_RADIUS) {
      toRemove.push(e);
    }
  }
  for (const e of toRemove) {
    enemiesGroup.remove(e);
    e.parent?.remove(e);
  }
}
