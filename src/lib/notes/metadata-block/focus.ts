export const METADATA_FIELD_SELECTOR = '[data-metadata-field]';
export const METADATA_KEY_SELECTOR = '[data-metadata-key]';
export const METADATA_COLLAPSE_SELECTOR = '[data-metadata-collapse]';

export function getMetadataFieldElements(root: Element) {
	return Array.from(root.querySelectorAll<HTMLElement>(METADATA_FIELD_SELECTOR));
}

// Entering the block lands on the property level (key cells / add button).
// Falls back to value fields (the new-property combobox when no rows exist),
// then to the collapse toggle when the block is collapsed.
export function focusMetadataBlockEdge(dom: unknown, edge: 'first' | 'last') {
	if (!(dom instanceof HTMLElement)) return false;

	const keys = Array.from(dom.querySelectorAll<HTMLElement>(METADATA_KEY_SELECTOR));
	const pool = keys.length ? keys : getMetadataFieldElements(dom);
	const target = edge === 'first' ? pool[0] : pool[pool.length - 1];
	const element = target ?? dom.querySelector<HTMLElement>(METADATA_COLLAPSE_SELECTOR);

	if (!element) return false;

	focusMetadataField(element);

	return true;
}

export function focusMetadataField(element: HTMLElement) {
	element.focus();

	if (element instanceof HTMLInputElement && element.type === 'text') {
		const end = element.value.length;

		element.setSelectionRange(end, end);
	}
}
