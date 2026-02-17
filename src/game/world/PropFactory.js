/**
 * PropFactory — loads source models once via AssetManager, then clones on demand.
 *
 * Usage:
 *   const factory = new PropFactory(assetManager);
 *   await factory.preload(["ironShack", "roadSigns"]);   // kick off early
 *   const model  = factory.spawn("ironShack");            // sync clone (or null)
 */

import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.159.0/build/three.module.js";
import { WorldPropDefs } from "../assets/worldProps.js";

// Lazy-loaded SkeletonUtils reference (resolved on first clone attempt).
let _skeletonUtils = null;
let _skeletonUtilsLoaded = false;

export class PropFactory {
  /**
   * @param {import("../../engine/AssetManager.js").AssetManager} assetManager
   */
  constructor(assetManager) {
    /** @type {import("../../engine/AssetManager.js").AssetManager} */
    this._assets = assetManager;
    /** @type {Map<string, THREE.Object3D>} source models keyed by prop key */
    this._sources = new Map();

    // Kick off SkeletonUtils import (non-blocking, best-effort).
    if (!_skeletonUtilsLoaded) {
      _skeletonUtilsLoaded = true;
      import(
        "https://cdn.jsdelivr.net/npm/three@0.159.0/examples/jsm/utils/SkeletonUtils.js"
      )
        .then((mod) => { _skeletonUtils = mod.SkeletonUtils || mod; })
        .catch(() => { /* unavailable — will use .clone(true) */ });
    }
  }

  // --------------------------------------------------------------------------
  // Public
  // --------------------------------------------------------------------------

  /**
   * Kick off loading for the given prop keys (non-blocking).
   * Returns a Promise.allSettled so callers can fire-and-forget.
   *
   * @param {string[]} keys  Array of WorldPropDefs keys to preload.
   * @returns {Promise<PromiseSettledResult<THREE.Object3D>[]>}
   */
  preload(keys) {
    const jobs = keys.map((key) => {
      if (this._sources.has(key)) return Promise.resolve(this._sources.get(key));
      const def = WorldPropDefs[key];
      if (!def) {
        console.warn(`[PropFactory] Unknown prop key "${key}"`);
        return Promise.reject(new Error(`Unknown prop key: ${key}`));
      }
      return this._assets
        .loadModel(key, def.url)
        .then((model) => {
          this._sources.set(key, model);
          return model;
        })
        .catch((err) => {
          console.warn(`[PropFactory] Failed to load "${key}":`, err);
          throw err;
        });
    });
    return Promise.allSettled(jobs);
  }

  /**
   * Return a ready-to-use clone of the cached source model for *key*.
   * Returns `null` if the model hasn't loaded (or failed).
   *
   * The clone has castShadow / receiveShadow and materialTweaks applied
   * according to the prop definition.
   *
   * @param {string} key
   * @returns {THREE.Object3D|null}
   */
  spawn(key) {
    const source = this._sources.get(key);
    if (!source) return null;

    const def = WorldPropDefs[key];
    const clone = this._clone(source);

    // Auto-scale to desired height using bounding box measurement
    if (def.desiredHeight != null) {
      const box = new THREE.Box3().setFromObject(clone);
      const size = new THREE.Vector3();
      box.getSize(size);

      const currentHeight = size.y;
      if (currentHeight > 0) {
        const scaleFactor = def.desiredHeight / currentHeight;
        clone.scale.setScalar(scaleFactor);
      }

      // Re-center pivot and sit model on the ground
      const center = new THREE.Vector3();
      // Re-compute box after scaling
      const scaledBox = new THREE.Box3().setFromObject(clone);
      scaledBox.getCenter(center);
      clone.position.sub(center);
      // Place bottom of model at y=0
      clone.position.y += (def.desiredHeight * 0.5);
    } else if (def.scale != null) {
      // Fallback to static scale when desiredHeight is not set
      clone.scale.setScalar(def.scale);
    }

    // Apply per-mesh tweaks
    clone.traverse((child) => {
      if (!child.isMesh) return;
      if (def.castShadow != null) child.castShadow = def.castShadow;
      if (def.receiveShadow != null) child.receiveShadow = def.receiveShadow;

      if (def.materialTweaks && child.material) {
        const mats = Array.isArray(child.material)
          ? child.material
          : [child.material];
        for (const mat of mats) {
          for (const [prop, val] of Object.entries(def.materialTweaks)) {
            if (prop in mat) mat[prop] = val;
          }
        }
      }
    });

    return clone;
  }

  // --------------------------------------------------------------------------
  // Internal
  // --------------------------------------------------------------------------

  /**
   * Clone a source model. Uses SkeletonUtils.clone when available (handles
   * skinned meshes); otherwise falls back to Object3D.clone(true).
   *
   * @param {THREE.Object3D} source
   * @returns {THREE.Object3D}
   */
  _clone(source) {
    if (_skeletonUtils && typeof _skeletonUtils.clone === "function") {
      return _skeletonUtils.clone(source);
    }
    return source.clone(true);
  }
}
