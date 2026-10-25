// The screen usually paints about 60 times a second, but that number jumps
// around. Physics uses a fixed slice of time instead, so a jump is the same
// height on a fast monitor and a slow one.
//
// Each frame we add the time that passed into a bucket (the accumulator).
// Then we scoop out 1/120 second slices and run physics once per slice.
// Whatever is left in the bucket waits for the next frame.
//
// Drawing is capped near 72 frames a second. A fast monitor still runs the
// same physics, but it does not redraw the flat art twice as often.

const STEP = 1 / 120;
const MAX_STEPS = 8;
const RENDER_INTERVAL = 1000 / 72;

export function startLoop(update: (dt: number) => void, render: () => void): () => void {
  let acc = 0;
  let last = performance.now();
  // Start ready to draw the first frame.
  let renderAcc = RENDER_INTERVAL;
  let raf = 0;
  let running = true;

  function frame(now: number) {
    if (!running) return;
    let elapsed = (now - last) / 1000;
    last = now;
    // A tab left in the background can report a huge gap. Drop it, or the
    // cube would fast-forward through the level when you come back.
    if (elapsed > 0.25) elapsed = 0.25;

    acc += elapsed;
    let steps = 0;
    while (acc >= STEP && steps < MAX_STEPS) {
      update(STEP);
      acc -= STEP;
      steps += 1;
    }
    // If a frame is so long that we hit the cap, throw away the leftover
    // time. The game slows down for a moment instead of falling further behind.
    if (steps >= MAX_STEPS) acc = 0;

    // Physics runs on every animation frame, but drawing can wait. The
    // accumulator keeps the average near 72 fps without dropping a 90Hz
    // screen all the way to 45 fps.
    renderAcc += elapsed * 1000;
    if (renderAcc >= RENDER_INTERVAL) {
      render();
      renderAcc %= RENDER_INTERVAL;
    }
    raf = requestAnimationFrame(frame);
  }

  raf = requestAnimationFrame(frame);
  return () => {
    running = false;
    cancelAnimationFrame(raf);
  };
}
