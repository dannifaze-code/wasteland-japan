// Shrine Outpost — Outside Hub for Wasteland Japan / Vault 811
// Builds settlement meshes, interactables, campfire light, and exposes safe-zone logic.

import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.159.0/build/three.module.js";

// Deterministic outpost center — placed near the first forest tile where torii gates spawn.
// Forest biome is north (tz > 1), so we place the outpost at tile (0,2) offset.
export const OUTPOST_CENTER = new THREE.Vector3(15, 0, 2 * 90 + 30); // x=15, z=210
export const OUTPOST_SAFE_RADIUS = 35;
export const OUTPOST_DISCOVER_RADIUS = 45;

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

  scene.add(g);

  return { group: g, bedroll, board, fireLight };
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
