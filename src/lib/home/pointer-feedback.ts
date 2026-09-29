import type { ActivePointerEffect } from './pointer-interaction';

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
