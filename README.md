# Wasteland Japan — Vault 811 (Vertical Slice)

## Run locally (recommended)
Because this project uses ES Modules, you must run it from a local server (not file://).

### Option A: Python
```bash
python -m http.server 8080
```
Then open: http://localhost:8080

### Option B: Node
```bash
npx serve .
```

## Controls
- Click game to lock mouse
- WASD: move
- Mouse: look
- Space: jump
- Shift: sprint
- Ctrl: crouch
- C: toggle 1st/3rd person
- 1/2/3: weapon slots
- R: reload
- E: interact / loot
- I: inventory
- Esc: pause / unlock mouse

## Game flow
Title → New Game → Intro (skippable) → Vault 811 → Exit → Wasteland (streaming tiles, enemies, loot)
