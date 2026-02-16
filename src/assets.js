/**
 * Asset registry module (future-proofing).
 *
 * Provides a base path constant, a helper to build asset paths, and a
 * manifest object that will eventually catalogue every runtime asset.
 *
 * Not wired into gameplay yet — safe to import without side-effects.
 */

export const ASSET_BASE = "./assets";

export function assetPath(rel) {
  return `${ASSET_BASE}/${rel}`;
}

export const AssetManifest = {
  maps: {},
  models: {},
  textures: {},
  audio: {},
};
