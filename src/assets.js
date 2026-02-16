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
  models: {
    japanese_iron_shack: {
      path: "models/environment/buildings/小屋トタン.fbx",
      label: "Japanese Iron Shack (小屋トタン)",
    },
  },
  textures: {
    japanese_iron_shack_albedo: {
      path: "textures/environment/buildings/小屋トタン_小屋トタン1_AlbedoTransparency.1001.png",
    },
    japanese_iron_shack_metallic: {
      path: "textures/environment/buildings/小屋トタン_小屋トタン1_MetallicSmoothness.1001.png",
    },
    japanese_iron_shack_normal: {
      path: "textures/environment/buildings/小屋トタン_小屋トタン1_Normal.1001.png",
    },
  },
  audio: {},
};
