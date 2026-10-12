# Blue5GD Portfolio

Micah Winesberry's site: a classic portfolio, plus a small platformer at `/play`. The live site is served from `https://blue5gd.github.io/Portfolio/`, so every local URL also starts with `/Portfolio/`.

## Run it

```sh
npm install
npm run dev
```

Open `http://localhost:4321/Portfolio/`.

`npm run build` writes the site into `dist/`. `npm run preview` serves that build the same way GitHub Pages will, still under `/Portfolio/`.

Pushing to `master` deploys the live site. Don't push unless you mean to publish.

## Edit the words

All of the text lives in `src/data/`. Classic mode and the game both read those files. Change a fact there and both update. Lists are newest first, except Featured, which stays in the order already in `src/data/featured.ts`.

## Edit the levels

`/play` opens a level select. Clearing or skipping a level unlocks the next one. That progress is saved in the browser under the key `b5gd:progress`. The mute button is saved under `b5gd:muted`. The volume slider is saved under `b5gd:volume`.

First Level, Lost World, and Mystic Mountains, in `src/game/levels.ts`, are the courses you can play. The other three cards are listed there too, without maps yet. Each string in `rows` is one row of the map. Row 0 is the top. Every row in a level must be the same length.

```text
. empty     # block      ~ ice        = one-way platform
^ v < >     spikes (floor, ceiling, left, right)
P start     C checkpoint   I info block   J jump pad   O end portal
! falling spike     x crumble
```

A `!` hangs until the cube enters that column, then it falls. It stays dangerous where it lands until you respawn. An `x` is solid until you have stood on it for a moment. It cracks, then falls. The hole under it is what hurts you.

A moving platform is not a letter in the map. It is listed under `movers`. It is a single solid tile that goes out and comes back. Standing on it carries the cube. When the cube respawns, the platform snaps back to where it started. Mystic Mountains has one.

An `I` tile opens a panel. On First Level those panels are About, then the three Featured items, in that order. On Lost World they are the three projects, newest first. On Mystic Mountains they are Science Olympiad, Mu Alpha Theta, Chess, and then Service. The words come from `src/data`. The game does not keep a second copy.

Warmup is still in `src/game/levels.ts`, but it is not on the level select. It is the old practice map (ice, jump pads, one-way platforms, wall spikes). Falling spikes and crumble blocks are used in Lost World.

## Music

Each level plays one looping song from `public/audio/`. The file name, artist, and source link for each song are on its course in `src/game/levels.ts`, and the "Music credits" button on the level select lists them. `src/game/audio.ts` plays them: the song keeps going when you crash, when an info panel opens, and while the level-clear panel is up. It pauses if you open the pause menu, and it stops when you leave the level. The Volume slider on the level select and in the game sets how loud it is. If a file is missing, that level runs silently.

The original downloads sit in `docs/plan-assets/` and are ignored by git, so only the renamed copies in `public/audio/` get committed.

You are responsible for getting permission, or confirming each artist's usage terms, before deploying these songs on the public site.
