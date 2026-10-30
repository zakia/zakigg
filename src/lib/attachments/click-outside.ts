import type { Attachment } from 'svelte/attachments';

export interface ClickOutsideOptions {
	/** Whether the listener is currently active. Defaults to true. */
	enabled?: () => boolean;
	/** Whether pressing Escape should also trigger the callback. Defaults to true. */
	escape?: boolean;
	/** Additional elements or getters to ignore when checking outside clicks. */
	ignore?: () => (Element | null | undefined)[];
}

/**
 * Svelte 5 attachment that calls a callback when clicking outside an element or pressing Escape.
 *
 * Usage:
 * `<div {@attach clickOutside(close, { enabled: () => isOpen })}>...</div>`
 */
export function clickOutside(
	onDismiss: () => void,
	options: ClickOutsideOptions = {}
): Attachment<HTMLElement> {
	return (node) => {
		const handleEscape = options.escape ?? true;

		function onPointerDown(event: PointerEvent) {
			if (options.enabled && !options.enabled()) return;

			const target = event.target as Node | null;
			if (!target || !node.isConnected) return;

			if (node.contains(target)) return;

			if (options.ignore) {
				const ignoredElements = options.ignore();
				for (const el of ignoredElements) {
					if (el?.contains(target)) return;
				}
			}

			onDismiss();
		}

		function onKeyDown(event: KeyboardEvent) {
			if (options.enabled && !options.enabled()) return;
			if (handleEscape && event.key === 'Escape') {
				onDismiss();
			}
		}

		document.addEventListener('pointerdown', onPointerDown);
		document.addEventListener('keydown', onKeyDown);

		return () => {
			document.removeEventListener('pointerdown', onPointerDown);
			document.removeEventListener('keydown', onKeyDown);
		};
	};
}
