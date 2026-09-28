import { parseMarkdownAst } from '$lib/editor/document/markdown-ast';
import { wikiLinkHref } from '$lib/editor/document/markdown-renderer';
import { syntaxTree } from '@codemirror/language';
import { Decoration, EditorView, type KeyBinding } from '@codemirror/view';
import type { SyntaxNode } from '@lezer/common';
import { feature } from '../feature';
import { nodes, children, mark, hide } from '../source';
import { Label } from '../Label';

export const preview = feature({
	find: (state) =>
		nodes(state, ['Link']).map((node) => {
			const full = state.doc.sliceString(
				Math.max(0, node.from - 1),
				Math.min(state.doc.length, node.to + 1)
			);
			const wiki = /^\[\[([^\]\n]+)\]\]$/.exec(full);
			const text = state.doc.sliceString(node.from, node.to);
			const callout =
				node.parent?.parent?.name === 'Blockquote'
					? /^\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]$/i.exec(text)
					: null;
			return {
				from: wiki ? node.from - 1 : node.from,
				to: wiki ? node.to + 1 : node.to,
				node,
				wiki,
				callout,
				href: linkHrefFromMarkdown(wiki ? full : text)
			};
		}),
	render(_state, source) {
		if (source.wiki || source.callout) {
			const label = source.wiki
				? source.wiki[1].split('|', 2)[1] || source.wiki[1].split('|', 2)[0]
				: source.callout![1];
			return [
				Decoration.replace({
					widget: new Label(
						label,
						source.wiki ? 'cm-live-link' : 'cm-live-callout-label',
						source.from + 1,
						source.href
					)
				}).range(source.from, source.to)
			];
		}
		const marks = children(source.node).filter((child) => child.name === 'LinkMark');
		return marks.length >= 4
			? [
					...mark(marks[0].to, marks[1].from, 'cm-live-link', source.href),
					...hide(source.from, marks[0].to),
					...hide(marks[1].from, source.to)
				]
			: [];
	},
	edit(_state, source) {
		if (source.wiki || source.callout) return [];
		const marks = children(source.node).filter((child) => child.name === 'LinkMark');
		return marks.length >= 4 ? mark(marks[0].to, marks[1].from, 'cm-live-link', source.href) : [];
	}
});

export const keys: KeyBinding[] = [{ key: 'Mod-Enter', run: openLinkAtCursor }];

export const events = EditorView.domEventHandlers({ mousedown: handleLinkMouseDown });

export const theme = EditorView.baseTheme({
	'.cm-live-link': { color: 'var(--brand)', textDecoration: 'underline' },
	'.cm-live-callout-label': {
		color: 'var(--brand)',
		fontSize: '0.85em',
		fontWeight: '750',
		letterSpacing: '0.04em'
	}
});

function linkAtPosition(view: EditorView, position: number) {
	for (const side of [-1, 1] as const) {
		for (
			let node: SyntaxNode | null = syntaxTree(view.state).resolveInner(position, side);
			node;
			node = node.parent
		) {
			if (node.name !== 'Link') continue;
			const full = view.state.doc.sliceString(
				Math.max(0, node.from - 1),
				Math.min(view.state.doc.length, node.to + 1)
			);
			return (
				linkHrefFromMarkdown(full) ??
				linkHrefFromMarkdown(view.state.doc.sliceString(node.from, node.to))
			);
		}
	}
	return null;
}

function openLink(href: string | null) {
	if (!href) return false;
	window.open(href, '_blank', 'noopener,noreferrer');
	return true;
}

function openLinkAtCursor(view: EditorView) {
	return openLink(linkAtPosition(view, view.state.selection.main.head));
}

function handleLinkMouseDown(event: MouseEvent, view: EditorView) {
	if (event.button !== 0 || (!event.metaKey && !event.ctrlKey)) return false;
	const target = event.target;
	const decoratedHref =
		target instanceof Element
			? target.closest<HTMLElement>('[data-cm-link-href]')?.dataset.cmLinkHref
			: undefined;
	const position = view.posAtCoords({ x: event.clientX, y: event.clientY });
	const href = decoratedHref ?? (position === null ? null : linkAtPosition(view, position));
	if (!openLink(href)) return false;
	event.preventDefault();
	event.stopPropagation();
	return true;
}

function linkHrefFromMarkdown(markdown: string): string | null {
	const wiki = /^\[\[([^\]\n]+)\]\]$/.exec(markdown);
	if (wiki) return safeLinkHref(wikiLinkHref(wiki[1].split('|', 1)[0].trim()));

	try {
		const first = parseMarkdownAst(markdown).children[0];
		const link = first?.type === 'paragraph' ? first.children[0] : null;
		return link?.type === 'link' ? safeLinkHref(link.url) : null;
	} catch {
		return null;
	}
}

function safeLinkHref(raw: string): string | null {
	try {
		const url = new URL(raw, window.location.href);
		return ['http:', 'https:', 'mailto:'].includes(url.protocol) ? url.href : null;
	} catch {
		return null;
	}
}
