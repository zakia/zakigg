import { sanitizeLinkHref } from '@milkdown/kit/preset/commonmark';
import type { Mark } from '@milkdown/kit/prose/model';
import { TextSelection, type EditorState } from '@milkdown/kit/prose/state';
import type { EditorView } from '@milkdown/kit/prose/view';
import type { LinkKind, LinkTarget } from './link-popover-state.svelte';

export type LinkDraft = {
	destination: string;
	label: string;
};

function markName(kind: LinkKind) {
	return kind === 'wiki' ? 'wikiLink' : 'link';
}

function linkMarkAt(state: EditorState, position: number, kind: LinkKind) {
	const type = state.schema.marks[markName(kind)];
	if (!type) return;
	const positions = [position, Math.min(position + 1, state.doc.content.size)];
	for (const candidate of positions) {
		const mark = state.doc
			.resolve(candidate)
			.marks()
			.find((current) => current.type === type);
		if (mark) return mark;
	}
}

function rangeForMark(state: EditorState, position: number, mark: Mark) {
	const $position = state.doc.resolve(position);
	const parentStart = $position.start();
	const children: { from: number; to: number; hasMark: boolean }[] = [];
	$position.parent.forEach((node, offset) => {
		children.push({
			from: parentStart + offset,
			to: parentStart + offset + node.nodeSize,
			hasMark: Boolean(mark.isInSet(node.marks))
		});
	});
	const index = children.findIndex(
		(child) => child.hasMark && position >= child.from && position <= child.to
	);
	if (index < 0) return;
	let first = index;
	let last = index;
	while (first > 0 && children[first - 1]?.hasMark) first -= 1;
	while (last < children.length - 1 && children[last + 1]?.hasMark) last += 1;
	return { from: children[first].from, to: children[last].to };
}

export function targetFromAnchor(
	view: EditorView,
	anchor: HTMLAnchorElement
): LinkTarget | undefined {
	const kind: LinkKind = anchor.hasAttribute('data-wiki-link') ? 'wiki' : 'link';
	let from: number;
	let to: number;
	try {
		from = view.posAtDOM(anchor, 0);
		to = view.posAtDOM(anchor, anchor.childNodes.length);
	} catch {
		return;
	}
	const mark = linkMarkAt(view.state, from, kind);
	if (to <= from || !mark) return;

	const rawHref = anchor.getAttribute('href') ?? '';
	const destination =
		kind === 'wiki' ? (anchor.dataset.wikiLink ?? '') : sanitizeLinkHref(rawHref) || rawHref;
	return {
		kind,
		view,
		from,
		to,
		destination,
		href: sanitizeLinkHref(rawHref) || rawHref,
		label: anchor.textContent ?? '',
		title: kind === 'link' ? (mark.attrs.title as string | null | undefined) : undefined,
		anchor
	};
}

export function targetFromSelection(view: EditorView): LinkTarget | undefined {
	const { from, to, empty } = view.state.selection;
	if (empty || from === to) return;
	const label = view.state.doc.textBetween(from, to, '', '\ufffc');
	if (!label) return;

	const link = linkMarkAt(view.state, from, 'link');
	const wiki = linkMarkAt(view.state, from, 'wiki');
	if (wiki) {
		const range = rangeForMark(view.state, from, wiki) ?? { from, to };
		const destination = String(wiki.attrs.target ?? '');
		return {
			kind: 'wiki',
			view,
			...range,
			destination,
			href: destination,
			label: view.state.doc.textBetween(range.from, range.to, '', '\ufffc')
		};
	}
	const range = link ? (rangeForMark(view.state, from, link) ?? { from, to }) : { from, to };
	const destination = link ? String(link.attrs.href ?? '') : '';
	return {
		kind: 'link',
		view,
		...range,
		destination,
		href: destination,
		label: link ? view.state.doc.textBetween(range.from, range.to, '', '\ufffc') : label,
		title: link?.attrs.title as string | null | undefined
	};
}

export function applyLinkDraft(target: LinkTarget, draft: LinkDraft) {
	const { view, kind, from, to } = target;
	const destination =
		kind === 'wiki' ? draft.destination.trim() : sanitizeLinkHref(draft.destination);
	const label = draft.label.trim();
	if (!destination) return { ok: false as const, error: 'Enter a valid page or URL.' };
	if (!label) return { ok: false as const, error: 'Enter link text.' };

	const type = view.state.schema.marks[markName(kind)];
	if (!type) return { ok: false as const, error: 'This link type is unavailable.' };
	const markPosition = Math.min(from + 1, view.state.doc.content.size);
	const preservedMarks = view.state.doc
		.resolve(markPosition)
		.marks()
		.filter((mark) => mark.type.name !== 'link' && mark.type.name !== 'wikiLink');
	const attrs =
		kind === 'wiki' ? { target: destination } : { href: destination, title: target.title ?? null };
	const replacement = view.state.schema.text(label, [...preservedMarks, type.create(attrs)]);
	const tr = view.state.tr.replaceWith(from, to, replacement);
	tr.setSelection(TextSelection.create(tr.doc, from + label.length));
	view.dispatch(tr.scrollIntoView());
	return { ok: true as const };
}

export function removeLink(target: LinkTarget) {
	const type = target.view.state.schema.marks[markName(target.kind)];
	if (!type) return;
	const tr = target.view.state.tr.removeMark(target.from, target.to, type);
	tr.setSelection(TextSelection.create(tr.doc, target.from, target.to));
	target.view.dispatch(tr.scrollIntoView());
}

export function openLink(target: LinkTarget) {
	const href =
		target.kind === 'wiki' ? target.anchor?.getAttribute('href') || target.href : target.href;
	const safeHref = sanitizeLinkHref(href);
	if (!safeHref) return;

	if (/^(?:https?:)?\/\//i.test(safeHref) || /^(?:mailto|tel):/i.test(safeHref)) {
		window.open(safeHref, '_blank', 'noopener,noreferrer');
		return;
	}
	window.location.assign(safeHref);
}
