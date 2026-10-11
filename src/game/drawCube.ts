// Canvas copy of src/assets/cube.svg. Both are drawn on a 100x100 grid
// with the same shapes, so if you change the face, change it in both places.
// `size` is the drawn width in pixels. The collision box is separate and stays upright.

export function drawCube(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  size: number,
  rotation: number,
): void {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(rotation);
  ctx.scale(size / 100, size / 100);
  ctx.translate(-50, -50);
  ctx.lineJoin = "round";
  ctx.lineCap = "round";

  // Soft cyan glow. shadowBlur is not scaled by the transform above, so this
  // stays a small halo in screen pixels instead of a huge blur.
  ctx.shadowColor = "#6fd6ff";
  ctx.shadowBlur = 12;
  ctx.beginPath();
  ctx.roundRect(3, 3, 94, 94, 7);
  ctx.fillStyle = "#ffffff";
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.lineWidth = 6;
  ctx.strokeStyle = "#000000";
  ctx.stroke();

  ctx.fillStyle = "#75bcff";
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(24, 23, 9.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(76, 23, 9.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  mouth(ctx);
  ctx.fillStyle = "#3a5976";
  ctx.fill();

  ctx.save();
  mouth(ctx);
  ctx.clip();
  ctx.fillStyle = "#75bcff";
  ctx.strokeStyle = "#000000";
  ctx.lineWidth = 3;
  tooth(ctx, [18, 42.8, 34, 46, 26, 62]);
  tooth(ctx, [35.5, 46.1, 48.5, 47, 42, 61]);
  tooth(ctx, [51.5, 47, 64.5, 46.1, 58, 61]);
  tooth(ctx, [66, 46, 82, 42.8, 74, 62]);
  ctx.beginPath();
  ctx.ellipse(50, 86, 17, 10, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.restore();

  mouth(ctx);
  ctx.lineWidth = 4.5;
  ctx.strokeStyle = "#000000";
  ctx.stroke();

  ctx.restore();
}

function mouth(ctx: CanvasRenderingContext2D): void {
  ctx.beginPath();
  ctx.moveTo(15, 42);
  ctx.quadraticCurveTo(50, 52, 85, 42);
  ctx.bezierCurveTo(85, 72, 70, 89, 50, 89);
  ctx.bezierCurveTo(30, 89, 15, 72, 15, 42);
  ctx.closePath();
}

function tooth(ctx: CanvasRenderingContext2D, pts: number[]): void {
  ctx.beginPath();
  ctx.moveTo(pts[0], pts[1]);
  ctx.lineTo(pts[2], pts[3]);
  ctx.lineTo(pts[4], pts[5]);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
}
