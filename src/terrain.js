// HeightmapTerrain — loads a grayscale PNG heightmap and builds a displaced PlaneGeometry
// for the outside worldspace. Provides height sampling for grounding objects.

import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.159.0/build/three.module.js";

export const MAP_SIZE = 900;
export const MAP_HALF = MAP_SIZE / 2;
export const HEIGHT_SCALE = 38;
const SEGMENTS = 192;

export class HeightmapTerrain {
  /**
   * @param {THREE.Scene} scene
   * @param {string} heightmapUrl - relative URL to the heightmap PNG
   */
  constructor(scene, heightmapUrl) {
    this.scene = scene;
    this.ready = false;
    this.heightData = null; // Uint8ClampedArray from canvas
    this.imgW = 0;
    this.imgH = 0;
    this.mesh = null;
    this.group = new THREE.Group();
    scene.add(this.group);
    this._load(heightmapUrl);
  }

  _load(url) {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const c = document.createElement("canvas");
      c.width = img.width;
      c.height = img.height;
      const ctx = c.getContext("2d");
      ctx.drawImage(img, 0, 0);
      const id = ctx.getImageData(0, 0, img.width, img.height);
      this.heightData = id.data;
      this.imgW = img.width;
      this.imgH = img.height;
      this._buildMesh();
      this.ready = true;
    };
    img.onerror = () => {
      console.warn("HeightmapTerrain: failed to load heightmap, using flat terrain");
      // fallback: flat plane
      this.imgW = 2;
      this.imgH = 2;
      this.heightData = new Uint8ClampedArray(2 * 2 * 4); // all zeros
      this._buildMesh();
      this.ready = true;
    };
    img.src = url;
  }

  _buildMesh() {
    const segments = SEGMENTS;
    const geom = new THREE.PlaneGeometry(MAP_SIZE, MAP_SIZE, segments, segments);
    // Rotate to XZ plane (default PlaneGeometry is in XY)
    geom.rotateX(-Math.PI / 2);

    const pos = geom.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const z = pos.getZ(i);
      const h = this._sampleRaw(x, z);
      pos.setY(i, h);
    }
    pos.needsUpdate = true;
    geom.computeVertexNormals();

    const mat = new THREE.MeshStandardMaterial({
      color: 0x22262c,
      roughness: 1,
      flatShading: false,
    });

    this.mesh = new THREE.Mesh(geom, mat);
    this.mesh.receiveShadow = true;
    this.mesh.castShadow = false;
    this.group.add(this.mesh);
  }

  /**
   * Raw bilinear sample from stored pixel data.
   * Maps world x,z (-MAP_HALF..MAP_HALF) to pixel coords.
   */
  _sampleRaw(x, z) {
    if (!this.heightData) return 0;
    // Map world position to UV  (0..1)
    const u = (x + MAP_HALF) / MAP_SIZE;
    const v = (z + MAP_HALF) / MAP_SIZE;
    return this._bilinear(u, v) * HEIGHT_SCALE;
  }

  _bilinear(u, v) {
    const w = this.imgW;
    const h = this.imgH;
    // Clamp UV
    const cu = Math.max(0, Math.min(1, u));
    const cv = Math.max(0, Math.min(1, v));
    const fx = cu * (w - 1);
    const fy = cv * (h - 1);
    const ix = Math.floor(fx);
    const iy = Math.floor(fy);
    const dx = fx - ix;
    const dy = fy - iy;
    const ix1 = Math.min(ix + 1, w - 1);
    const iy1 = Math.min(iy + 1, h - 1);
    const s00 = this._pixel(ix, iy);
    const s10 = this._pixel(ix1, iy);
    const s01 = this._pixel(ix, iy1);
    const s11 = this._pixel(ix1, iy1);
    return (
      s00 * (1 - dx) * (1 - dy) +
      s10 * dx * (1 - dy) +
      s01 * (1 - dx) * dy +
      s11 * dx * dy
    );
  }

  _pixel(ix, iy) {
    // Grayscale heightmap: read R channel (index 0), normalize to 0..1
    const idx = (iy * this.imgW + ix) * 4;
    return (this.heightData[idx] || 0) / 255;
  }

  /**
   * Sample terrain height at any world (x, z). Returns Y value.
   */
  sampleHeight(x, z) {
    if (!this.ready) return 0;
    return this._sampleRaw(x, z);
  }

  /**
   * Set an object's Y position to sit on the terrain.
   * @param {THREE.Object3D|{position:{x:number,y:number,z:number}}} obj
   * @param {number} [offset=0] - extra Y offset above terrain
   */
  clampToTerrain(obj, offset = 0) {
    const p = obj.position || obj;
    p.y = this.sampleHeight(p.x, p.z) + offset;
  }

  setVisible(v) {
    this.group.visible = v;
  }

  dispose() {
    if (this.mesh) {
      this.mesh.geometry.dispose();
      this.mesh.material.dispose();
      this.group.remove(this.mesh);
    }
    this.scene.remove(this.group);
  }
}
