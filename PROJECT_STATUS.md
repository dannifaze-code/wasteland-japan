# Wasteland Japan — Project Status

This file tracks what has been added to the game so that future development has a clear reference of where the project stands.

## Engine & Stack
- **Three.js** v0.159.0 via CDN (ES6 modules)
- **Pure browser** — no build tools, no bundler, no Node.js required
- Single entry: `index.html` → `src/main.js`

## Core Systems
- [x] First-person and third-person camera (toggle with C)
- [x] Player movement: WASD, sprint (Shift), crouch (Ctrl), jump (Space)
- [x] Pointer lock mouse look with configurable sensitivity
- [x] Three weapon types: Pistol, Rifle, Shotgun (keys 1/2/3)
- [x] Reload mechanic (R key) with skill-based speed modifiers
- [x] Weapon mods: Scope (reduces spread), Extended Mag (increases capacity)
- [x] Muzzle flash, shell casing particles, weapon bob/recoil animation
- [x] Health, Stamina, Radiation meters with HUD bars
- [x] Armor system
- [x] XP / Leveling system
- [x] Weight-based inventory
- [x] Save / Load via localStorage (version key: `wasteland_japan_vault811_save_v1`)

## World
- [x] Vault 811 interior (starting area)
- [x] Vault door open animation + exit sequence
- [x] Procedural wasteland tile streaming (90×90 unit tiles)
- [x] Three biomes: City (0), Forest (1), Industrial (2)
- [x] Biome-based fog density
- [x] Day/night cycle (sun position + lighting + fog color)
- [x] Hemisphere + directional + point lighting

## Enemies
- [x] Crawler — melee attack AI
- [x] Stalker — melee + ranged spit attack AI
- [x] Aggro radius, wander behavior, health bars
- [x] Spit projectile system

## UI / Menus
- [x] Title screen with New Game / Continue / Settings / Credits
- [x] Pause menu (Esc) with Resume / Save / Load / Settings / Quit
- [x] Settings panel: Mouse Sensitivity, Graphics Quality, Master Volume, **FOV Slider** (60–120)
- [x] **Pip-Boy system** (Tab key) — Fallout-style wrist device
  - Smooth camera pan-down animation in first person
  - 3D model on player's left arm (first-person & third-person)
  - Subtle green glow (PointLight, emissive material)
  - HTML overlay with tabs: STAT, INV, SKILLS, CRAFT
  - Scanline overlay for retro CRT feel
  - Pauses gameplay in background
  - I/K/J keys open Pip-Boy directly to respective tab
- [x] Inventory panel (also accessible via Pip-Boy INV tab)
- [x] Skill tree panel (5 skills, upgradable with skill points)
- [x] Crafting panel (6 recipes)
- [x] Toast notification system
- [x] Compass / heading display
- [x] Enemy health bar + name display
- [x] Interact hint (E key)

## Items
- Consumables: Field Stim, Ration Pack, Rad-Away
- Junk/Materials: Scrap Metal, Tattered Cloth, Circuit Board
- Weapons: Pistol, Rifle, Shotgun
- Armor: Tactical Vest, Steel Plating
- Mods: Scope, Extended Mag

## Crafting Recipes
- Field Stim (Scrap + Cloth)
- Ration Pack (Cloth ×2)
- Rad-Away (Scrap + Circuits)
- Tactical Vest (Scrap ×3 + Cloth ×2)
- Scope (Circuits ×2 + Scrap)
- Extended Mag (Scrap ×2 + Circuits)

## Skills
1. Toughness — +15 max HP per level (max 5)
2. Quick Hands — Faster reload (max 3)
3. Scavenger — Better loot (max 3)
4. Iron Sights — Reduced weapon spread (max 3)
5. Mutant Hide — Damage resistance (max 5)

## Audio
- WebAudio procedural synthesis (no audio files)
- Gunfire, reload, hit, hurt, footstep, click SFX
- Ambient drone: vault and wasteland variants
- Master volume control

## Story / Quest
- Intro cutscene (5 chapters, skippable with Enter/Esc)
- Quest log with objective display
- Starting quest: "Leave Vault 811"

## Key Bindings
| Key | Action |
|-----|--------|
| WASD | Move |
| Mouse | Look |
| Tab | Open/close Pip-Boy |
| I | Pip-Boy → Inventory |
| K | Pip-Boy → Skills |
| J | Pip-Boy → Crafting |
| C | Toggle 1st/3rd person camera |
| 1/2/3 | Switch weapon |
| R | Reload |
| E | Interact |
| Shift | Sprint |
| Ctrl | Crouch |
| Space | Jump |
| Esc | Pause / Settings |
