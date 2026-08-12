<script lang="ts">
	import { tick } from 'svelte';
	import type { Editor } from '@tiptap/core';
	import type { EditorShortcutId } from './keyboard-shortcuts';
	import ToolbarButton from './ToolbarButton.svelte';

	type ToolbarItem = {
		title: string;
		icon: string;
		active?: (activeEditor: Editor) => boolean;
		can?: (activeEditor: Editor) => boolean;
		command?: (activeEditor: Editor) => void;
		action?: () => void | Promise<void>;
		shortcutId?: EditorShortcutId;
	};

	type ToolbarMode = 'format' | 'link';

	type Props = {
		editor?: Editor;
		editorTick: number;
		visible: boolean;
		mode: ToolbarMode;
		linkHref: string;
		linkError?: string;
		fallbackLeft: number;
		fallbackTop: number;
		onCommand: () => void;
		onOpenLink: () => void;
		onCancelLink: () => void;
		onClose: () => void;
		onLinkHrefChange: (href: string) => void;
		onSubmitLink: (event: SubmitEvent) => void;
	};

	let {
		editor,
		editorTick,
		visible,
		mode,
		linkHref,
		linkError = '',
		fallbackLeft,
		fallbackTop,
		onCommand,
		onOpenLink,
		onCancelLink,
		onClose,
		onLinkHrefChange,
		onSubmitLink
	}: Props = $props();

	let popoverElement = $state<HTMLDivElement>();
	let hrefInput = $state<HTMLInputElement>();
	let linkInputFocused = false;

	const popoverSupported = $derived(
		typeof HTMLElement !== 'undefined' && 'showPopover' in HTMLElement.prototype
	);

	const popoverStyle = $derived(
		`--selection-toolbar-left: ${fallbackLeft}px; --selection-toolbar-top: ${fallbackTop}px;`
	);

	function formattingGroups(): ToolbarItem[][] {
		return [
			[
				{
					title: 'Paragraph',
					icon: 'mdi:format-paragraph',
					active: (e) => e.isActive('paragraph'),
					command: (e) => e.chain().focus().setParagraph().run()
				},
				{
					title: 'Heading 1',
					icon: 'mdi:format-header-1',
					active: (e) => e.isActive('heading', { level: 1 }),
					command: (e) => e.chain().focus().toggleHeading({ level: 1 }).run()
				},
				{
					title: 'Heading 2',
					icon: 'mdi:format-header-2',
					active: (e) => e.isActive('heading', { level: 2 }),
					command: (e) => e.chain().focus().toggleHeading({ level: 2 }).run()
				}
			],
			[
				{
					title: 'Bold',
					icon: 'mdi:format-bold',
					shortcutId: 'bold',
					active: (e) => e.isActive('bold'),
					can: (e) => e.can().chain().focus().toggleBold().run(),
					command: (e) => e.chain().focus().toggleBold().run()
				},
				{
					title: 'Italic',
					icon: 'mdi:format-italic',
					shortcutId: 'italic',
					active: (e) => e.isActive('italic'),
					can: (e) => e.can().chain().focus().toggleItalic().run(),
					command: (e) => e.chain().focus().toggleItalic().run()
				},
				{
					title: 'Strike',
					icon: 'mdi:format-strikethrough',
					shortcutId: 'strike',
					active: (e) => e.isActive('strike'),
					can: (e) => e.can().chain().focus().toggleStrike().run(),
					command: (e) => e.chain().focus().toggleStrike().run()
				},
				{
					title: 'Inline Code',
					icon: 'mdi:code-tags',
					shortcutId: 'inlineCode',
					active: (e) => e.isActive('code'),
					can: (e) => e.can().chain().focus().toggleCode().run(),
					command: (e) => e.chain().focus().toggleCode().run()
				},
				{
					title: 'Link',
					icon: 'mdi:link-variant',
					shortcutId: 'link',
					active: (e) => e.isActive('link'),
					action: onOpenLink
				}
			],
			[
				{
					title: 'Bullet List',
					icon: 'mdi:format-list-bulleted',
					active: (e) => e.isActive('bulletList'),
					command: (e) => e.chain().focus().toggleBulletList().run()
				},
				{
					title: 'Ordered List',
					icon: 'mdi:format-list-numbered',
					active: (e) => e.isActive('orderedList'),
					command: (e) => e.chain().focus().toggleOrderedList().run()
				},
				{
					title: 'Quote',
					icon: 'mdi:format-quote-close',
					active: (e) => e.isActive('blockquote'),
					command: (e) => e.chain().focus().toggleBlockquote().run()
				}
			]
		];
	}

	function run(command: (activeEditor: Editor) => void) {
		if (!editor) return;

		command(editor);
		onCommand();
	}

	function isActive(item: ToolbarItem) {
		return editorTick >= 0 && editor ? (item.active?.(editor) ?? false) : false;
	}

	function isDisabled(item: ToolbarItem) {
		if (!editor) return true;

		return editorTick >= 0 && item.can ? !item.can(editor) : false;
	}

	function activate(item: ToolbarItem) {
		if (item.command) {
			run(item.command);
			return;
		}

		void item.action?.();
	}

	function keepEditorSelection(event: PointerEvent) {
		if ((event.target as HTMLElement).closest('button')) {
			event.preventDefault();
		}
	}

	function handleKeydown(event: KeyboardEvent) {
		if (event.key !== 'Escape') return;

		event.preventDefault();
		if (mode === 'link') {
			onCancelLink();
			return;
		}

		onClose();
	}

	$effect(() => {
		if (!popoverElement || !popoverSupported) return;

		const isOpen = popoverElement.matches(':popover-open');

		if (visible && !isOpen) {
			popoverElement.showPopover();
		}

		if (!visible && isOpen) {
			popoverElement.hidePopover();
		}
	});

	$effect(() => {
		if (!visible || mode !== 'link') {
			linkInputFocused = false;
			return;
		}

		if (linkInputFocused) return;
		linkInputFocused = true;

		void tick().then(() => {
			if (!visible || mode !== 'link') return;

			hrefInput?.focus();
			hrefInput?.select();
		});
	});
</script>

<div
	bind:this={popoverElement}
	class={`selection-toolbar mode-${mode}`}
	class:visible={!popoverSupported && visible}
	popover="manual"
	role="toolbar"
	tabindex="-1"
	aria-label={mode === 'link' ? 'Link editor' : 'Craft formatting toolbar'}
	style={popoverStyle}
	hidden={!popoverSupported && !visible}
	onpointerdown={keepEditorSelection}
	onkeydown={handleKeydown}
>
	{#if mode === 'link'}
		<form class="link-form" onsubmit={onSubmitLink}>
			<input
				bind:this={hrefInput}
				type="text"
				inputmode="url"
				aria-label="Link URL"
				placeholder="Paste or enter link"
				value={linkHref}
				oninput={(event) => onLinkHrefChange(event.currentTarget.value)}
			/>
			<button type="submit" class="link-confirm">Confirm</button>
			{#if linkError}
				<span class="link-error">{linkError}</span>
			{/if}
		</form>
	{:else}
		<div class="toolbar-row">
			{#each formattingGroups() as group, groupIndex (groupIndex)}
				<div class="toolbar-group">
					{#each group as item (item.title)}
						<ToolbarButton
							title={item.title}
							icon={item.icon}
							active={isActive(item)}
							pressed={item.active ? isActive(item) : undefined}
							disabled={isDisabled(item)}
							shortcutId={item.shortcutId}
							onClick={() => activate(item)}
						/>
					{/each}
				</div>
			{/each}
		</div>
	{/if}
</div>

<style>
	.selection-toolbar,
	.toolbar-group,
	.toolbar-row,
	.link-form,
	.link-confirm {
		align-items: center;
		display: flex;
	}

	.selection-toolbar {
		--selection-toolbar-gap: 0.55rem;
		--selection-toolbar-surface: oklch(100% 0 var(--hue, 330));
		backdrop-filter: blur(18px);
		background: color-mix(in oklch, var(--selection-toolbar-surface) 88%, transparent);
		border: 1px solid color-mix(in oklch, var(--edge) 78%, transparent);
		border-radius: var(--s-3);
		box-shadow: 0 18px 46px rgb(0 0 0 / 0.14);
		color: var(--content);
		inset: auto;
		left: var(--selection-toolbar-left);
		margin: 0;
		max-width: calc(100vw - var(--s0));
		opacity: 0;
		overflow: visible;
		padding: var(--s-4);
		position: fixed;
		scale: 0.98;
		top: var(--selection-toolbar-top);
		transform: translate(-50%, calc(-100% - var(--selection-toolbar-gap)));
		transform-origin: bottom center;
		transition:
			opacity 0.14s ease,
			scale 0.16s cubic-bezier(0.16, 1, 0.3, 1);
		z-index: 8;
	}

	.selection-toolbar:popover-open,
	.selection-toolbar.visible {
		opacity: 1;
		scale: 1;
	}

	.selection-toolbar:not(:popover-open):not(.visible) {
		display: none;
	}

	.selection-toolbar.mode-link {
		max-width: min(28rem, calc(100vw - var(--s0)));
		width: min(28rem, calc(100vw - var(--s0)));
	}

	.toolbar-row {
		gap: var(--s-4);
	}

	.toolbar-group {
		border-right: 1px solid color-mix(in oklch, var(--edge) 72%, transparent);
		gap: var(--s-5);
		padding-right: var(--s-4);
	}

	.toolbar-group:last-child {
		border-right: 0;
		padding-right: 0;
	}

	.link-form {
		gap: var(--s-3);
		width: 100%;
	}

	input {
		background: var(--base-1);
		border: 1px solid color-mix(in oklch, var(--brand) 78%, var(--edge));
		border-radius: var(--s-4);
		color: var(--content);
		flex: 1 1 auto;
		font: inherit;
		font-size: var(--s-1);
		min-height: var(--toolbar-size);
		min-width: 0;
		outline: none;
		padding: 0 var(--s-2);
	}

	input::placeholder {
		color: color-mix(in oklch, var(--content-1) 72%, transparent);
	}

	input:focus {
		border-color: var(--brand);
		box-shadow: 0 0 0 2px color-mix(in oklch, var(--brand) 18%, transparent);
	}

	.link-confirm {
		background: color-mix(in oklch, var(--content-1) 36%, transparent);
		border-radius: var(--s-4);
		color: var(--base-1);
		font-size: var(--s-1);
		font-weight: 500;
		justify-content: center;
		min-height: var(--toolbar-size);
		padding: 0 var(--s-1);
		transition:
			background-color 0.2s,
			transform 0.2s;
	}

	.link-confirm:hover,
	.link-confirm:focus-visible {
		background: var(--brand);
		transform: translateY(-1px);
	}

	.link-error {
		bottom: var(--s-4);
		color: var(--error);
		font-size: var(--s-1);
		left: var(--s0);
		position: absolute;
		transform: translateY(100%);
	}

	@supports (anchor-name: --notes-selection-anchor) {
		.selection-toolbar {
			justify-self: anchor-center;
			left: auto;
			margin: var(--selection-toolbar-gap);
			position-anchor: --notes-selection-anchor;
			position-area: top;
			position-try-fallbacks:
				flip-block,
				flip-inline,
				flip-block flip-inline;
			position-visibility: anchors-visible;
			top: auto;
			transform: none;
		}

		.selection-toolbar.mode-link {
			position-area: top;
		}
	}

	@starting-style {
		.selection-toolbar:popover-open,
		.selection-toolbar.visible {
			opacity: 0;
			scale: 0.98;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.selection-toolbar {
			transition: none;
		}
	}

	@media (max-width: 42rem) {
		.selection-toolbar {
			max-width: calc(100vw - var(--s-1));
		}

		.toolbar-row {
			flex-wrap: wrap;
			max-width: min(22rem, calc(100vw - var(--s-1)));
		}

		.toolbar-group {
			border-right: 0;
			padding-right: 0;
		}

		.selection-toolbar.mode-link {
			width: min(24rem, calc(100vw - var(--s-1)));
		}

		.link-form {
			gap: var(--s-3);
		}

		input,
		.link-confirm {
			font-size: var(--s-1);
			min-height: var(--toolbar-size);
		}

		.link-confirm {
			padding-inline: var(--s-1);
		}
	}
</style>
