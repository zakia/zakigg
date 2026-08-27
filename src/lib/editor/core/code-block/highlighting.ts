import type { Node as ProseMirrorNode } from '@tiptap/pm/model';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';
import { CODE_BLOCK_CLASS_NAMES, normalizeLanguage } from './config';

type HighlightState = {
	decorations: DecorationSet;
	signature: string;
};

const HIGHLIGHT_PLUGIN_KEY = new PluginKey<HighlightState>('codeBlockHighlight');

function createDocSignature(doc: ProseMirrorNode) {
	const blocks: string[] = [];

	doc.descendants((node, position) => {
		if (node.type.name !== 'codeBlock') return;

		blocks.push(
			`${position}:${normalizeLanguage(node.attrs.language)}:${node.textContent.length}:${node.textContent}`
		);
	});

	return blocks.join('\n---\n');
}

async function highlightDoc(doc: ProseMirrorNode) {
	const { tokenizeCode, tokenStyle } = await import('./highlighter');
	const decorations: Decoration[] = [];
	const codeBlocks: Array<{ node: ProseMirrorNode; position: number }> = [];

	doc.descendants((node, position) => {
		if (node.type.name !== 'codeBlock' || !node.textContent) return;
		codeBlocks.push({ node, position });
	});

	for (const { node, position } of codeBlocks) {
		try {
			const tokens = await tokenizeCode(node.textContent, node.attrs.language);

			for (const token of tokens.flat()) {
				if (!token.content) continue;

				const from = position + 1 + token.offset;
				const to = from + token.content.length;
				const style = tokenStyle(token);

				if (from < to && style) {
					decorations.push(
						Decoration.inline(from, to, { class: CODE_BLOCK_CLASS_NAMES.token, style })
					);
				}
			}
		} catch {
			// Unknown languages fall back to plain text while keeping the editor usable.
		}
	}

	return DecorationSet.create(doc, decorations);
}

export function createCodeBlockHighlightPlugin() {
	return new Plugin<HighlightState>({
		key: HIGHLIGHT_PLUGIN_KEY,

		state: {
			init: (_config, state) => ({
				decorations: DecorationSet.empty,
				signature: createDocSignature(state.doc)
			}),

			apply(transaction, pluginState, _oldState, newState) {
				const meta = transaction.getMeta(HIGHLIGHT_PLUGIN_KEY) as HighlightState | undefined;

				if (meta?.signature === createDocSignature(newState.doc)) {
					return meta;
				}

				if (!transaction.docChanged) {
					return pluginState;
				}

				return {
					decorations: pluginState.decorations.map(transaction.mapping, transaction.doc),
					signature: createDocSignature(transaction.doc)
				};
			}
		},

		props: {
			decorations(state) {
				return HIGHLIGHT_PLUGIN_KEY.getState(state)?.decorations ?? null;
			}
		},

		view(view) {
			let lastSignature = '';
			let request = 0;

			const scheduleHighlight = () => {
				const signature = createDocSignature(view.state.doc);

				if (signature === lastSignature) return;

				lastSignature = signature;
				request += 1;

				const currentRequest = request;

				void highlightDoc(view.state.doc).then((decorations) => {
					if (currentRequest !== request || signature !== createDocSignature(view.state.doc)) {
						return;
					}

					view.dispatch(view.state.tr.setMeta(HIGHLIGHT_PLUGIN_KEY, { decorations, signature }));
				});
			};

			scheduleHighlight();

			return {
				update: scheduleHighlight,
				destroy() {
					request += 1;
				}
			};
		}
	});
}
