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
    // Japanese Road Signs — FBX models by Seaeees (free for commercial use)
    road_sign_stop: { path: "models/environment/roads_signs/001.fbx", label: "Stop Sign (止まれ)" },
    road_sign_slow_down: { path: "models/environment/roads_signs/002.fbx", label: "Slow Down (徐行)" },
    road_sign_no_entry: { path: "models/environment/roads_signs/003.fbx", label: "No Entry (進入禁止)" },
    road_sign_no_passing: { path: "models/environment/roads_signs/004.fbx", label: "No Passing (追越禁止)" },
    road_sign_no_parking: { path: "models/environment/roads_signs/005.fbx", label: "No Parking (駐車禁止)" },
    road_sign_no_stopping: { path: "models/environment/roads_signs/006.fbx", label: "No Stopping (駐停車禁止)" },
    road_sign_one_way: { path: "models/environment/roads_signs/007.fbx", label: "One Way (一方通行)" },
    road_sign_pedestrian_crossing: { path: "models/environment/roads_signs/008.fbx", label: "Pedestrian Crossing" },
    road_sign_caution: { path: "models/environment/roads_signs/009.fbx", label: "Caution (注意)" },
    road_sign_curve_right: { path: "models/environment/roads_signs/010.fbx", label: "Curve Right" },
    road_sign_curve_left: { path: "models/environment/roads_signs/011.fbx", label: "Curve Left" },
    road_sign_intersection: { path: "models/environment/roads_signs/012.fbx", label: "Intersection Ahead" },
    road_sign_railroad: { path: "models/environment/roads_signs/013.fbx", label: "Railroad Crossing" },
    road_sign_school_zone: { path: "models/environment/roads_signs/014.fbx", label: "School Zone" },
    road_sign_slippery: { path: "models/environment/roads_signs/015.fbx", label: "Slippery Road" },
    road_sign_falling_rocks: { path: "models/environment/roads_signs/016.fbx", label: "Falling Rocks" },
    road_sign_road_works: { path: "models/environment/roads_signs/017.fbx", label: "Road Works" },
    road_sign_two_way: { path: "models/environment/roads_signs/018.fbx", label: "Two Way Traffic" },
    road_sign_narrow_road: { path: "models/environment/roads_signs/019.fbx", label: "Narrow Road" },
    road_sign_steep_grade: { path: "models/environment/roads_signs/020.fbx", label: "Steep Grade" },
    road_sign_yield: { path: "models/environment/roads_signs/021.fbx", label: "Yield" },
    road_sign_keep_left: { path: "models/environment/roads_signs/022.fbx", label: "Keep Left" },
    road_sign_keep_right: { path: "models/environment/roads_signs/023.fbx", label: "Keep Right" },
    road_sign_roundabout: { path: "models/environment/roads_signs/024.fbx", label: "Roundabout" },
    road_sign_speed_30: { path: "models/environment/roads_signs/025-30.fbx", label: "Speed Limit 30" },
    road_sign_speed_50: { path: "models/environment/roads_signs/025-50.fbx", label: "Speed Limit 50" },
    road_sign_direction_left: { path: "models/environment/roads_signs/026.fbx", label: "Direction Left" },
    road_sign_direction_right: { path: "models/environment/roads_signs/027.fbx", label: "Direction Right" },
    road_sign_dead_end: { path: "models/environment/roads_signs/028.fbx", label: "Dead End" },
    road_sign_national_route: { path: "models/environment/roads_signs/029.fbx", label: "National Route" },
    road_sign_guide_board: { path: "models/environment/roads_signs/030.fbx", label: "Guide Board" },
    road_sign_mile_marker_a: { path: "models/environment/roads_signs/031-0.fbx", label: "Mile Marker A" },
    road_sign_mile_marker_b: { path: "models/environment/roads_signs/031-1.fbx", label: "Mile Marker B" },
    road_sign_street_name: { path: "models/environment/roads_signs/032.fbx", label: "Street Name Plate" },
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
    // Japanese Road Signs — preview textures
    road_sign_stop_tex: { path: "textures/environment/roads_signs/001.png" },
    road_sign_slow_down_tex: { path: "textures/environment/roads_signs/002.png" },
    road_sign_no_entry_tex: { path: "textures/environment/roads_signs/003.png" },
    road_sign_no_passing_tex: { path: "textures/environment/roads_signs/004.png" },
    road_sign_no_parking_tex: { path: "textures/environment/roads_signs/005.png" },
    road_sign_no_stopping_tex: { path: "textures/environment/roads_signs/006.png" },
    road_sign_one_way_tex: { path: "textures/environment/roads_signs/007.png" },
    road_sign_pedestrian_crossing_tex: { path: "textures/environment/roads_signs/008.png" },
    road_sign_caution_tex: { path: "textures/environment/roads_signs/009.png" },
    road_sign_curve_right_tex: { path: "textures/environment/roads_signs/010.png" },
    road_sign_curve_left_tex: { path: "textures/environment/roads_signs/011.png" },
    road_sign_intersection_tex: { path: "textures/environment/roads_signs/012.png" },
    road_sign_railroad_tex: { path: "textures/environment/roads_signs/013.png" },
    road_sign_school_zone_tex: { path: "textures/environment/roads_signs/014.png" },
    road_sign_slippery_tex: { path: "textures/environment/roads_signs/015.png" },
    road_sign_falling_rocks_tex: { path: "textures/environment/roads_signs/016.png" },
    road_sign_road_works_tex: { path: "textures/environment/roads_signs/017.png" },
    road_sign_two_way_tex: { path: "textures/environment/roads_signs/018.png" },
    road_sign_narrow_road_tex: { path: "textures/environment/roads_signs/019.png" },
    road_sign_steep_grade_tex: { path: "textures/environment/roads_signs/020.png" },
    road_sign_yield_tex: { path: "textures/environment/roads_signs/021.png" },
    road_sign_keep_left_tex: { path: "textures/environment/roads_signs/022.png" },
    road_sign_keep_right_tex: { path: "textures/environment/roads_signs/023.png" },
    road_sign_roundabout_tex: { path: "textures/environment/roads_signs/024.png" },
    road_sign_speed_30_tex: { path: "textures/environment/roads_signs/025-30.png" },
    road_sign_direction_left_tex: { path: "textures/environment/roads_signs/026.png" },
    road_sign_direction_right_tex: { path: "textures/environment/roads_signs/027.png" },
    road_sign_dead_end_tex: { path: "textures/environment/roads_signs/028.png" },
    road_sign_national_route_tex: { path: "textures/environment/roads_signs/029.png" },
    road_sign_guide_board_tex: { path: "textures/environment/roads_signs/030.png" },
    road_sign_mile_marker_tex: { path: "textures/environment/roads_signs/031.png" },
    road_sign_street_name_tex: { path: "textures/environment/roads_signs/032.png" },
  },
  audio: {},
};
