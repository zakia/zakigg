import {
	autoUpdate,
	computePosition,
	flip,
	offset,
	shift,
	type ReferenceElement
} from '@floating-ui/dom';

export function observePopoverPosition(anchor: ReferenceElement, element: HTMLElement) {
	const update = async () => {
		const { x, y } = await computePosition(anchor, element, {
			placement: 'bottom-start',
			strategy: 'fixed',
			middleware: [offset(8), flip({ padding: 10 }), shift({ padding: 10 })]
		});
		element.style.left = `${x}px`;
		element.style.top = `${y}px`;
	};

	return autoUpdate(anchor, element, () => void update());
}
