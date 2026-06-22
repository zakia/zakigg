import { getMarkRange, posToDOMRect, type Editor, type Range } from '@tiptap/core';
import { isValidLinkHref, normalizeLinkHref } from './links';

export const LINK_POPOVER_DELAY = 900;

export type LinkPopoverState = {
	visible: boolean;
	editing: boolean;
	placement: LinkPopoverPlacement;
	href: string;
	label: string;
	from: number;
	to: number;
	left: number;
	top: number;
	error: string;
};

export type LinkPopoverPlacement = 'above' | 'below';

type WindowWithLinkOpenMemory = Window & {
	__editorLastLinkOpen?: { href: string; at: number };
};

type LinkPopoverStateOptions = {
	editor: Editor;
	range: Range;
	editing?: boolean;
	placement?: LinkPopoverPlacement;
	href?: string;
	label?: string;
	error?: string;
};

export function createHiddenLinkPopover(): LinkPopoverState {
	return {
		visible: false,
		editing: false,
		placement: 'above',
		href: '',
		label: '',
		from: 0,
		to: 0,
		left: 0,
		top: 0,
		error: ''
	};
}

export function createLinkPopoverState({
	editor,
	range,
	editing = false,
	placement = editing ? 'below' : 'above',
	href,
	label,
	error = ''
}: LinkPopoverStateOptions): LinkPopoverState {
	const details = getLinkDetails(editor, range);
	const position = positionLinkPopover(editor, range, placement);

	return {
		visible: true,
		editing,
		placement: position.placement,
		href: href ?? details.href,
		label: label ?? details.label,
		from: range.from,
		to: range.to,
		left: position.left,
		top: position.top,
		error
	};
}

export function getLinkRangeAtPosition(editor: Editor, position: number) {
	const linkType = editor.state.schema.marks.link;
	const docSize = editor.state.doc.content.size;

	if (!linkType || docSize < 1) return;

	const safePosition = Math.min(Math.max(position, 1), docSize);

	return getMarkRange(editor.state.doc.resolve(safePosition), linkType);
}

export function getCurrentLinkRange(editor?: Editor) {
	if (!editor) return;

	const { from, to } = editor.state.selection;
	const positions = [from, Math.max(from - 1, 1), to, Math.max(to - 1, 1)];

	for (const position of positions) {
		const range = getLinkRangeAtPosition(editor, position);

		if (range) return range;
	}
}

export function getLinkDetails(editor: Editor, range: Range) {
	let href = '';

	editor.state.doc.nodesBetween(range.from, range.to, (node) => {
		if (href || !node.isText) return;

		const mark = node.marks.find((item) => item.type.name === 'link');

		if (mark) {
			href = mark.attrs.href ?? '';
			return false;
		}
	});

	return {
		href,
		label: editor.state.doc.textBetween(range.from, range.to, '\n')
	};
}

export function positionLinkPopover(
	editor: Editor,
	range: Range,
	placement: LinkPopoverPlacement = 'above'
) {
	const rect = posToDOMRect(editor.view, range.from, range.to);
	const viewportWidth = window.innerWidth;
	const viewportHeight = window.innerHeight;
	const gap = placement === 'below' ? 2 : 10;
	const estimatedHeight = placement === 'below' ? 152 : 44;
	const spaceAbove = rect.top;
	const spaceBelow = viewportHeight - rect.bottom;
	const resolvedPlacement: LinkPopoverPlacement =
		placement === 'below'
			? spaceBelow < estimatedHeight && spaceAbove > spaceBelow
				? 'above'
				: 'below'
			: spaceAbove < estimatedHeight && spaceBelow > spaceAbove
				? 'below'
				: 'above';

	const expectedWidth =
		resolvedPlacement === 'below'
			? Math.min(480, Math.max(280, viewportWidth - 24))
			: Math.min(352, Math.max(220, viewportWidth - 32));
	const rawLeft = rect.left + rect.width / 2;
	const minLeft = expectedWidth / 2 + 12;
	const maxLeft = viewportWidth - expectedWidth / 2 - 12;
	const left =
		maxLeft > minLeft ? Math.min(Math.max(rawLeft, minLeft), maxLeft) : viewportWidth / 2;

	return {
		placement: resolvedPlacement,
		left,
		top: resolvedPlacement === 'below' ? rect.bottom + gap : rect.top - gap
	};
}

export function openLinkHrefOnce(href: string) {
	if (!isValidLinkHref(href)) return false;

	const url = new URL(normalizeLinkHref(href), window.location.href).href;
	const now = performance.now();
	const globalWindow = window as WindowWithLinkOpenMemory;
	const recentOpen = globalWindow.__editorLastLinkOpen;

	if (!recentOpen || url !== recentOpen.href || now - recentOpen.at > 800) {
		globalWindow.__editorLastLinkOpen = { href: url, at: now };
		window.open(url, '_blank', 'noopener,noreferrer');
	}

	return true;
}
