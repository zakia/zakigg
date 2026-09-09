import { mount, unmount } from 'svelte';
import type { Ctx } from '@milkdown/kit/ctx';
import { commandsCtx } from '@milkdown/kit/core';
import { TooltipProvider } from '@milkdown/kit/plugin/tooltip';
import {
	TextSelection,
	type EditorState,
	Plugin,
	type PluginView
} from '@milkdown/kit/prose/state';
import type { EditorView } from '@milkdown/kit/prose/view';
import {
	linkSchema,
	toggleEmphasisCommand,
	toggleInlineCodeCommand,
	toggleLinkCommand,
	toggleStrongCommand,
	updateLinkCommand
} from '@milkdown/kit/preset/commonmark';
import { strikethroughSchema, toggleStrikethroughCommand } from '@milkdown/kit/preset/gfm';
import { $prose } from '@milkdown/kit/utils';
import SelectionToolbar from './SelectionToolbar.svelte';
import {
	SelectionToolbarState,
	type SelectionToolbarSnapshot
} from './selection-toolbar-state.svelte';

function hasMark(state: EditorState, markName: string) {
	const mark = state.schema.marks[markName];
	if (!mark) return false;
	const { empty, from, to, $from } = state.selection;
	if (empty) return Boolean(mark.isInSet(state.storedMarks ?? $from.marks()));
	return state.doc.rangeHasMark(from, to, mark);
}

function getLinkHref(ctx: Ctx, state: EditorState) {
	const type = linkSchema.type(ctx);
	const { from, to, $from } = state.selection;
	if (state.selection.empty)
		return type.isInSet(state.storedMarks ?? $from.marks())?.attrs.href ?? '';

	let href = '';
	state.doc.nodesBetween(from, to, (node) => {
		const mark = type.isInSet(node.marks);
		if (mark?.attrs.href) {
			href = String(mark.attrs.href);
			return false;
		}
		return undefined;
	});
	return href;
}

function readToolbarSnapshot(ctx: Ctx, state: EditorState): SelectionToolbarSnapshot {
	return {
		bold: hasMark(state, 'strong'),
		italic: hasMark(state, 'emphasis'),
		strike: hasMark(state, strikethroughSchema.type(ctx).name),
		code: hasMark(state, 'inlineCode'),
		link: hasMark(state, linkSchema.type(ctx).name),
		linkHref: getLinkHref(ctx, state)
	};
}

class SelectionToolbarView implements PluginView {
	readonly #ctx: Ctx;
	readonly #content: HTMLElement;
	readonly #component: ReturnType<typeof mount>;
	readonly #provider: TooltipProvider;
	readonly #state = new SelectionToolbarState();

	constructor(ctx: Ctx, view: EditorView) {
		this.#ctx = ctx;
		const content = document.createElement('div');
		content.className = 'zaki-selection-toolbar';
		Object.assign(content.style, {
			position: 'fixed',
			visibility: 'hidden',
			pointerEvents: 'none',
			zIndex: '40'
		});
		this.#content = content;

		const runMark = (mark: 'bold' | 'italic' | 'strike' | 'code') => {
			const commands = ctx.get(commandsCtx);
			if (mark === 'bold') commands.call(toggleStrongCommand.key);
			if (mark === 'italic') commands.call(toggleEmphasisCommand.key);
			if (mark === 'strike') commands.call(toggleStrikethroughCommand.key);
			if (mark === 'code') commands.call(toggleInlineCodeCommand.key);
			view.focus();
		};

		this.#component = mount(SelectionToolbar, {
			target: content,
			props: {
				viewState: this.#state,
				onToggle: runMark,
				onSetLink: (href: string) => {
					const commands = ctx.get(commandsCtx);
					if (this.#state.link) commands.call(updateLinkCommand.key, { href });
					else commands.call(toggleLinkCommand.key, { href });
					view.focus();
				},
				onRemoveLink: () => {
					ctx.get(commandsCtx).call(toggleLinkCommand.key);
					view.focus();
				}
			}
		});

		this.#provider = new TooltipProvider({
			content,
			root: document.body,
			debounce: 20,
			offset: 10,
			shift: { padding: 10 },
			floatingUIOptions: { strategy: 'fixed' },
			shouldShow: (currentView) => {
				const selection = currentView.state.selection;
				if (!(selection instanceof TextSelection) || selection.empty || !currentView.editable)
					return false;
				const activeElement =
					currentView.dom.getRootNode() instanceof Document
						? document.activeElement
						: (currentView.dom.getRootNode() as ShadowRoot).activeElement;
				return currentView.hasFocus() || content.contains(activeElement);
			}
		});
		this.#provider.onShow = () => {
			content.style.visibility = 'visible';
			content.style.pointerEvents = 'auto';
			this.#state.visible = true;
		};
		this.#provider.onHide = () => {
			content.style.visibility = 'hidden';
			content.style.pointerEvents = 'none';
			this.#state.visible = false;
		};
		this.update(view);
	}

	update = (view: EditorView, prevState?: EditorState) => {
		this.#state.update(readToolbarSnapshot(this.#ctx, view.state));
		this.#provider.update(view, prevState);
	};

	destroy = () => {
		this.#provider.destroy();
		void unmount(this.#component);
		this.#content.remove();
	};
}

export const selectionToolbarFeature = $prose(
	(ctx) =>
		new Plugin({
			view: (view) => new SelectionToolbarView(ctx, view)
		})
);
