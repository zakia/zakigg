import type { Attachment } from 'svelte/attachments';

export interface FlipOptions {
	/** Target slot element (or getter) to reparent the node into before measuring the destination box. */
	to?: () => HTMLElement | undefined;
	/** Optional shared key to morph between separate mounting/unmounting elements. */
	key?: string;
	/** Animation duration in milliseconds. Defaults to 650. */
	duration?: number;
	/** CSS easing function. Defaults to 'cubic-bezier(0.22, 1, 0.36, 1)'. */
	easing?: string;
	/** Whether to also FLIP-scale width/height changes. Defaults to false. */
	scale?: boolean;
}

interface StoredRect {
	rect: DOMRect;
	time: number;
}

const sharedRects = new Map<string, StoredRect>();

function prefersReducedMotion(): boolean {
	return (
		typeof window !== 'undefined' &&
		window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
	);
}

/**
 * Animates an element from its previous screen position/size to its new layout box using FLIP
 * (First, Last, Invert, Play) via the Web Animations API on the compositor thread.
 *
 * Usage:
 * - Same element / slot reparenting: `{@attach flip(() => state, { to: () => slotEl })}`
 * - Shared key across `{#if}` branches: `{@attach flip('shared-id')}`
 */
export function flip(
	watchOrKey: (() => unknown) | string,
	options: FlipOptions = {}
): Attachment<HTMLElement> {
	const watch = typeof watchOrKey === 'function' ? watchOrKey : undefined;
	const sharedKey = typeof watchOrKey === 'string' ? watchOrKey : options.key;

	return (node) => {
		const duration = options.duration ?? 650;
		const easing = options.easing ?? 'cubic-bezier(0.22, 1, 0.36, 1)';
		const animateScale = options.scale ?? false;

		let currentAnimation: Animation | null = null;
		let initialized = false;
		let preRect: DOMRect | null = null;
		let lastKnownRect: DOMRect | null = null;

		function playFlip(first: DOMRect, last: DOMRect) {
			const dx = first.left - last.left;
			const dy = first.top - last.top;
			const sx = animateScale && last.width > 0 ? first.width / last.width : 1;
			const sy = animateScale && last.height > 0 ? first.height / last.height : 1;

			const moved = Math.abs(dx) > 0.5 || Math.abs(dy) > 0.5;
			const scaled = animateScale && (Math.abs(sx - 1) > 0.01 || Math.abs(sy - 1) > 0.01);

			if ((!moved && !scaled) || prefersReducedMotion()) return;

			if (animateScale) {
				node.style.transformOrigin = '0 0';
			}

			const fromFrame: Keyframe = { translate: `${dx}px ${dy}px` };
			const toFrame: Keyframe = { translate: '0px 0px' };
			if (scaled) {
				fromFrame.scale = `${sx} ${sy}`;
				toFrame.scale = '1 1';
			}

			currentAnimation = node.animate([fromFrame, toFrame], {
				duration,
				easing
			});
			currentAnimation.onfinish = () => {
				currentAnimation = null;
				if (node.isConnected) {
					lastKnownRect = node.getBoundingClientRect();
				}
			};
		}

		if (watch) {
			$effect.pre(() => {
				watch();
				options.to?.();
				if (initialized && node.isConnected) {
					preRect = node.getBoundingClientRect();
				}
			});
		}

		$effect(() => {
			watch?.();
			const targetSlot = options.to?.();

			if (!initialized) {
				if (targetSlot && node.parentElement !== targetSlot) {
					targetSlot.appendChild(node);
				}
				const initialRect = node.getBoundingClientRect();
				lastKnownRect = initialRect;
				initialized = true;

				if (sharedKey) {
					const previous = sharedRects.get(sharedKey);
					if (previous && performance.now() - previous.time < 250) {
						sharedRects.delete(sharedKey);
						playFlip(previous.rect, initialRect);
					}
				}
				return;
			}

			// Measure live visual rect before reparenting or cancelling in-flight animation
			const first =
				(targetSlot && node.parentElement !== targetSlot && node.isConnected
					? node.getBoundingClientRect()
					: null) ??
				preRect ??
				lastKnownRect;

			preRect = null;

			if (currentAnimation) {
				currentAnimation.cancel();
				currentAnimation = null;
			}

			if (targetSlot && node.parentElement !== targetSlot) {
				targetSlot.appendChild(node);
			}

			const last = node.getBoundingClientRect();
			lastKnownRect = last;

			if (first) {
				playFlip(first, last);
			}
		});

		return () => {
			if (sharedKey) {
				const rect =
					node.isConnected ? node.getBoundingClientRect() : (preRect ?? lastKnownRect);
				if (rect && (rect.width > 0 || rect.height > 0)) {
					sharedRects.set(sharedKey, { rect, time: performance.now() });
				}
			}
			currentAnimation?.cancel();
			currentAnimation = null;
		};
	};
}

