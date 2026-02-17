/**
 * AssetManager — centralised, caching asset pipeline for Wasteland Japan.
 *
 * Supported runtime formats:
 *   Models  : .glb / .gltf (GLTFLoader), .fbx (FBXLoader), .obj (OBJLoader)
 *   Textures: .png / .jpg / .jpeg / .webp (TextureLoader)
 *   Audio   : .wav / .mp3 / .ogg (AudioLoader with HTMLAudio fallback)
 *
 * Every loaded asset is cached by its *key* so the same URL is never fetched
 * twice. All public methods return Promises.
 *
 * Usage (ES module, browser CDN):
 *   import { AssetManager } from "./engine/AssetManager.js";
 *   const assets = new AssetManager();
 *   const tex = await assets.loadTexture("myTex", "./assets/textures/foo.png");
 */

import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.159.0/build/three.module.js";
import { GLTFLoader } from "https://cdn.jsdelivr.net/npm/three@0.159.0/examples/jsm/loaders/GLTFLoader.js";
import { FBXLoader } from "https://cdn.jsdelivr.net/npm/three@0.159.0/examples/jsm/loaders/FBXLoader.js";
import { OBJLoader } from "https://cdn.jsdelivr.net/npm/three@0.159.0/examples/jsm/loaders/OBJLoader.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Return the lower-cased file extension from a URL (ignores query strings). */
function extOf(url) {
  const clean = url.split("?")[0].split("#")[0];
  const dot = clean.lastIndexOf(".");
  return dot === -1 ? "" : clean.slice(dot + 1).toLowerCase();
}

// ---------------------------------------------------------------------------
// AssetManager
// ---------------------------------------------------------------------------

export class AssetManager {
  constructor() {
    /** @type {Map<string, *>} */
    this._cache = new Map();

    /** @type {Map<string, Promise<*>>} In-flight requests keyed by cache key. */
    this._pending = new Map();

    // Shared loaders (one instance each, reused across calls).
    this._gltfLoader = new GLTFLoader();
    this._fbxLoader = new FBXLoader();
    this._objLoader = new OBJLoader();
    this._texLoader = new THREE.TextureLoader();
    this._audioLoader = new THREE.AudioLoader();
  }

  // -----------------------------------------------------------------------
  // Public API
  // -----------------------------------------------------------------------

  /**
   * Load a 3-D model.
   *
   * @param {string}  key   Unique cache key (e.g. "iron_shack").
   * @param {string}  url   URL / path to the model file.
   * @param {object}  [opts]  Optional settings (reserved for future use).
   * @returns {Promise<THREE.Group|THREE.Object3D>}
   */
  loadModel(key, url, opts) {
    return this._loadCached(key, () => this._doLoadModel(url, opts));
  }

  /**
   * Load a texture.
   *
   * @param {string}  key   Unique cache key.
   * @param {string}  url   URL / path to the image.
   * @param {object}  [opts]  Optional — { flipY, colorSpace, … }.
   * @returns {Promise<THREE.Texture>}
   */
  loadTexture(key, url, opts) {
    return this._loadCached(key, () => this._doLoadTexture(url, opts));
  }

  /**
   * Load an audio buffer (or HTMLAudioElement fallback).
   *
   * @param {string}  key   Unique cache key.
   * @param {string}  url   URL / path to the audio file.
   * @param {object}  [opts]  Optional — { html: true } forces HTMLAudio.
   * @returns {Promise<AudioBuffer|HTMLAudioElement>}
   */
  loadAudio(key, url, opts) {
    return this._loadCached(key, () => this._doLoadAudio(url, opts));
  }

  /**
   * Check whether a key is already cached.
   * @param {string} key
   * @returns {boolean}
   */
  has(key) {
    return this._cache.has(key);
  }

  /**
   * Retrieve a previously cached asset (returns undefined if not loaded).
   * @param {string} key
   * @returns {*}
   */
  get(key) {
    return this._cache.get(key);
  }

  /**
   * Dispose every cached asset and clear the cache.
   */
  dispose() {
    for (const asset of this._cache.values()) {
      if (asset && typeof asset.dispose === "function") {
        asset.dispose();
      }
    }
    this._cache.clear();
    this._pending.clear();
  }

  // -----------------------------------------------------------------------
  // Internal — deduplication
  // -----------------------------------------------------------------------

  /**
   * Generic load-and-cache wrapper.  Prevents duplicate in-flight requests
   * for the same key and guarantees each key is loaded at most once.
   *
   * @param {string}   key
   * @param {Function} loaderFn  () => Promise<T>
   * @returns {Promise<T>}
   */
  _loadCached(key, loaderFn) {
    // Already resolved.
    if (this._cache.has(key)) {
      return Promise.resolve(this._cache.get(key));
    }
    // Already in flight — return the same promise.
    if (this._pending.has(key)) {
      return this._pending.get(key);
    }
    // Start new load.
    const promise = loaderFn().then((result) => {
      this._cache.set(key, result);
      this._pending.delete(key);
      return result;
    }).catch((err) => {
      this._pending.delete(key);
      throw err;
    });
    this._pending.set(key, promise);
    return promise;
  }

  // -----------------------------------------------------------------------
  // Internal — concrete loaders
  // -----------------------------------------------------------------------

  /** @returns {Promise<THREE.Group|THREE.Object3D>} */
  _doLoadModel(url, _opts) {
    const ext = extOf(url);

    switch (ext) {
      case "glb":
      case "gltf":
        return new Promise((resolve, reject) => {
          this._gltfLoader.load(
            url,
            (gltf) => resolve(gltf.scene),
            undefined,
            (err) => reject(new Error(`GLTFLoader failed for ${url}: ${err}`))
          );
        });

      case "fbx":
        return new Promise((resolve, reject) => {
          this._fbxLoader.load(
            url,
            (group) => resolve(group),
            undefined,
            (err) => reject(new Error(`FBXLoader failed for ${url}: ${err}`))
          );
        });

      case "obj":
        return new Promise((resolve, reject) => {
          this._objLoader.load(
            url,
            (group) => resolve(group),
            undefined,
            (err) => reject(new Error(`OBJLoader failed for ${url}: ${err}`))
          );
        });

      default:
        return Promise.reject(
          new Error(`AssetManager.loadModel: unsupported extension "${ext}" for ${url}`)
        );
    }
  }

  /** @returns {Promise<THREE.Texture>} */
  _doLoadTexture(url, opts) {
    const ext = extOf(url);
    const supported = ["png", "jpg", "jpeg", "webp"];
    if (!supported.includes(ext)) {
      return Promise.reject(
        new Error(`AssetManager.loadTexture: unsupported extension "${ext}" for ${url}`)
      );
    }

    return new Promise((resolve, reject) => {
      this._texLoader.load(
        url,
        (texture) => {
          if (opts && opts.colorSpace) {
            texture.colorSpace = opts.colorSpace;
          }
          if (opts && opts.flipY !== undefined) {
            texture.flipY = opts.flipY;
          }
          resolve(texture);
        },
        undefined,
        (err) => reject(new Error(`TextureLoader failed for ${url}: ${err}`))
      );
    });
  }

  /** @returns {Promise<AudioBuffer|HTMLAudioElement>} */
  _doLoadAudio(url, opts) {
    const ext = extOf(url);
    const supported = ["wav", "mp3", "ogg"];
    if (!supported.includes(ext)) {
      return Promise.reject(
        new Error(`AssetManager.loadAudio: unsupported extension "${ext}" for ${url}`)
      );
    }

    // Force HTMLAudio fallback when requested or when AudioContext is unavailable.
    const useHTML = (opts && opts.html) || typeof AudioContext === "undefined";

    if (useHTML) {
      return new Promise((resolve, reject) => {
        const audio = new Audio();
        audio.preload = "auto";
        const onCanPlay = () => {
          audio.removeEventListener("canplaythrough", onCanPlay);
          audio.removeEventListener("error", onError);
          resolve(audio);
        };
        const onError = () => {
          audio.removeEventListener("canplaythrough", onCanPlay);
          audio.removeEventListener("error", onError);
          reject(new Error(`HTMLAudio failed for ${url}`));
        };
        audio.addEventListener("canplaythrough", onCanPlay);
        audio.addEventListener("error", onError);
        audio.src = url;
        audio.load();
      });
    }

    return new Promise((resolve, reject) => {
      this._audioLoader.load(
        url,
        (buffer) => resolve(buffer),
        undefined,
        (err) => reject(new Error(`AudioLoader failed for ${url}: ${err}`))
      );
    });
  }
}
