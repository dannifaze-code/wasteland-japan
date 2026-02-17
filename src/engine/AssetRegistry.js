/**
 * AssetRegistry — loads assets.manifest.json and provides key-based
 * look-ups for models, textures, audio and data assets.
 *
 * Usage (browser ES module):
 *   import { AssetRegistry } from "./engine/AssetRegistry.js";
 *   const registry = new AssetRegistry();
 *   await registry.load();                       // fetch manifest
 *   const url = registry.getModel("iron_shack"); // → "assets/models/props/iron_shack.glb"
 *
 * If the manifest is missing or fails to load the registry stays empty and
 * sets this.error so callers can show a toast instead of crashing.
 */

const DEFAULT_MANIFEST_URL = "./src/engine/registry/assets.manifest.json";

export class AssetRegistry {
  constructor(manifestUrl) {
    /** @type {string} */
    this._url = manifestUrl || DEFAULT_MANIFEST_URL;

    /** @type {object|null} Raw manifest data. */
    this.manifest = null;

    /** @type {string|null} Human-readable error if load failed. */
    this.error = null;
  }

  // -----------------------------------------------------------------------
  // Public
  // -----------------------------------------------------------------------

  /**
   * Fetch and parse the manifest JSON. Safe to call multiple times (idempotent).
   * @returns {Promise<void>}
   */
  async load() {
    if (this.manifest) return; // already loaded
    try {
      const res = await fetch(this._url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      this.manifest = await res.json();
    } catch (err) {
      this.error = `No manifest found. Using placeholders. (${err.message})`;
      this.manifest = { models: {}, textures: {}, audio: {}, data: {} };
      console.warn(`[AssetRegistry] ${this.error}`);
    }
  }

  /** @returns {{ url: string, type?: string, tags?: string[] }|undefined} */
  getModel(key) {
    return this.manifest && this.manifest.models
      ? this.manifest.models[key]
      : undefined;
  }

  /** @returns {{ url: string, colorSpace?: string }|undefined} */
  getTexture(key) {
    return this.manifest && this.manifest.textures
      ? this.manifest.textures[key]
      : undefined;
  }

  /** @returns {{ url: string }|undefined} */
  getAudio(key) {
    return this.manifest && this.manifest.audio
      ? this.manifest.audio[key]
      : undefined;
  }

  /** @returns {{ url: string }|undefined} */
  getData(key) {
    return this.manifest && this.manifest.data
      ? this.manifest.data[key]
      : undefined;
  }

  /**
   * Print a console table summarising loaded counts per category.
   */
  printSummary() {
    if (!this.manifest) {
      console.warn("[AssetRegistry] manifest not loaded yet");
      return;
    }
    const counts = {
      models: Object.keys(this.manifest.models || {}).length,
      textures: Object.keys(this.manifest.textures || {}).length,
      audio: Object.keys(this.manifest.audio || {}).length,
      data: Object.keys(this.manifest.data || {}).length,
    };
    console.table(counts);
  }
}
