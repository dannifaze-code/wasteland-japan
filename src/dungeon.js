// Dungeon / Interior Rooms for Wasteland Japan — Vault 811
// Two mini-dungeon instances unlocked via lock/terminal payoff.
// Spawned/removed on enter/exit; not part of streaming tiles.

import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.159.0/build/three.module.js";

const v3 = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);

// ---- Dungeon Definitions ----
export const DungeonDefs = {
  maintenance_tunnel: {
    id: "maintenance_tunnel",
    name: "Maintenance Tunnel",
    // Door placed near vault exterior
    doorPos: { x: 12, y: 0, z: 18 },
    doorLockType: "lockpick", // uses lockpick system
    lockLevel: 2,
    lockId: "maintenance_tunnel_door",
    spawnPos: { x: 0, y: 1.6, z: 0 },
    exitPos: { x: 0, y: 1.6, z: 14 },
    loot: [
      { id: "scrap", qty: 3, pos: { x: -3, y: 0.45, z: -8 } },
      { id: "stim", qty: 1, pos: { x: 5, y: 0.45, z: -12 } },
      { id: "radaway", qty: 1, pos: { x: -1, y: 0.45, z: -18 } },
      { id: "circuits", qty: 2, pos: { x: 4, y: 0.45, z: -20 } },
    ],
    enemies: [
      { kind: "crawler", pos: { x: 2, y: 0, z: -10 } },
      { kind: "crawler", pos: { x: -3, y: 0, z: -16 } },
    ]
  },
  rail_service_room: {
    id: "rail_service_room",
    name: "Rail Service Room",
    // Door placed near rail station
    doorPos: { x: -80, y: 0, z: 5 },
    doorLockType: "terminal", // unlocked via terminal
    lockId: "rail_service_door",
    terminalId: "rail_service_terminal",
    spawnPos: { x: 0, y: 1.6, z: 0 },
    exitPos: { x: 0, y: 1.6, z: 12 },
    loot: [
      { id: "scrap", qty: 2, pos: { x: -4, y: 0.45, z: -6 } },
      { id: "radaway", qty: 1, pos: { x: 3, y: 0.45, z: -10 } },
      { id: "cloth", qty: 3, pos: { x: -2, y: 0.45, z: -14 } },
      { id: "vest", qty: 1, pos: { x: 0, y: 0.45, z: -18 } },
    ],
    enemies: [
      { kind: "stalker", pos: { x: 0, y: 0, z: -12 } },
      { kind: "crawler", pos: { x: -3, y: 0, z: -18 } },
    ]
  }
};

// ---- Build dungeon interior group ----
function buildDungeonInterior(def) {
  const g = new THREE.Group();

  const matWall = new THREE.MeshStandardMaterial({ color: 0x1a1e24, roughness: 0.9 });
  const matFloor = new THREE.MeshStandardMaterial({ color: 0x0e1014, roughness: 1 });
  const matCeil = new THREE.MeshStandardMaterial({ color: 0x141820, roughness: 0.95 });
  const matPipe = new THREE.MeshStandardMaterial({ color: 0x5d3b2a, roughness: 0.8, metalness: 0.2 });
  const matLight = new THREE.MeshStandardMaterial({ color: 0x88ccaa, emissive: 0x88ccaa, emissiveIntensity: 0.5, roughness: 0.4 });
  const matDoor = new THREE.MeshStandardMaterial({ color: 0x2c394f, roughness: 0.65, metalness: 0.15 });

  const isRail = def.id === "rail_service_room";
  const length = isRail ? 24 : 28;
  const width = isRail ? 12 : 8;
  const height = isRail ? 4 : 3.5;

  // Floor
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(width, length), matFloor);
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(0, 0, -length / 2);
  floor.receiveShadow = true;
  g.add(floor);

  // Ceiling
  const ceil = new THREE.Mesh(new THREE.PlaneGeometry(width, length), matCeil);
  ceil.rotation.x = Math.PI / 2;
  ceil.position.set(0, height, -length / 2);
  g.add(ceil);

  // Walls
  const wallBack = new THREE.Mesh(new THREE.BoxGeometry(width, height, 0.6), matWall);
  wallBack.position.set(0, height / 2, -length);
  wallBack.castShadow = true;
  g.add(wallBack);

  const wallFront = new THREE.Mesh(new THREE.BoxGeometry(width, height, 0.6), matWall);
  wallFront.position.set(0, height / 2, 2);
  wallFront.castShadow = true;
  g.add(wallFront);

  const wallLeft = new THREE.Mesh(new THREE.BoxGeometry(0.6, height, length + 3), matWall);
  wallLeft.position.set(-width / 2, height / 2, -length / 2);
  wallLeft.castShadow = true;
  g.add(wallLeft);

  const wallRight = new THREE.Mesh(new THREE.BoxGeometry(0.6, height, length + 3), matWall);
  wallRight.position.set(width / 2, height / 2, -length / 2);
  wallRight.castShadow = true;
  g.add(wallRight);

  // Pipes along walls
  for (let i = 0; i < 4; i++) {
    const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, length, 8), matPipe);
    pipe.rotation.x = Math.PI / 2;
    pipe.position.set(
      (i % 2 === 0 ? -1 : 1) * (width / 2 - 0.4),
      height - 0.5 - Math.floor(i / 2) * 0.8,
      -length / 2
    );
    g.add(pipe);
  }

  // Ceiling lights
  const lightSpacing = length / 5;
  for (let i = 0; i < 4; i++) {
    const lightMesh = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.12, 0.4), matLight);
    lightMesh.position.set(0, height - 0.08, -lightSpacing * (i + 0.5));
    g.add(lightMesh);

    const pl = new THREE.PointLight(0x88ccaa, 0.8, 10, 2);
    pl.position.set(0, height - 0.3, -lightSpacing * (i + 0.5));
    g.add(pl);
  }

  // Crate/obstacle props
  if (isRail) {
    // Rail service room: shelving units, toolboxes
    const shelfMat = new THREE.MeshStandardMaterial({ color: 0x2a2e36, roughness: 0.9 });
    for (let i = 0; i < 3; i++) {
      const shelf = new THREE.Mesh(new THREE.BoxGeometry(2, 2, 0.8), shelfMat);
      shelf.position.set(-width / 2 + 1.5, 1, -4 - i * 6);
      shelf.castShadow = true;
      g.add(shelf);
    }
    // Workbench
    const benchMat = new THREE.MeshStandardMaterial({ color: 0x3a2e22, roughness: 0.9 });
    const bench = new THREE.Mesh(new THREE.BoxGeometry(3, 0.9, 1.5), benchMat);
    bench.position.set(3, 0.45, -8);
    bench.castShadow = true;
    g.add(bench);
  } else {
    // Maintenance tunnel: rubble, broken pipes
    const rubbleMat = new THREE.MeshStandardMaterial({ color: 0x2a2e35, roughness: 1 });
    for (let i = 0; i < 4; i++) {
      const rubble = new THREE.Mesh(new THREE.DodecahedronGeometry(0.4 + Math.random() * 0.3, 0), rubbleMat);
      rubble.position.set(
        (Math.random() - 0.5) * (width - 2),
        0.3,
        -3 - i * 5 + Math.random() * 2
      );
      rubble.castShadow = true;
      g.add(rubble);
    }
    // Broken pipe (horizontal)
    const brokenPipe = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 3, 8), matPipe);
    brokenPipe.rotation.z = Math.PI / 2;
    brokenPipe.position.set(0, 1.2, -14);
    brokenPipe.castShadow = true;
    g.add(brokenPipe);
  }

  // Exit door (interactable)
  const exitDoor = new THREE.Mesh(new THREE.BoxGeometry(2.5, 3, 0.4), matDoor);
  exitDoor.position.set(0, 1.5, 1.5);
  exitDoor.castShadow = true;
  exitDoor.userData = {
    interact: true,
    kind: "dungeonExit",
    name: "Exit to Surface",
    dungeonId: def.id
  };
  g.add(exitDoor);

  g.visible = false;
  return { group: g, exitDoor };
}

// ---- Dungeon Manager ----
export class DungeonManager {
  constructor(scene, world) {
    this.scene = scene;
    this.world = world;
    this.dungeons = {};
    this.activeDungeon = null;
    this.returnPos = null;
    this.returnYaw = 0;
    this.doorMeshes = [];

    // Build dungeon interiors
    for (const [id, def] of Object.entries(DungeonDefs)) {
      const interior = buildDungeonInterior(def);
      scene.add(interior.group);
      this.dungeons[id] = { def, ...interior, enemies: [], loots: [], spawned: false };
    }
  }

  /** Create dungeon door meshes in the outside world. Call once after world setup. */
  spawnDoors() {
    const matDoor = new THREE.MeshStandardMaterial({ color: 0x3a4a5a, roughness: 0.7, metalness: 0.2 });
    const matFrame = new THREE.MeshStandardMaterial({ color: 0x2b2f36, roughness: 0.9 });

    for (const [id, def] of Object.entries(DungeonDefs)) {
      const doorGroup = new THREE.Group();
      doorGroup.position.set(def.doorPos.x, def.doorPos.y, def.doorPos.z);

      // Frame
      const frame = new THREE.Mesh(new THREE.BoxGeometry(3, 3.5, 2), matFrame);
      frame.position.set(0, 1.75, 0);
      frame.castShadow = true;
      doorGroup.add(frame);

      // Door panel (interactable)
      const door = new THREE.Mesh(new THREE.BoxGeometry(2, 2.8, 0.3), matDoor);
      door.position.set(0, 1.4, 1.05);
      door.castShadow = true;
      door.userData = {
        interact: true,
        kind: "dungeonDoor",
        name: def.name,
        dungeonId: id,
        lockId: def.lockId,
        lockLevel: def.lockLevel || 0,
        lockType: def.doorLockType,
        terminalId: def.terminalId || null
      };
      doorGroup.add(door);

      // Small label sign
      const signMat = new THREE.MeshStandardMaterial({ color: 0x9bd3ff, emissive: 0x9bd3ff, emissiveIntensity: 0.3, roughness: 0.4 });
      const sign = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.3, 0.05), signMat);
      sign.position.set(0, 3.2, 1.0);
      doorGroup.add(sign);

      // If terminal-locked, place a terminal console next to the door
      if (def.doorLockType === "terminal" && def.terminalId) {
        const termMat = new THREE.MeshStandardMaterial({ color: 0x2c394f, roughness: 0.65, metalness: 0.15 });
        const termConsole = new THREE.Mesh(new THREE.BoxGeometry(1.5, 1.0, 0.8), termMat);
        termConsole.position.set(3, 0.5, 0.5);
        termConsole.castShadow = true;
        termConsole.userData = {
          interact: true,
          kind: "terminal",
          name: "Service Terminal",
          terminalId: def.terminalId
        };
        doorGroup.add(termConsole);
      }

      this.scene.add(doorGroup);
      this.doorMeshes.push({ group: doorGroup, door, id });
    }
  }

  /** Set visibility of all dungeon doors (hidden when player is inside vault or dungeon) */
  setDoorsVisible(v) {
    for (const dm of this.doorMeshes) {
      dm.group.visible = v;
    }
  }

  /** Enter a dungeon by id. Returns true if successful. */
  enter(dungeonId, player, questSys) {
    const d = this.dungeons[dungeonId];
    if (!d) return false;

    // Check lock
    const def = d.def;
    const flagKey = `unlocked:${def.lockId}`;
    if (!questSys.getFlag(flagKey)) {
      return false; // still locked
    }

    // Save return position
    this.returnPos = player.pos.clone();
    this.returnYaw = player.yaw;
    this.activeDungeon = dungeonId;

    // Show dungeon interior
    d.group.visible = true;

    // Spawn enemies + loot if not already spawned
    if (!d.spawned) {
      d.spawned = true;
      // Enemies will be spawned by the game (passed back)
      // Loots will be spawned by the game (passed back)
    }

    // Teleport player to dungeon spawn
    player.pos.set(def.spawnPos.x, def.spawnPos.y, def.spawnPos.z);
    player.yaw = Math.PI;

    return true;
  }

  /** Exit the active dungeon. Returns return position or null. */
  exit(player) {
    if (!this.activeDungeon) return null;
    const d = this.dungeons[this.activeDungeon];

    // Hide dungeon
    d.group.visible = false;

    // Clean up dungeon enemies
    for (const e of d.enemies) {
      this.scene.remove(e);
    }
    d.enemies = [];

    // Clean up dungeon loots
    for (const l of d.loots) {
      this.scene.remove(l);
    }
    d.loots = [];

    const ret = { pos: this.returnPos.clone(), yaw: this.returnYaw };
    this.activeDungeon = null;
    this.returnPos = null;

    return ret;
  }

  /** Check if player is inside a dungeon */
  isInDungeon() {
    return this.activeDungeon !== null;
  }

  /** Get the active dungeon definition */
  getActiveDef() {
    if (!this.activeDungeon) return null;
    return this.dungeons[this.activeDungeon]?.def || null;
  }

  /** Get dungeon enemies + loot spawn data (called once on first enter) */
  getSpawnData(dungeonId) {
    const d = this.dungeons[dungeonId];
    if (!d) return null;
    return { enemies: d.def.enemies, loot: d.def.loot };
  }

  /** Register a spawned enemy mesh for cleanup on exit */
  addEnemy(dungeonId, mesh) {
    const d = this.dungeons[dungeonId];
    if (d) d.enemies.push(mesh);
  }

  /** Register a spawned loot mesh for cleanup on exit */
  addLoot(dungeonId, mesh) {
    const d = this.dungeons[dungeonId];
    if (d) d.loots.push(mesh);
  }

  /** Get list of all dungeon door meshes for raycast/interact */
  getDoorInteractables() {
    return this.doorMeshes.map(dm => dm.door);
  }
}
