import type { ReferenceElement } from '@floating-ui/dom';
import type { Attachment } from 'svelte/attachments';
import { observePopoverPosition } from './popover-position';

/**
 * Reactive positioning and lifecycle for a floating surface.
 *
 * Feature code owns what opens the surface and what the surface means. This
 * attachment only owns the reusable DOM concern: keeping a portal positioned
 * beside its current anchor and cleaning that work up with the element.
 */
export class PopoverAttachment {
	visible = $state(false);
	anchor = $state.raw<ReferenceElement>();

	readonly attachment: Attachment<HTMLElement> = (element) => {
		$effect(() => {
			const anchor = this.anchor;
			if (!this.visible || !anchor) return;

			return observePopoverPosition(anchor, element);
		});
	};

	open(anchor: ReferenceElement) {
		this.anchor = anchor;
		this.visible = true;
	}

	close() {
		this.visible = false;
		this.anchor = undefined;
	}
}
