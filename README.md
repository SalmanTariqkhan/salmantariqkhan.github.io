# Infinite War • Grandmaster Sovereign Multiplayer Edition (v185)

A browser-based 3D MOBA powered by Three.js, procedural textures, procedural meshes, Web Audio speech synthesis, and WebRTC peer-to-peer multiplayer.

## Project Structure

The project has been refactored into a modular architecture for code maintainability:

```text
├── index.html            # Clean HTML UI markup and bootstrap module loader
├── css/
│   └── style.css         # Game styling, HUD themes, responsive layout, animations
└── js/
    ├── optimizer.js      # 1GB RAM & low-power mobile optimizer module
    ├── roster.js         # Hero roster, talent trees & AI difficulty profiles
    ├── multiplayer.js    # Multiplayer engine (WebRTC P2P, room lobby & LAN sync)
    ├── audio.js          # Procedural audio engine, SFX synth & Dota 2 announcer
    ├── textures.js       # Procedural PBR textures & GLSL terrain shaders
    ├── scene.js          # Three.js scene, renderer, camera rig & lighting
    ├── vfx-pipeline.js   # Post-processing EffectComposer, UnrealBloomPass, depth AO, cloud shadows
    ├── shop-catalog.js   # Shop catalog, 16 multi-class artifacts & consumable definitions
    ├── world.js          # 380x380 world-space terrain, river, bridge, procedural forest & shrines
    ├── state.js          # Global entity collections, object pools & floating combat text
    ├── models.js         # Procedural anatomical 3D hero models, sculpted faces, creeps & dragons
    ├── hero-select.js    # 3D Sky-Altar hero selector, showcase rotating rig & talent UI
    ├── neutral-camps.js  # 12 neutral camps, Ancient Sanctums, Roshan & Apex Dragon boss
    ├── abilities.js      # Hero ability execution, VFX projectiles & cast rings
    ├── combat-ai.js      # Combat resolution, tactical AI engine & lane creep waves
    ├── hud.js            # HUD canvas, minimap radar & target unit inspector
    ├── controls.js       # Inventory active items, shop interactions & mouse/touch controls
    └── main.js           # Game loop, camera rig, frustum culling & match lifecycle
```

## Running Locally

Because this project uses native static files and ES module imports for Three.js, you can serve it with any local static HTTP server:

```bash
# Using Python
python3 -m http.server 8000

# Using Node (npx)
npx serve .
```

Then visit `http://localhost:8000` in your web browser.

