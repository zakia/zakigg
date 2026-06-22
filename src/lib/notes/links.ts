import { Extension, InputRule, mergeAttributes } from '@tiptap/core';
import { Link as TiptapLink, isAllowedUri } from '@tiptap/extension-link';
import { Plugin, PluginKey } from '@tiptap/pm/state';

const SCHEME_PATTERN = /^[a-z][a-z0-9+.-]*:/i;
const MARKDOWN_LINK_PATTERN = /\[([^\]\n]+)\]\(([^)\s]+)(?:\s+"[^"]*")?\)$/;

export function normalizeLinkHref(value: string) {
	const href = value.trim();

	if (!href || SCHEME_PATTERN.test(href) || href.startsWith('/') || href.startsWith('#')) {
		return href;
	}

	return `https://${href}`;
}

export function isValidLinkHref(value: string) {
	const href = normalizeLinkHref(value);

	return href.length > 0 && !!isAllowedUri(href);
}

export const MarkdownLinkInput = Extension.create({
	name: 'markdownLinkInput',

	addInputRules() {
		return [
			new InputRule({
				find: MARKDOWN_LINK_PATTERN,
				handler: ({ state, range, match }) => {
					const label = match[1]?.trim();
					const href = normalizeLinkHref(match[2] ?? '');
					const linkType = state.schema.marks.link;

					if (!label || !linkType || !isValidLinkHref(href)) {
						return null;
					}

					state.tr.replaceWith(
						range.from,
						range.to,
						state.schema.text(label, [linkType.create({ href })])
					);
					state.tr.removeStoredMark(linkType);
				}
			})
		];
	},

	addProseMirrorPlugins() {
		const linkType = this.editor.schema.marks.link;

		return [
			new Plugin({
				key: new PluginKey('markdownLinkInputNormalizer'),
				appendTransaction: (transactions, _oldState, newState) => {
					if (!linkType || !transactions.some((transaction) => transaction.docChanged)) {
						return;
					}

					const { selection } = newState;
					const { $from } = selection;

					if ($from.parent.type.spec.code) {
						return;
					}

					const textBefore = $from.parent.textBetween(0, $from.parentOffset);
					const match = MARKDOWN_LINK_PATTERN.exec(textBefore);

					if (!match) {
						return;
					}

					const label = match[1]?.trim();
					const href = normalizeLinkHref(match[2] ?? '');

					if (!label || !isValidLinkHref(href)) {
						return;
					}

					const from = $from.pos - match[0].length;
					const to = $from.pos;

					return newState.tr
						.replaceWith(from, to, newState.schema.text(label, [linkType.create({ href })]))
						.setMeta('preventAutolink', true);
				}
			})
		];
	}
});

export const EditorLink = TiptapLink.extend({
	renderHTML({ HTMLAttributes }) {
		return [
			'a',
			mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, {
				'data-href': HTMLAttributes.href,
				href: null,
				role: 'link',
				target: null
			}),
			0
		];
	}
});
