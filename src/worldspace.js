// Worldspace POI placement — loads poi_kuroshima_act1.json and places
// deterministic POI markers/triggers at correct terrain heights.

import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.159.0/build/three.module.js";
import { FBXLoader } from "https://cdn.jsdelivr.net/npm/three@0.159.0/examples/jsm/loaders/FBXLoader.js";
import { ASSET_BASE } from "./assets.js";

// Mapping from signVariant → texture PNG filename under textures/environment/roads_signs/
const SIGN_TEXTURE_FILES = {
  stop: "001.png",
  slow_down: "002.png",
  no_entry: "003.png",
  no_passing: "004.png",
  no_parking: "005.png",
  no_stopping: "006.png",
  one_way: "007.png",
  pedestrian_crossing: "008.png",
  caution: "009.png",
  curve_right: "010.png",
  curve_left: "011.png",
  intersection: "012.png",
  railroad: "013.png",
  school_zone: "014.png",
  slippery: "015.png",
  falling_rocks: "016.png",
  road_works: "017.png",
  two_way: "018.png",
  narrow_road: "019.png",
  steep_grade: "020.png",
  yield: "021.png",
  keep_left: "022.png",
  keep_right: "023.png",
  roundabout: "024.png",
  speed_limit: "025-30.png",
  direction: "026.png",
  dead_end: "028.png",
  national_route: "029.png",
  guide_board: "030.png",
  street_name: "032.png",
};

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

    /** Shared texture loader for sign face textures */
    this._texLoader = new THREE.TextureLoader();

    // Radiation zones tracked by world position
    this._radZones = [];
    this._pollId = null;

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
      let attempts = 0;
      this._pollId = setInterval(() => {
        attempts++;
        if (this.terrain.ready) {
          clearInterval(this._pollId);
          this._pollId = null;
          this._placeAll();
        } else if (attempts > 100) {
          clearInterval(this._pollId);
          this._pollId = null;
          console.warn("Worldspace: terrain not ready after timeout, placing at y=0");
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

      case "iron_shack":
        this._placeIronShack(poi, x, y, z);
        break;

      case "road_sign":
        this._placeRoadSign(poi, x, y, z);
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

  _placeIronShack(poi, x, y, z) {
    const loader = new FBXLoader();
    const texLoader = this._texLoader;
    const modelPath = `${ASSET_BASE}/models/environment/buildings/小屋トタン.fbx`;
    const poiGroup = this.poiGroup;

    // Build a PBR material from the shipped texture maps.
    // roughness/metalness set to 1.0 so texture maps drive the values directly.
    const mat = new THREE.MeshStandardMaterial({ roughness: 1.0, metalness: 1.0 });

    const albedoPath = `${ASSET_BASE}/textures/environment/buildings/小屋トタン_小屋トタン1_AlbedoTransparency.1001.png`;
    const metallicPath = `${ASSET_BASE}/textures/environment/buildings/小屋トタン_小屋トタン1_MetallicSmoothness.1001.png`;
    const normalPath = `${ASSET_BASE}/textures/environment/buildings/小屋トタン_小屋トタン1_Normal.1001.png`;

    texLoader.load(albedoPath, (tex) => {
      tex.colorSpace = THREE.SRGBColorSpace;
      mat.map = tex;
      mat.needsUpdate = true;
    });
    texLoader.load(metallicPath, (tex) => {
      mat.metalnessMap = tex;
      mat.roughnessMap = tex;
      mat.needsUpdate = true;
    });
    texLoader.load(normalPath, (tex) => {
      mat.normalMap = tex;
      mat.needsUpdate = true;
    });

    loader.load(modelPath, (fbx) => {
      fbx.traverse((child) => {
        if (child.isMesh) {
          child.material = mat;
          child.castShadow = true;
          child.receiveShadow = true;
        }
      });
      fbx.position.set(x, y, z);
      fbx.userData.poi = poi.name;
      poiGroup.add(fbx);
    }, undefined, (err) => {
      console.warn("Worldspace: failed to load iron shack FBX", err);
    });

    this._addDebugMarker(poi, x, y, z, 0x8b6914);
  }

  /**
   * Places a weathered Japanese road sign — post-nuclear wasteland style.
   * Signs are procedurally generated with rust, tilt, and damage details
   * to maintain the Fallout / New Vegas apocalyptic aesthetic.
   */
  _placeRoadSign(poi, x, y, z) {
    const g = new THREE.Group();
    const tiltDeg = poi.tilt || 0;
    const variant = poi.signVariant || "caution";

    // Wasteland-weathered materials
    const matPoleRust = new THREE.MeshStandardMaterial({
      color: 0x4a3828, roughness: 0.95, metalness: 0.2
    });
    const matSignFace = new THREE.MeshStandardMaterial({
      color: this._signFaceColor(variant),
      roughness: 0.85,
      metalness: 0.1
    });
    const matSignBack = new THREE.MeshStandardMaterial({
      color: 0x3a332a, roughness: 0.95, metalness: 0.15
    });

    // Load the sign face texture PNG and apply it to the front material
    const texFile = SIGN_TEXTURE_FILES[variant];
    if (texFile) {
      const texPath = `${ASSET_BASE}/textures/environment/roads_signs/${texFile}`;
      this._texLoader.load(texPath, (texture) => {
        texture.colorSpace = THREE.SRGBColorSpace;
        matSignFace.map = texture;
        matSignFace.color.set(0xffffff);
        matSignFace.needsUpdate = true;
      });
    }

    // Rusted pole
    const poleHeight = variant === "guide_board" ? 4.5 : 3.0;
    const pole = new THREE.Mesh(
      new THREE.CylinderGeometry(0.06, 0.08, poleHeight, 6),
      matPoleRust
    );
    pole.position.y = poleHeight / 2;
    pole.castShadow = true;
    g.add(pole);

    // Sign face — shape varies by variant
    const signMesh = this._buildSignFace(variant, matSignFace, matSignBack);
    signMesh.position.y = poleHeight - 0.2;
    signMesh.castShadow = true;
    g.add(signMesh);

    // Weathering detail: small rust chunk at base
    const debris = new THREE.Mesh(
      new THREE.BoxGeometry(0.3, 0.15, 0.2),
      matPoleRust
    );
    debris.position.set(0.15, 0.08, 0.1);
    debris.rotation.y = 0.7;
    g.add(debris);

    // Apply post-apocalyptic tilt (blast damage / ground settling)
    const tiltRad = (tiltDeg * Math.PI) / 180;
    g.rotation.z = tiltRad;
    // Deterministic rotation around Y for variety
    const rawAngle = poi.world.x * 7 + poi.world.z * 13;
    g.rotation.y = rawAngle - Math.floor(rawAngle / (Math.PI * 2)) * (Math.PI * 2);

    g.position.set(x, y, z);
    g.userData.poi = poi.name;
    g.userData.signVariant = variant;
    g.traverse(o => { if (o.isMesh) o.castShadow = true; });
    this.poiGroup.add(g);
    this._addDebugMarker(poi, x, y, z, 0xccaa44);
  }

  /** Returns a weathered/faded color for the sign face based on variant. */
  _signFaceColor(variant) {
    const colors = {
      stop: 0x6b2020,        // faded red
      no_entry: 0x7a2828,    // dark faded red
      slow_down: 0x8a7a30,   // yellowed
      speed_limit: 0x8888a0, // faded white-blue
      caution: 0x8a7a20,     // scorched yellow
      dead_end: 0x4a5a8a,    // faded blue
      direction: 0x3a6a3a,   // faded green
      railroad: 0x8a8a40,    // faded yellow
      yield: 0x7a3030,       // faded red-orange
      guide_board: 0x2a5a3a, // dark faded green
    };
    return colors[variant] || 0x6a6a5a;
  }

  /** Builds the sign face mesh appropriate for the variant. */
  _buildSignFace(variant, matFront, matBack) {
    const signGroup = new THREE.Group();
    let geometry;

    switch (variant) {
      case "stop": {
        // Octagonal stop sign
        const shape = new THREE.Shape();
        const r = 0.45;
        for (let i = 0; i < 8; i++) {
          const a = (Math.PI / 8) + (i * Math.PI) / 4;
          const px = Math.cos(a) * r;
          const py = Math.sin(a) * r;
          if (i === 0) shape.moveTo(px, py);
          else shape.lineTo(px, py);
        }
        shape.closePath();
        geometry = new THREE.ExtrudeGeometry(shape, { depth: 0.03, bevelEnabled: false });
        break;
      }
      case "caution":
      case "yield": {
        // Triangle sign
        const shape = new THREE.Shape();
        shape.moveTo(0, 0.5);
        shape.lineTo(-0.45, -0.25);
        shape.lineTo(0.45, -0.25);
        shape.closePath();
        geometry = new THREE.ExtrudeGeometry(shape, { depth: 0.03, bevelEnabled: false });
        break;
      }
      case "guide_board": {
        // Large rectangular board
        geometry = new THREE.BoxGeometry(2.0, 0.8, 0.05);
        break;
      }
      case "speed_limit":
      case "no_entry":
      case "railroad": {
        // Circular sign
        geometry = new THREE.CylinderGeometry(0.4, 0.4, 0.03, 16);
        const mesh = new THREE.Mesh(geometry, matFront);
        mesh.rotation.x = Math.PI / 2;
        signGroup.add(mesh);
        return signGroup;
      }
      default: {
        // Standard rectangular sign
        geometry = new THREE.BoxGeometry(0.7, 0.7, 0.03);
        break;
      }
    }

    const front = new THREE.Mesh(geometry, matFront);
    signGroup.add(front);

    // Back plate (slightly larger, darker)
    const backPlate = new THREE.Mesh(
      new THREE.BoxGeometry(
        variant === "guide_board" ? 2.05 : 0.75,
        variant === "guide_board" ? 0.85 : 0.75,
        0.02
      ),
      matBack
    );
    backPlate.position.z = -0.025;
    signGroup.add(backPlate);

    return signGroup;
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
