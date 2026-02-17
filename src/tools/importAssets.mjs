#!/usr/bin/env node
/**
 * importAssets.mjs — scans /allfilestomove/, copies (or moves) files into the
 * canonical asset taxonomy under /assets/, and merges entries into
 * /src/engine/registry/assets.manifest.json.
 *
 * Usage:
 *   node src/tools/importAssets.mjs            # copy (default)
 *   node src/tools/importAssets.mjs --move     # move files out of staging
 *   node src/tools/importAssets.mjs --dry-run  # preview only, no disk changes
 */

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const ROOT = path.resolve(import.meta.dirname, "..", "..");
const STAGING = path.join(ROOT, "allfilestomove");
const ASSETS = path.join(ROOT, "assets");
const MANIFEST_PATH = path.join(ROOT, "src", "engine", "registry", "assets.manifest.json");
const REPORT_PATH = path.join(ROOT, "import_report.md");

const ARGS = process.argv.slice(2);
const FLAG_MOVE = ARGS.includes("--move");
const FLAG_DRY = ARGS.includes("--dry-run");

// Supported extensions by category
const EXT_MODELS = new Set(["glb", "gltf", "fbx", "obj"]);
const EXT_TEXTURES = new Set(["png", "jpg", "jpeg", "webp"]);
const EXT_AUDIO = new Set(["wav", "mp3", "ogg"]);
const EXT_DATA = new Set(["json"]);

// Keyword → sub-folder mapping
const KEYWORD_RULES = [
  // Models & textures sub-folders
  { keywords: ["weapon", "gun", "rifle", "pistol", "katana", "sword", "melee", "firearm"], sub: "weapons" },
  { keywords: ["character", "npc", "companion", "player"], sub: "characters" },
  { keywords: ["ui", "hud", "icon"], sub: "ui" },
  // Audio sub-folders
  { keywords: ["ambient", "wind", "rain", "nature"], sub: "ambient" },
  { keywords: ["music", "soundtrack", "ost"], sub: "music" },
  // Maps sub-folders
  { keywords: ["heightmap"], sub: "heightmaps" },
  { keywords: ["minimap"], sub: "minimaps" },
  { keywords: ["poi"], sub: "poi" },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Lowercase file extension without the dot. */
function ext(filePath) {
  return path.extname(filePath).slice(1).toLowerCase();
}

/** Sanitise a string into a stable, filename-safe key. */
function sanitize(str) {
  return str
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")  // strip diacritics
    .replace(/[^\w.]+/g, "_")         // non-word chars → underscore
    .replace(/_+/g, "_")              // collapse runs
    .replace(/^_|_$/g, "")            // trim leading/trailing _
    .toLowerCase();
}

/** Deterministic short hash of a file's content (first 8 hex chars of SHA-256). */
function fileHash(absPath) {
  const buf = fs.readFileSync(absPath);
  return crypto.createHash("sha256").update(buf).digest("hex").slice(0, 8);
}

/** Recursively list all files under dir. */
function walk(dir) {
  const results = [];
  if (!fs.existsSync(dir)) return results;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...walk(full));
    } else if (entry.isFile() && !entry.name.startsWith(".")) {
      results.push(full);
    }
  }
  return results;
}

/** Detect the asset category from the extension. */
function classify(extension) {
  if (EXT_MODELS.has(extension)) return "models";
  if (EXT_TEXTURES.has(extension)) return "textures";
  if (EXT_AUDIO.has(extension)) return "audio";
  if (EXT_DATA.has(extension)) return "data";
  return null;
}

/**
 * Infer a sub-folder from the file's path segments and name.
 * Returns the keyword-based sub-folder or a sensible default:
 *   models  → "props"
 *   textures → "props"
 *   audio   → "sfx"
 *   data    → "poi"  (JSON files land in assets/maps/poi)
 */
function inferSub(category, relParts, baseName) {
  const haystack = [...relParts, baseName].join(" ").toLowerCase();

  for (const rule of KEYWORD_RULES) {
    if (rule.keywords.some((kw) => haystack.includes(kw))) {
      return rule.sub;
    }
  }

  // Defaults when no keyword matched
  switch (category) {
    case "models":   return "props";
    case "textures": return "props";
    case "audio":    return "sfx";
    case "data":     return "poi";  // .json defaults to maps/poi
    default:         return "";
  }
}

/** Build the destination directory path under /assets/ */
function destDir(category, sub) {
  if (category === "data") {
    return path.join(ASSETS, "maps", sub);
  }
  if (category === "audio") {
    return path.join(ASSETS, "audio", sub);
  }
  // models / textures go into their top-level + sub
  return path.join(ASSETS, category, sub);
}

/**
 * Build a manifest key from the staging relative path parts and base name.
 * Includes the parent folder to avoid collisions between packs.
 */
function manifestKey(relParts, baseName) {
  const parts = [...relParts.filter(Boolean), baseName];
  return sanitize(parts.join("_"));
}

/** Read or create the manifest. */
function loadManifest() {
  if (fs.existsSync(MANIFEST_PATH)) {
    return JSON.parse(fs.readFileSync(MANIFEST_PATH, "utf-8"));
  }
  return { version: 1, generatedAt: "", sources: ["allfilestomove"], models: {}, textures: {}, audio: {}, data: {} };
}

function saveManifest(manifest) {
  manifest.generatedAt = new Date().toISOString();
  fs.mkdirSync(path.dirname(MANIFEST_PATH), { recursive: true });
  fs.writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2) + "\n");
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function run() {
  console.log(`\n📦 importAssets — staging: ${STAGING}`);
  console.log(`   mode: ${FLAG_DRY ? "DRY-RUN" : FLAG_MOVE ? "MOVE" : "COPY"}\n`);

  const files = walk(STAGING);
  if (files.length === 0) {
    console.log("   Nothing to import.\n");
    return;
  }

  const manifest = loadManifest();
  const report = {
    copied: [],
    skipped: [],
    collisions: [],
    manifestAdded: [],
    manifestSkipped: [],
  };

  // Build a set of existing manifest URLs for quick collision check.
  const existingUrls = new Set();
  for (const cat of ["models", "textures", "audio", "data"]) {
    if (manifest[cat]) {
      for (const entry of Object.values(manifest[cat])) {
        existingUrls.add(entry.url);
      }
    }
  }

  for (const absFile of files) {
    const extension = ext(absFile);
    const category = classify(extension);
    if (!category) {
      report.skipped.push({ file: path.relative(ROOT, absFile), reason: "unsupported extension" });
      continue;
    }

    // Relative path parts from staging root (excluding filename).
    const rel = path.relative(STAGING, absFile);
    const relParts = path.dirname(rel).split(path.sep).filter((p) => p !== ".");
    const baseName = sanitize(path.basename(absFile, path.extname(absFile)));

    const sub = inferSub(category, relParts, baseName);
    const dest = destDir(category, sub);
    const destName = sanitize(path.basename(absFile, path.extname(absFile))) + "." + extension;
    let finalDest = path.join(dest, destName);

    // --- Collision handling ---
    // If a file with the same name already exists, check content.
    if (fs.existsSync(finalDest)) {
      const srcHash = fileHash(absFile);
      const dstHash = fileHash(finalDest);
      if (srcHash === dstHash) {
        // Identical file — skip copy, but still ensure manifest entry.
        report.skipped.push({ file: rel, reason: "identical file already at destination" });
      } else {
        // Different content — suffix with hash for stability across runs.
        const collisionName = `${baseName}_${fileHash(absFile)}.${extension}`;
        finalDest = path.join(dest, collisionName);
        report.collisions.push({ file: rel, resolved: path.relative(ROOT, finalDest) });
      }
    }

    // --- Copy / Move ---
    if (!FLAG_DRY && !fs.existsSync(finalDest)) {
      fs.mkdirSync(dest, { recursive: true });
      if (FLAG_MOVE) {
        fs.renameSync(absFile, finalDest);
      } else {
        fs.copyFileSync(absFile, finalDest);
      }
      report.copied.push({ from: rel, to: path.relative(ROOT, finalDest) });
    } else if (!fs.existsSync(finalDest)) {
      // dry-run
      report.copied.push({ from: rel, to: path.relative(ROOT, finalDest), dry: true });
    }

    // --- Manifest entry ---
    const manifestCat = category === "data" ? "data" : category;
    if (!manifest[manifestCat]) manifest[manifestCat] = {};

    const url = path.relative(ROOT, finalDest).split(path.sep).join("/");
    let key = manifestKey(relParts, baseName);

    // Idempotent: if key exists with same URL → skip.
    if (manifest[manifestCat][key] && manifest[manifestCat][key].url === url) {
      report.manifestSkipped.push({ key, url });
      continue;
    }

    // If key exists with different URL → suffix with _v2, _v3, etc.
    if (manifest[manifestCat][key]) {
      let n = 2;
      while (manifest[manifestCat][`${key}_v${n}`]) n++;
      key = `${key}_v${n}`;
    }

    const entry = { url };
    if (category === "models") {
      entry.type = extension;
      entry.tags = [sub];
    }
    if (category === "textures") {
      entry.colorSpace = "sRGB";
    }

    manifest[manifestCat][key] = entry;
    report.manifestAdded.push({ key, url });
  }

  // --- Save manifest ---
  if (!FLAG_DRY) {
    saveManifest(manifest);
  }

  // --- Write report ---
  const reportMd = buildReport(report);
  if (!FLAG_DRY) {
    fs.writeFileSync(REPORT_PATH, reportMd);
  }
  console.log(reportMd);
  console.log(`\n✅ Done. Manifest: ${MANIFEST_PATH}\n`);
}

function buildReport(report) {
  const lines = [`# Import Report`, ``, `Generated: ${new Date().toISOString()}`, ``];

  lines.push(`## Copied / Moved (${report.copied.length})`);
  if (report.copied.length === 0) lines.push("_none_");
  for (const c of report.copied) {
    lines.push(`- \`${c.from}\` → \`${c.to}\`${c.dry ? " *(dry-run)*" : ""}`);
  }

  lines.push("", `## Skipped (${report.skipped.length})`);
  if (report.skipped.length === 0) lines.push("_none_");
  for (const s of report.skipped) {
    lines.push(`- \`${s.file}\` — ${s.reason}`);
  }

  lines.push("", `## Collisions Resolved (${report.collisions.length})`);
  if (report.collisions.length === 0) lines.push("_none_");
  for (const c of report.collisions) {
    lines.push(`- \`${c.file}\` → \`${c.resolved}\``);
  }

  lines.push("", `## Manifest Entries Added (${report.manifestAdded.length})`);
  if (report.manifestAdded.length === 0) lines.push("_none_");
  for (const m of report.manifestAdded) {
    lines.push(`- **${m.key}** → \`${m.url}\``);
  }

  lines.push("", `## Manifest Entries Skipped (${report.manifestSkipped.length})`);
  if (report.manifestSkipped.length === 0) lines.push("_none_");
  for (const m of report.manifestSkipped) {
    lines.push(`- **${m.key}** — already at \`${m.url}\``);
  }

  lines.push("");
  return lines.join("\n");
}

run();
