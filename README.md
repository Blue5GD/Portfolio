# Blue5GD Portfolio

A classic portfolio, plus a small platformer at `/play`. The live site is `https://blue5gd.github.io/Portfolio/`, so every local URL also starts with `/Portfolio/`.

## Run it

```sh
npm install
npm run dev
```

Open `http://localhost:4321/Portfolio/`.

`npm run build` writes the site into `dist/`. `npm run preview` serves that build the same way GitHub Pages will, still under `/Portfolio/`.

Pushing to `master` deploys the live site on GitHub Pages.

## Edit the words

Text lives in `src/data/`. Classic mode and the game both read those files. Change a fact there and both update. Lists are newest first, except Featured, which stays in the order in `src/data/featured.ts`.

The Hall of Fame on `/play` is the list in `src/data/hallOfFame.ts`. It starts empty. A verified clear is a username, a date, and a YouTube link.

## Edit the levels

`/play` opens a level select. Beating a level with Practice off marks it cleared. Finishing with Practice on marks it practice completed. Skip marks it skipped. Any of those three unlocks the next level. Only a normal clear counts as cleared. That progress is saved in the browser under `b5gd:progress`. Mute is saved under `b5gd:muted`. Volume is saved under `b5gd:volume`.

The game needs a keyboard. On the level select, a phone or a window narrower than 768px hides Play and shows a note that points back to the classic page. If you shrink the window while a level is running, that run pauses until the window is wide enough again.

Practice mode is a button in the corner of a level. Turn it on, then press Z to drop a checkpoint where the cube is, and X to remove the last one you dropped. A crash sends you back to that checkpoint. Turn Practice off and you use the level's own checkpoints again.

All six courses are in `src/game/levels.ts`: First Level, Lost World, Mystic Mountains, Sci-Fi Showdown, Last Hope, and The Final Battle. Each string in `rows` is one row of the map. Row 0 is the top. Every row in a level must be the same length. The comment above each course says what is in it.

```text
. empty     # block      ~ ice        = one-way platform
^ v < >     spikes (floor, ceiling, left, right)
P start     C checkpoint   I info block   J jump pad   O end portal
! falling spike     x crumble     o jump orb
| vertical laser      - horizontal laser
```

A `!` hangs until the cube enters that column, then it falls. It stays dangerous where it lands until you respawn. An `x` is solid until you have stood on it for a moment. It cracks, then falls. The hole under it is what hurts you.

An `o` is a ring. Touching it does nothing. Press jump while the cube overlaps it and it launches you, higher than a normal jump and lower than a pad. Letting go of jump does not change that height. Walk out of the ring and it can launch you again.

`|` and `-` are lasers. A straight run of the same character is one beam. Every beam in a level shares one timer: off for 0.7 seconds, then on for 1.1 seconds. The beam only hurts while it is on. Respawning restarts the timer at the start of the off time.

A moving platform is not a letter in the map. It is listed under `movers`. It is a single solid tile that goes out and comes back. Standing on it carries the cube. When the cube respawns, the platform snaps back to where it started.

An `I` tile opens a panel. The words come from `src/data`. The comment above each course in `src/game/levels.ts` says which panels that level uses.

Last Hope gets darker as you move right. The Final Battle stays dark except for a circle of light around the cube. Its saws are listed under `movers`, the same way platforms are.

Warmup is still in `src/game/levels.ts`, but it is not on the level select. It is the old sandbox map. It is not Practice mode.

## Music

Each level plays one looping song from `public/audio/`. The file name, artist, and source link for each song are on its course in `src/game/levels.ts`, and the "Music credits" button on the level select lists them. `src/game/audio.ts` plays them. The song keeps going through crashes, info panels, the level-clear panel, and when you switch to another browser tab. It pauses if you open the pause menu or the window is too small to keep playing, and it stops when you leave the level. The volume slider sets how loud it is. If a file is missing, that level runs silently.
