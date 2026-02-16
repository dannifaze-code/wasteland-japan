// Worldspace POI placement — loads poi_kuroshima_act1.json and places
// deterministic POI markers/triggers at correct terrain heights.

import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.159.0/build/three.module.js";

/**
 * Loads POI data and places objects in the scene at terrain-correct heights.
 * Returns a controller object with references and helpers.
 */
export class Worldspace {
  /**
   * @param {THREE.Scene} scene
   * @param {import("./terrain.js").HeightmapTerrain} terrain
   * @param {string} poiUrl
   * @param {{buildOutpostAt?:Function, world?:Object}} helpers
   */
  constructor(scene, terrain, poiUrl, helpers = {}) {
    this.scene = scene;
    this.terrain = terrain;
    this.helpers = helpers;
    this.pois = [];
    this.poiGroup = new THREE.Group();
    this.poiGroup.visible = false; // shown after terrain loads
    scene.add(this.poiGroup);
    /** POI data from JSON */
    this.poiData = [];
    /** Debug markers group (toggled with F8) */
    this.debugGroup = new THREE.Group();
    this.debugGroup.visible = false;
    scene.add(this.debugGroup);

    // Radiation zones tracked by world position
    this._radZones = [];

    this._load(poiUrl);
  }

  async _load(url) {
    try {
      const resp = await fetch(url);
      const data = await resp.json();
      this.poiData = data.pois || [];
      // Wait for terrain to be ready before placing
      this._waitAndPlace();
    } catch (e) {
      console.warn("Worldspace: failed to load POI data", e);
    }
  }

  _waitAndPlace() {
    if (this.terrain.ready) {
      this._placeAll();
    } else {
      // Poll until terrain is ready (image loading is async)
      const id = setInterval(() => {
        if (this.terrain.ready) {
          clearInterval(id);
          this._placeAll();
        }
      }, 100);
    }
  }

  _placeAll() {
    for (const poi of this.poiData) {
      this._placePOI(poi);
    }
    this.poiGroup.visible = true;
  }

  _placePOI(poi) {
    const x = poi.world.x;
    const z = poi.world.z;
    const y = this.terrain.sampleHeight(x, z);

    switch (poi.type) {
      case "vault":
        // Reference only — do not create a second vault.
        // Place a small debug marker.
        this._addDebugMarker(poi, x, y, z, 0x9bd3ff);
        break;

      case "torii":
        this._placeTorii(poi, x, y, z);
        break;

      case "outpost":
        // outpost is built separately; just store coords for positioning
        this._addDebugMarker(poi, x, y, z, 0x33ff66);
        break;

      case "rail":
        this._placeRail(poi, x, y, z);
        break;

      case "industrial":
        this._placeIndustrial(poi, x, y, z);
        break;

      case "dungeonDoor":
        this._placeDungeonDoor(poi, x, y, z);
        break;

      case "poi":
      default:
        this._placeGenericPOI(poi, x, y, z);
        break;
    }

    this.pois.push({ ...poi, worldY: y });
  }

  // ---- POI Builders ----

  _placeTorii(poi, x, y, z) {
    const g = new THREE.Group();
    const mat = new THREE.MeshStandardMaterial({ color: 0x2d0d0d, roughness: 0.9 });
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.7, 5.0, 0.7), mat);
    const post2 = post.clone();
    post.position.set(-2, 2.5, 0);
    post2.position.set(2, 2.5, 0);
    const beam = new THREE.Mesh(new THREE.BoxGeometry(5.6, 0.6, 1.0), mat);
    beam.position.set(0, 5.3, 0);
    const beam2 = new THREE.Mesh(new THREE.BoxGeometry(4.8, 0.5, 0.9), mat);
    beam2.position.set(0, 4.6, 0);
    g.add(post, post2, beam, beam2);
    g.position.set(x, y, z);
    g.userData.poi = poi.name;
    g.traverse(o => { if (o.isMesh) o.castShadow = true; });
    this.poiGroup.add(g);
    this._addDebugMarker(poi, x, y, z, 0xff3333);
  }

  _placeRail(poi, x, y, z) {
    const g = new THREE.Group();
    const matConcrete = new THREE.MeshStandardMaterial({ color: 0x2b2f36, roughness: 0.95 });
    const matNeon = new THREE.MeshStandardMaterial({ color: 0x3bd0ff, emissive: 0x3bd0ff, emissiveIntensity: 0.8, roughness: 0.4 });
    const matRail = new THREE.MeshStandardMaterial({ color: 0x4a3a2a, roughness: 0.8, metalness: 0.3 });
    const base = new THREE.Mesh(new THREE.BoxGeometry(14, 2.2, 10), matConcrete);
    base.position.y = 1.1;
    const roof = new THREE.Mesh(new THREE.BoxGeometry(14, 0.8, 10), matConcrete);
    roof.position.y = 3.2;
    const neon = new THREE.Mesh(new THREE.BoxGeometry(5.5, 0.4, 0.3), matNeon);
    neon.position.set(0, 2.5, 5.2);
    // Rails
    for (let side = -1; side <= 1; side += 2) {
      const rail = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.1, 30), matRail);
      rail.position.set(side * 0.6, 0.15, -10);
      rail.castShadow = true;
      g.add(rail);
    }
    g.add(base, roof, neon);
    g.position.set(x, y, z);
    g.userData.poi = poi.name;
    g.traverse(o => { if (o.isMesh) o.castShadow = true; });
    this.poiGroup.add(g);
    this._addDebugMarker(poi, x, y, z, 0xffaa00);
  }

  _placeIndustrial(poi, x, y, z) {
    const g = new THREE.Group();
    const matRust = new THREE.MeshStandardMaterial({ color: 0x5d3b2a, roughness: 1, metalness: 0.05 });
    const matConcrete = new THREE.MeshStandardMaterial({ color: 0x2b2f36, roughness: 0.95 });
    for (let i = 0; i < 3; i++) {
      const s = new THREE.Mesh(new THREE.CylinderGeometry(1, 1.2, 10, 12), matRust);
      s.position.set(-4 + i * 4, 5, 0);
      s.castShadow = true;
      g.add(s);
    }
    const box = new THREE.Mesh(new THREE.BoxGeometry(10, 3.2, 6), matConcrete);
    box.position.set(0, 1.6, 3);
    box.castShadow = true;
    g.add(box);
    // Add some crates as interactables
    const matWood = new THREE.MeshStandardMaterial({ color: 0x3a2e22, roughness: 0.9 });
    for (let i = 0; i < 3; i++) {
      const c = new THREE.Mesh(new THREE.BoxGeometry(1.1, 1.0, 1.1), matWood);
      c.position.set(-3 + i * 3, 0.5, 5);
      c.castShadow = true;
      c.userData = { interact: true, kind: "container", opened: false, name: "Industrial Crate" };
      g.add(c);
    }
    g.position.set(x, y, z);
    g.userData.poi = poi.name;
    this.poiGroup.add(g);
    // Register radiation zone
    this._radZones.push({ x, z, radius: 30, intensity: 3.0 });
    this._addDebugMarker(poi, x, y, z, 0xff6600);
  }

  _placeDungeonDoor(poi, x, y, z) {
    // Dungeon doors are handled by DungeonManager; place a visual marker only
    const g = new THREE.Group();
    const matDoor = new THREE.MeshStandardMaterial({ color: 0x2c394f, roughness: 0.65, metalness: 0.15 });
    const hatch = new THREE.Mesh(new THREE.CylinderGeometry(1.0, 1.0, 0.3, 12), matDoor);
    hatch.rotation.x = Math.PI / 2;
    hatch.position.y = 0.15;
    hatch.castShadow = true;
    g.add(hatch);
    g.position.set(x, y, z);
    g.userData.poi = poi.name;
    this.poiGroup.add(g);
    this._addDebugMarker(poi, x, y, z, 0xaa55ff);
  }

  _placeGenericPOI(poi, x, y, z) {
    // Generic POI marker: ruined structures
    const g = new THREE.Group();
    const matConcrete = new THREE.MeshStandardMaterial({ color: 0x2b2f36, roughness: 0.95 });
    const ruin = new THREE.Mesh(new THREE.BoxGeometry(5, 3, 4), matConcrete);
    ruin.position.y = 1.5;
    ruin.castShadow = true;
    g.add(ruin);
    g.position.set(x, y, z);
    g.userData.poi = poi.name;
    this.poiGroup.add(g);
    this._addDebugMarker(poi, x, y, z, 0xcccccc);
  }

  // ---- Debug Markers ----

  _addDebugMarker(poi, x, y, z, color) {
    const sphere = new THREE.Mesh(
      new THREE.SphereGeometry(1.5, 8, 8),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.6 })
    );
    sphere.position.set(x, y + 8, z);
    sphere.userData.debugPOI = poi.id;
    sphere.userData.poiName = poi.name;
    this.debugGroup.add(sphere);
  }

  toggleDebug() {
    this.debugGroup.visible = !this.debugGroup.visible;
    return this.debugGroup.visible;
  }

  /**
   * Returns radiation gain/sec at a world position from industrial zones.
   */
  getRadiationAtPos(pos) {
    let rad = 0;
    for (const zone of this._radZones) {
      const dx = pos.x - zone.x;
      const dz = pos.z - zone.z;
      const distSq = dx * dx + dz * dz;
      const rSq = zone.radius * zone.radius;
      if (distSq < rSq) {
        rad += zone.intensity * (1 - Math.sqrt(distSq) / zone.radius);
      }
    }
    return rad;
  }

  /**
   * Get list of POI data for teleporting (F9 debug).
   */
  getTeleportTargets() {
    return this.pois
      .filter(p => p.type !== "vault")
      .map(p => ({ id: p.id, name: p.name, x: p.world.x, z: p.world.z, y: p.worldY }));
  }

  setVisible(v) {
    this.poiGroup.visible = v;
  }
}
