import type { ActivePointerEffect, ClickMode, PointerState } from './pointer-interaction';

/** One soft glow whose brightness builds during a hold. */
export function drawPointerFeedback(
	ctx: CanvasRenderingContext2D,
	effect: ActivePointerEffect | null,
	hue: string
) {
	if (effect?.kind !== 'star') return;

	const { x, y, visualCoreRadius, heldForSeconds } = effect;
	const radius = visualCoreRadius * 1.6 + 10;
	const brightness = Math.min(0.18 + heldForSeconds * 0.45, 1);
	ctx.save();
	ctx.globalAlpha *= brightness;
	const glow = ctx.createRadialGradient(x, y, 0, x, y, radius);
	for (let step = 0; step <= 8; step++) {
		const t = step / 8;
		const opacity = 0.82 * (1 - t * t) ** 3;
		const lightness = 54 + 18 * t;
		const chroma = 0.19 - 0.03 * t;
		glow.addColorStop(t, `oklch(${lightness}% ${chroma} ${hue} / ${opacity})`);
	}
	ctx.fillStyle = glow;
	ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2);
	ctx.restore();
}

/** Draws a brush or eraser size preview ring when Draw or Erase click mode is active. */
export function drawToolCursor(
	ctx: CanvasRenderingContext2D,
	pointer: PointerState,
	mode: ClickMode,
	strokeWidth: number,
	eraserRadius: number,
	hue: string,
	shiftKey = false
) {
	if (pointer.phase === 'inactive') return;
	if (mode !== 'draw' && mode !== 'erase') return;

	const { x, y } = pointer;
	ctx.save();
	if (mode === 'draw') {
		const r = Math.max(2, strokeWidth * 0.5);
		ctx.beginPath();
		ctx.arc(x, y, r, 0, Math.PI * 2);
		ctx.strokeStyle = `oklch(75% 0.18 ${hue} / 0.55)`;
		ctx.lineWidth = 1.25;
		ctx.stroke();
	} else {
		const r = Math.max(3, eraserRadius);
		ctx.beginPath();
		ctx.arc(x, y, r, 0, Math.PI * 2);
		if (shiftKey) {
			ctx.setLineDash([4, 3]);
			ctx.fillStyle = `oklch(70% 0.18 ${hue} / 0.12)`;
			ctx.fill();
			ctx.strokeStyle = `oklch(75% 0.18 ${hue} / 0.85)`;
			ctx.lineWidth = 1.6;
		} else {
			ctx.fillStyle = `oklch(75% 0.18 ${hue} / 0.06)`;
			ctx.fill();
			ctx.strokeStyle = `oklch(75% 0.18 ${hue} / 0.55)`;
			ctx.lineWidth = 1.25;
		}
		ctx.stroke();
	}
	ctx.restore();
}
