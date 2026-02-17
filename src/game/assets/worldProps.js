/**
 * WorldPropDefs — single registry for all world‑spawnable props.
 *
 * Adding a new model pack:
 *   1. Drop the files into /assets/models/environment/…
 *   2. Add one entry here.
 *   3. Done — World picks it up automatically.
 *
 * Fields:
 *   url            – relative path from project root
 *   type           – "gltf" | "fbx" | "obj"
 *   scale          – uniform scale (default 1)
 *   rotationY      – base Y rotation in radians (default 0)
 *   yOffset        – vertical offset after placement (default 0)
 *   materialTweaks – optional { metalness, roughness, … } applied per mesh
 *   castShadow     – per-mesh flag (default false)
 *   receiveShadow  – per-mesh flag (default false)
 */

export const WorldPropDefs = {
  ironShack: {
    url: "./assets/models/environment/buildings/小屋トタン.fbx",
    type: "fbx",
    scale: 0.01,
    rotationY: 0,
    yOffset: 0,
    castShadow: true,
    receiveShadow: true,
  },
  roadSigns: {
    url: "./assets/models/environment/roads_signs/001.fbx",
    type: "fbx",
    scale: 0.01,
    rotationY: 0,
    yOffset: 0,
    castShadow: true,
    receiveShadow: true,
  },
};
