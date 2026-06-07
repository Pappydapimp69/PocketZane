# Phaser Starter

A minimal [Phaser 3](https://phaser.io/) + TypeScript + [Vite](https://vitejs.dev/) starter template.

It boots straight into a single playable scene with a movable player — no asset
files required (the player texture is generated at runtime), so `npm run dev`
gives you something on screen immediately.

## Getting started

```bash
npm install
npm run dev
```

Then open the URL Vite prints (default http://localhost:5173).

Use the **arrow keys** or **WASD** to move the green square.

## Scripts

| Command           | What it does                                  |
| ----------------- | --------------------------------------------- |
| `npm run dev`     | Start the Vite dev server with hot reload     |
| `npm run build`   | Type-check then build to `dist/`              |
| `npm run preview` | Preview the production build locally          |

## Project structure

```
.
├── index.html              # Entry HTML, mounts the game into #game
├── src
│   ├── main.ts             # Creates the Phaser.Game instance
│   ├── config.ts           # Game config (size, scale, physics, scene list)
│   └── scenes
│       └── MainScene.ts    # The starter scene — replace/extend this
├── public/                 # Static assets served as-is (put images/audio here)
├── tsconfig.json
└── vite.config.ts
```

## Where to go next

- **Add assets:** drop images/audio into `public/` and load them in
  `MainScene.preload()` with `this.load.image(...)`, `this.load.audio(...)`, etc.
- **Add scenes:** create new files in `src/scenes/`, then add them to the
  `scene` array in `src/config.ts`. Switch between them with
  `this.scene.start("SceneKey")`.
- **Enable gravity:** set `physics.arcade.gravity.y` in `src/config.ts` for a
  platformer feel.
