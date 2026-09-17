import { mount, unmount } from 'svelte';
import type { Ctx } from '@milkdown/kit/ctx';
import { toggleLinkCommand as toggleLinkTooltipCommand } from '@milkdown/kit/component/link-tooltip';
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
	toggleStrongCommand
} from '@milkdown/kit/preset/commonmark';
import { strikethroughSchema, toggleStrikethroughCommand } from '@milkdown/kit/preset/gfm';
import { $prose } from '@milkdown/kit/utils';
import SelectionToolbar from './SelectionToolbar.svelte';
import {
	SelectionToolbarState,
	type SelectionToolbarSnapshot
} from './selection-toolbar-state.svelte';
import { trimLinkText } from '../link/link-selection';

function hasMark(state: EditorState, markName: string) {
	const mark = state.schema.marks[markName];
	if (!mark) return false;
	const { empty, from, to, $from } = state.selection;
	if (empty) return Boolean(mark.isInSet(state.storedMarks ?? $from.marks()));
	return state.doc.rangeHasMark(from, to, mark);
}

function readToolbarSnapshot(ctx: Ctx, state: EditorState): SelectionToolbarSnapshot {
	return {
		bold: hasMark(state, 'strong'),
		italic: hasMark(state, 'emphasis'),
		strike: hasMark(state, strikethroughSchema.type(ctx).name),
		code: hasMark(state, 'inlineCode'),
		link: hasMark(state, linkSchema.type(ctx).name)
	};
}

/** Keep invisible boundary whitespace out of newly-created Markdown links. */
export function trimLinkSelection(view: EditorView) {
	const { selection } = view.state;
	if (
		!(selection instanceof TextSelection) ||
		selection.empty ||
		!selection.$from.sameParent(selection.$to)
	)
		return true;

	const selectedText = selection.$from.parent.textBetween(
		selection.$from.parentOffset,
		selection.$to.parentOffset,
		'',
		'\ufffc'
	);
	const offsets = trimLinkText(selectedText);
	if (!offsets) return false;
	const from = selection.from + offsets.from;
	const to = selection.from + offsets.to;
	if (from === selection.from && to === selection.to) return true;

	view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, from, to)));
	return true;
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
				onToggleLink: () => {
					if (!this.#state.link && !trimLinkSelection(view)) return;
					ctx.get(commandsCtx).call(toggleLinkTooltipCommand.key);
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
