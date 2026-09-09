import { mount, unmount } from 'svelte';
import type { Ctx } from '@milkdown/kit/ctx';
import { commandsCtx } from '@milkdown/kit/core';
import { SlashProvider, slashFactory } from '@milkdown/kit/plugin/slash';
import { TextSelection, type EditorState, type PluginView } from '@milkdown/kit/prose/state';
import type { EditorView } from '@milkdown/kit/prose/view';
import { componentRegistryCtx, insertComponentEmbedCommand } from '../component/component-embed';
import type { ComponentEmbedRegistry } from '$lib/editor/components/registry';
import {
	clearTextInCurrentBlockCommand,
	createCodeBlockCommand,
	headingSchema,
	insertHrCommand,
	paragraphSchema,
	setBlockTypeCommand,
	wrapInBlockquoteCommand,
	wrapInBulletListCommand,
	wrapInOrderedListCommand
} from '@milkdown/kit/preset/commonmark';
import SlashMenu, { type SlashMenuItem } from './SlashMenu.svelte';
import { insertColumnsCommand } from '../columns/columns';
import { SlashMenuState } from './slash-menu-state.svelte';
import { insertYoutubeEmbedCommand } from '../youtube/youtube-embed';

const DEFAULT_VIDEO_ID = 'aqz-KE-bpKQ';

export const CORE_SLASH_MENU_ITEMS: SlashMenuItem[] = [
	{
		key: 'text',
		label: 'Text',
		description: 'Plain paragraph',
		group: 'Text',
		keywords: ['paragraph', 'body']
	},
	{
		key: 'heading-1',
		label: 'Heading 1',
		description: 'Large section heading',
		group: 'Text',
		keywords: ['h1', 'title']
	},
	{
		key: 'heading-2',
		label: 'Heading 2',
		description: 'Medium section heading',
		group: 'Text',
		keywords: ['h2', 'subtitle']
	},
	{
		key: 'heading-3',
		label: 'Heading 3',
		description: 'Small section heading',
		group: 'Text',
		keywords: ['h3']
	},
	{
		key: 'quote',
		label: 'Quote',
		description: 'Quoted passage',
		group: 'Text',
		keywords: ['blockquote']
	},
	{
		key: 'divider',
		label: 'Divider',
		description: 'Horizontal separator',
		group: 'Text',
		keywords: ['rule', 'separator']
	},
	{
		key: 'bullet-list',
		label: 'Bullet list',
		description: 'Unordered list',
		group: 'List',
		keywords: ['ul', 'unordered']
	},
	{
		key: 'ordered-list',
		label: 'Numbered list',
		description: 'Ordered list',
		group: 'List',
		keywords: ['ol', 'number']
	},
	{
		key: 'code',
		label: 'Code block',
		description: 'Code with language selection',
		group: 'Advanced',
		keywords: ['code', 'fence', 'programming']
	},
	{
		key: 'columns',
		label: 'Columns',
		description: 'Two resizable content columns',
		group: 'Advanced',
		keywords: ['layout', 'grid', 'split']
	},
	{
		key: 'youtube',
		label: 'YouTube',
		description: 'Embedded video component',
		group: 'Advanced',
		keywords: ['video', 'embed']
	}
];

export const markdownSlashMenu = slashFactory('MARKDOWN_SLASH_MENU');

export function createSlashMenuItems(ctx: Ctx): SlashMenuItem[] {
	return createSlashMenuItemsForRegistry(ctx.get(componentRegistryCtx.key));
}

export function createSlashMenuItemsForRegistry(
	registry: ComponentEmbedRegistry | null
): SlashMenuItem[] {
	const components: SlashMenuItem[] = (registry?.insertable() ?? []).map((entry) => ({
		key: `component:${entry.id}`,
		label: entry.label,
		description: entry.description,
		group: 'Components',
		keywords: [entry.markdownName, entry.id, ...(entry.keywords ?? [])]
	}));

	return [...CORE_SLASH_MENU_ITEMS, ...components];
}

function isSelectionAtBlockEnd(view: EditorView) {
	const selection = view.state.selection;
	return (
		selection instanceof TextSelection &&
		selection.empty &&
		selection.$head.parentOffset === selection.$head.parent.content.size
	);
}

function isInsideUnsupportedParent(view: EditorView) {
	const { $from } = view.state.selection;
	for (let depth = $from.depth; depth > 0; depth -= 1) {
		if (['code_block', 'bullet_list', 'ordered_list'].includes($from.node(depth).type.name))
			return true;
	}
	return false;
}

class SlashMenuView implements PluginView {
	readonly #content: HTMLElement;
	readonly #component: ReturnType<typeof mount>;
	readonly #provider: SlashProvider;
	readonly #state = new SlashMenuState();

	constructor(ctx: Ctx, view: EditorView) {
		const content = document.createElement('div');
		content.className = 'zaki-slash-menu';
		Object.assign(content.style, {
			position: 'fixed',
			visibility: 'hidden',
			pointerEvents: 'none',
			zIndex: '50'
		});
		this.#content = content;

		const run = (key: string) => {
			view.focus();
			const commands = ctx.get(commandsCtx);
			commands.call(clearTextInCurrentBlockCommand.key);

			if (key === 'text') {
				commands.call(setBlockTypeCommand.key, { nodeType: paragraphSchema.type(ctx) });
			}
			if (key.startsWith('heading-')) {
				commands.call(setBlockTypeCommand.key, {
					nodeType: headingSchema.type(ctx),
					attrs: { level: Number(key.at(-1)) }
				});
			}
			if (key === 'quote') commands.call(wrapInBlockquoteCommand.key);
			if (key === 'divider') commands.call(insertHrCommand.key);
			if (key === 'bullet-list') commands.call(wrapInBulletListCommand.key);
			if (key === 'ordered-list') commands.call(wrapInOrderedListCommand.key);
			if (key === 'code') commands.call(createCodeBlockCommand.key);
			if (key === 'columns') commands.call(insertColumnsCommand.key);
			if (key === 'youtube') commands.call(insertYoutubeEmbedCommand.key, DEFAULT_VIDEO_ID);
			if (key.startsWith('component:')) {
				commands.call(insertComponentEmbedCommand.key, key.slice('component:'.length));
			}

			this.hide();
		};

		this.#component = mount(SlashMenu, {
			target: content,
			props: {
				viewState: this.#state,
				items: createSlashMenuItems(ctx),
				onRun: run,
				onHide: () => this.hide()
			}
		});

		this.#provider = new SlashProvider({
			content,
			root: document.body,
			debounce: 20,
			offset: 8,
			floatingUIOptions: { strategy: 'fixed' },
			shouldShow: (currentView) => {
				if (isInsideUnsupportedParent(currentView) || !isSelectionAtBlockEnd(currentView))
					return false;
				const currentText = this.#provider.getContent(currentView, (node) =>
					['paragraph', 'heading'].includes(node.type.name)
				);
				if (!currentText?.startsWith('/')) return false;
				this.#state.filter = currentText.slice(1);
				return true;
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
		this.#provider.update(view, prevState);
	};

	hide = () => {
		this.#state.filter = '';
		this.#provider.hide();
	};

	destroy = () => {
		this.#provider.destroy();
		void unmount(this.#component);
		this.#content.remove();
	};
}

export function configureSlashMenu(ctx: Ctx) {
	ctx.set(markdownSlashMenu.key, {
		view: (view) => new SlashMenuView(ctx, view)
	});
}
