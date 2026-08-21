<script lang="ts">
	import { onMount, tick, type Snippet } from 'svelte';
	import { Editor, posToDOMRect, type JSONContent, type Range } from '@tiptap/core';
	import type { EditorView } from '@tiptap/pm/view';
	import { componentEmbeds } from '$lib/embeds';
	import { createBlockCatalog } from '$lib/editor/blocks';
	import { hideBlockHandle } from '$lib/editor/block-handle';
	import type { MediaBlockAttrs, MediaBlockKind } from '$lib/editor/media-block';
	import CraftArticleHeader from '$lib/crafts/CraftArticleHeader.svelte';
	import { CraftEditorSession } from '$lib/crafts/editor-session.svelte';
	import EditorDocumentActions from './EditorDocumentActions.svelte';
	import EditorHistoryPanel from './EditorHistoryPanel.svelte';
	import EditorSurface from './EditorSurface.svelte';
	import EditorToolbar from './EditorToolbar.svelte';
	import BlockHandle from './BlockHandle.svelte';
	import SlashMenu from './SlashMenu.svelte';
	import MobileListToolbar from './MobileListToolbar.svelte';
	import KeyboardShortcutsPanel from './KeyboardShortcutsPanel.svelte';
	import LinkPopover from './LinkPopover.svelte';
	import { createEditorExtensions } from './editor-extensions';
	import {
		MAX_EDITOR_HISTORY_ENTRIES,
		cloneEditorContent,
		createEditorHistoryEntry,
		getEditorHistorySignature,
		type EditorHistoryEntry
	} from './history';
	import { applyLinkEditToEditor, removeLinkFromEditor } from './link-edits';
	import {
		LINK_POPOVER_DELAY,
		createHiddenLinkPopover,
		createLinkPopoverState,
		getCurrentLinkRange,
		getLinkDetails,
		getLinkRangeAtPosition,
		openLinkHrefOnce,
		type LinkPopoverState
	} from './link-popover';
	import { isOpenShortcutsShortcut } from './keyboard-shortcuts';
	import { getMarkdownFiles, insertEditorMarkdown, looksLikeMarkdown } from './markdown';
	import MetadataPanel from './metadata-block/MetadataPanel.svelte';
	import { downloadNotePageExport } from './export';
	import {
		createLocalAssetSrc,
		getAltTextForFile,
		getMediaFiles,
		getMediaKindForFile,
		getMediaKindForUrl,
		isMediaFile
	} from './media';
	import { insertTable } from './tables';
	import { resolveNoteAssetObjectUrl, saveNoteAsset } from './storage';
	import { createTimer } from '../editor/timers';
	import type { NotePageV1 } from './types';

	type SelectionToolbarMode = 'format' | 'link';

	type SelectionAnchor = {
		left: number;
		top: number;
		width: number;
		height: number;
	};

	type SelectionToolbarState = {
		visible: boolean;
		mode: SelectionToolbarMode;
		from: number;
		to: number;
		label: string;
		href: string;
		error: string;
		anchor: SelectionAnchor;
	};

	type SlashMenuState = {
		visible: boolean;
		query: string;
		from: number;
		to: number;
		left: number;
		top: number;
		activeIndex: number;
	};

	let {
		page,
		onSaved,
		publicHref,
		navigation
	}: {
		page: NotePageV1;
		onSaved?: (page: NotePageV1) => void;
		publicHref?: string;
		navigation?: Snippet;
	} = $props();

	let editorHost = $state<HTMLDivElement>();
	// The handle element the drag-handle extension positions and binds drag to.
	let blockHandleElement = $state<HTMLElement>();
	let imageInput = $state<HTMLInputElement>();
	let videoInput = $state<HTMLInputElement>();
	let editor = $state<Editor>();
	let editorTick = $state(0);
	let historyEntries = $state<EditorHistoryEntry[]>([]);
	let activeHistoryId = $state('');
	let previewHistoryId = $state('');
	let historyPanelOpen = $state(false);
	let shortcutsPanelOpen = $state(false);
	let propertiesOpen = $state(false);
	let slashMenu = $state<SlashMenuState>(createHiddenSlashMenu());
	let blockHandleTarget = $state<import('$lib/editor/block-handle').BlockHandleTarget | null>(null);
	let editorTickQueued = false;
	let linkPopover = $state<LinkPopoverState>(createHiddenLinkPopover());
	let selectionToolbar = $state<SelectionToolbarState>(createHiddenSelectionToolbar());
	let selectionToolbarFrame = 0;
	let pointerSelectionActive = false;
	let historyEntryIndex = 0;
	let previewReturnContent: JSONContent | null = null;
	const historyTimer = createTimer();
	const linkShowTimer = createTimer();
	const linkHideTimer = createTimer();
	const blockCatalog = createBlockCatalog(componentEmbeds);
	const session = new CraftEditorSession({
		getPage: () => page,
		getContent: () => previewReturnContent ?? editor?.getJSON(),
		onDraftChange: noteEditorChanged,
		onSaved: (nextPage) => onSaved?.(nextPage)
	});
	const selectionAnchorStyle = $derived(
		`left: ${selectionToolbar.anchor.left}px; top: ${selectionToolbar.anchor.top}px; width: ${selectionToolbar.anchor.width}px; height: ${selectionToolbar.anchor.height}px;`
	);
	const selectionToolbarFallbackLeft = $derived(
		selectionToolbar.anchor.left + selectionToolbar.anchor.width / 2
	);
	const selectionToolbarFallbackTop = $derived(selectionToolbar.anchor.top);
	const slashMenuItems = $derived(
		blockCatalog
			.insertable()
			.filter((item) =>
				`${item.label} ${item.description}`.toLowerCase().includes(slashMenu.query.toLowerCase())
			)
	);
	const mobileListActions = $derived.by(() => {
		void editorTick;
		return {
			visible: Boolean(editor?.isActive('listItem')),
			canIndent: Boolean(editor?.can().chain().focus().sinkListItem('listItem').run()),
			canOutdent: Boolean(editor?.can().chain().focus().liftListItem('listItem').run())
		};
	});
	const wordCount = $derived.by(() => {
		void editorTick;
		return countWords(`${session.title} ${editor?.getText() ?? ''}`);
	});

	onMount(() => {
		let destroyed = false;
		const syncVisibleEditorMenus = () => {
			if (selectionToolbar.visible) scheduleSelectionToolbarSync();
			if (slashMenu.visible) syncSlashMenuFromEditor();
		};
		const handleDocumentPointerdown = (event: PointerEvent) => {
			const target = event.target as Element | null;

			if (!target) return;
			if (target.closest('.selection-toolbar')) return;
			if (target.closest('.slash-menu')) return;
			if (
				!target.closest(
					'.properties-popover, [aria-label="Show Properties"], [aria-label="Hide Properties"]'
				)
			) {
				propertiesOpen = false;
			}

			if (editorHost?.contains(target)) {
				if (event.button === 0) {
					pointerSelectionActive = true;
					closeSelectionToolbar();
				}

				return;
			}

			if (selectionToolbar.visible) closeSelectionToolbar();
		};
		const handleDocumentPointerup = () => {
			if (!pointerSelectionActive) return;

			pointerSelectionActive = false;
			scheduleSelectionToolbarSync();
		};
		const handleDocumentPointercancel = () => {
			pointerSelectionActive = false;
		};

		async function setupEditor() {
			// The block-handle element is owned by <BlockHandle> in the markup;
			// flush pending renders/effects so its ref is populated before the
			// editor's ProseMirror plugins read it during construction.
			await tick();

			if (destroyed || !editorHost) return;

			const initialContent = getInitialEditorContent(page);
			const instance = new Editor({
				element: editorHost,
				extensions: createEditorExtensions(componentEmbeds, resolveNoteAssetObjectUrl, {
					blockCatalog,
					getBlockHandleElement: () => blockHandleElement ?? null,
					onBlockHandleTargetChange: (nextTarget) => {
						blockHandleTarget = nextTarget;
					}
				}),
				content: initialContent,
				autofocus: 'end',
				editorProps: {
					attributes: {
						'aria-label': `${page.title} editor`,
						class: 'content content-editor'
					},
					handlePaste: (_view, event) => handleEditorPaste(event),
					handleDrop: (view, event, _slice, moved) => handleEditorDrop(view, event, moved),
					handleDOMEvents: createEditorDomHandlers()
				},
				onUpdate: () => {
					noteEditorChanged();
					session.scheduleSave();
					scheduleHistorySnapshot();
				},
				onSelectionUpdate: noteEditorChanged,
				onTransaction: noteEditorChanged
			});

			recordHistorySnapshotFromContent(initialContent);
			editor = instance;
			noteEditorChanged();
		}

		void setupEditor();
		window.addEventListener('resize', syncVisibleEditorMenus);
		document.addEventListener('scroll', syncVisibleEditorMenus, true);
		document.addEventListener('pointerdown', handleDocumentPointerdown, true);
		document.addEventListener('pointerup', handleDocumentPointerup, true);
		document.addEventListener('pointercancel', handleDocumentPointercancel, true);

		return () => {
			destroyed = true;
			pointerSelectionActive = false;
			cancelSelectionToolbarSync();
			historyTimer.cancel();
			cancelLinkPopoverOpen();
			cancelLinkPopoverClose();
			window.removeEventListener('resize', syncVisibleEditorMenus);
			document.removeEventListener('scroll', syncVisibleEditorMenus, true);
			document.removeEventListener('pointerdown', handleDocumentPointerdown, true);
			document.removeEventListener('pointerup', handleDocumentPointerup, true);
			document.removeEventListener('pointercancel', handleDocumentPointercancel, true);
			// Flush only when an edit is actually pending. An unconditional
			// teardown save would rewrite the record (bumping updatedAt) on
			// every visit, and can persist a transient editor state — e.g. a
			// mid-HMR or mid-destroy document — over real content.
			session.destroy();
			editor?.destroy();
		};
	});

	function createHiddenSelectionToolbar(): SelectionToolbarState {
		return {
			visible: false,
			mode: 'format',
			from: 0,
			to: 0,
			label: '',
			href: '',
			error: '',
			anchor: {
				left: 0,
				top: 0,
				width: 1,
				height: 1
			}
		};
	}

	function createHiddenSlashMenu(): SlashMenuState {
		return { visible: false, query: '', from: 0, to: 0, left: 0, top: 0, activeIndex: 0 };
	}

	function createEditorDomHandlers() {
		return {
			keydown: (_view: unknown, event: KeyboardEvent) => {
				if (handleSlashMenuKeydown(event)) return true;
				if (handleShortcutsKeydown(event)) return true;

				if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
					event.preventDefault();
					openLinkEditorFromKeyboard();
					return true;
				}

				if (event.key === 'Escape' && selectionToolbar.visible) {
					closeSelectionToolbar();
					return true;
				}

				if (event.key === 'Escape' && linkPopover.visible) {
					closeLinkPopover();
					return true;
				}

				return false;
			},
			mouseover: (_view: unknown, event: MouseEvent) => {
				scheduleLinkPopoverFromMouse(event);
				return false;
			},
			mousedown: (_view: unknown, event: MouseEvent) => {
				const target = event.target as Element | null;
				const link = target?.closest<HTMLAnchorElement>('a[data-href]');

				if (!link || event.button !== 0) {
					return false;
				}

				event.preventDefault();
				return true;
			},
			click: (_view: unknown, event: MouseEvent) => {
				const target = event.target as Element | null;
				const link = target?.closest<HTMLAnchorElement>('a[data-href]');

				if (!link) return false;

				event.preventDefault();
				event.stopPropagation();
				event.stopImmediatePropagation();
				cancelLinkPopoverOpen();

				if (!linkPopover.editing) {
					closeLinkPopover();
				}

				const href = link.dataset.href;
				if (!href) return true;

				openLinkHrefOnce(href);

				return true;
			},
			mouseout: (_view: unknown, event: MouseEvent) => {
				scheduleLinkPopoverCloseFromMouse(event);
				return false;
			}
		};
	}

	function handleRichEditorKeydown(event: KeyboardEvent) {
		if (event.defaultPrevented) return;

		handleShortcutsKeydown(event);
	}

	function handleShortcutsKeydown(event: KeyboardEvent) {
		if (!isOpenShortcutsShortcut(event)) return false;

		event.preventDefault();
		openShortcutsPanel();

		return true;
	}

	function noteEditorChanged() {
		scheduleSelectionToolbarSync();
		queueMicrotask(syncSlashMenuFromEditor);

		if (editorTickQueued) return;

		editorTickQueued = true;
		queueMicrotask(() => {
			editorTickQueued = false;
			editorTick += 1;
		});
	}

	function syncSlashMenuFromEditor() {
		if (!editor || !editor.state.selection.empty) {
			closeSlashMenu();
			return;
		}

		const cursor = editor.state.selection.$from;
		if (cursor.parent.type.name !== 'paragraph') {
			closeSlashMenu();
			return;
		}

		const textBefore = cursor.parent.textBetween(0, cursor.parentOffset, undefined, '\ufffc');
		const match = /^\/([^\s/]*)$/.exec(textBefore);
		if (!match) {
			closeSlashMenu();
			return;
		}

		const from = cursor.start();
		const coords = editor.view.coordsAtPos(cursor.pos);
		const query = match[1] ?? '';
		const nextItems = blockCatalog
			.insertable()
			.filter((item) =>
				`${item.label} ${item.description}`.toLowerCase().includes(query.toLowerCase())
			);

		slashMenu = {
			visible: true,
			query,
			from,
			to: cursor.pos,
			left: coords.left,
			top: coords.bottom + 8,
			activeIndex: Math.min(slashMenu.activeIndex, Math.max(0, nextItems.length - 1))
		};
	}

	function closeSlashMenu() {
		if (!slashMenu.visible) return;
		slashMenu = createHiddenSlashMenu();
	}

	function handleSlashMenuKeydown(event: KeyboardEvent) {
		if (!slashMenu.visible || event.isComposing) return false;

		if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
			event.preventDefault();
			const direction = event.key === 'ArrowDown' ? 1 : -1;
			const count = slashMenuItems.length;
			if (count) slashMenu.activeIndex = (slashMenu.activeIndex + direction + count) % count;
			return true;
		}

		if (event.key === 'Enter' && slashMenuItems[slashMenu.activeIndex]) {
			event.preventDefault();
			runSlashMenuItem(slashMenuItems[slashMenu.activeIndex].id);
			return true;
		}

		if (event.key === 'Escape') {
			event.preventDefault();
			closeSlashMenu();
			return true;
		}

		return false;
	}

	function runSlashMenuItem(id: string) {
		if (!editor || !slashMenu.visible) return;

		const activeEditor = editor;
		const { from, to } = slashMenu;
		closeSlashMenu();
		blockCatalog.insert(id, {
			editor: activeEditor,
			range: { from, to },
			services: {
				insertTable: () => insertTable(activeEditor),
				requestMedia: (kind) => (kind === 'image' ? openImagePicker() : openVideoPicker())
			}
		});
	}

	function scheduleSelectionToolbarSync() {
		if (selectionToolbarFrame) return;

		selectionToolbarFrame = requestAnimationFrame(() => {
			selectionToolbarFrame = 0;
			syncSelectionToolbarFromEditor();
		});
	}

	function cancelSelectionToolbarSync() {
		if (!selectionToolbarFrame) return;

		cancelAnimationFrame(selectionToolbarFrame);
		selectionToolbarFrame = 0;
	}

	function syncSelectionToolbarFromEditor() {
		if (pointerSelectionActive) return;

		if (!editor) {
			closeSelectionToolbar();
			return;
		}

		const { from, to, empty } = editor.state.selection;
		if (empty) {
			closeSelectionToolbar();
			return;
		}

		const label = getSelectedText({ from, to });
		if (!label.trim()) {
			closeSelectionToolbar();
			return;
		}

		const anchor = getSelectionAnchor({ from, to });
		if (!anchor) {
			closeSelectionToolbar();
			return;
		}

		const keepLinkMode =
			selectionToolbar.visible &&
			selectionToolbar.mode === 'link' &&
			selectionToolbar.from === from &&
			selectionToolbar.to === to;

		selectionToolbar = {
			visible: true,
			mode: keepLinkMode ? 'link' : 'format',
			from,
			to,
			label,
			href: keepLinkMode ? selectionToolbar.href : '',
			error: keepLinkMode ? selectionToolbar.error : '',
			anchor
		};

		if (linkPopover.visible) closeLinkPopover();
	}

	function closeSelectionToolbar() {
		selectionToolbar = createHiddenSelectionToolbar();
	}

	function getSelectedText(range: Range) {
		if (!editor) return '';

		return editor.state.doc.textBetween(range.from, range.to, '\n');
	}

	function getSelectionAnchor(range: Range): SelectionAnchor | undefined {
		if (!editor) return;

		const rect = posToDOMRect(editor.view, range.from, range.to);

		if (!Number.isFinite(rect.left) || !Number.isFinite(rect.top)) return;

		return {
			left: rect.left,
			top: rect.top,
			width: Math.max(rect.width, 1),
			height: Math.max(rect.height, 1)
		};
	}

	function updateEditorHost(host?: HTMLDivElement) {
		editorHost = host;
	}

	function openImagePicker() {
		imageInput?.click();
	}

	function openVideoPicker() {
		videoInput?.click();
	}

	function handlePickedMedia(event: Event) {
		const input = event.currentTarget as HTMLInputElement;
		const files = Array.from(input.files ?? []).filter(isMediaFile);

		input.value = '';
		void insertMediaFiles(files);
	}

	function handleEditorPaste(event: ClipboardEvent) {
		if (handleMediaPaste(event)) return true;

		return handleMarkdownPaste(event);
	}

	function handleMediaPaste(event: ClipboardEvent) {
		const files = getMediaFiles(event.clipboardData);

		if (files.length) {
			event.preventDefault();
			void insertMediaFiles(files);
			return true;
		}

		const text = event.clipboardData?.getData('text/plain')?.trim();
		const kind = text ? getMediaKindForUrl(text) : null;

		if (!text || !kind) return false;

		event.preventDefault();
		insertMediaUrl(text, kind);

		return true;
	}

	function handleMarkdownPaste(event: ClipboardEvent) {
		const text = event.clipboardData?.getData('text/plain') ?? '';

		if (!looksLikeMarkdown(text)) return false;

		event.preventDefault();

		return insertMarkdown(text);
	}

	function handleEditorDrop(view: EditorView, event: DragEvent, moved: boolean) {
		if (moved) return false;
		if (handleMarkdownFileDrop(view, event)) return true;

		return handleMediaDrop(view, event);
	}

	function handleSurfaceDragOver(event: DragEvent) {
		if (event.defaultPrevented || !hasDroppableEditorFiles(event.dataTransfer)) return;

		event.preventDefault();

		if (event.dataTransfer) {
			event.dataTransfer.dropEffect = 'copy';
		}
	}

	function handleSurfaceDrop(event: DragEvent) {
		if (event.defaultPrevented || !editor) return;

		const view = editor.view;

		if (handleMarkdownFileDrop(view, event)) return;

		handleMediaDrop(view, event);
	}

	function handleSurfaceScroll() {
		if (editor) hideBlockHandle(editor);
	}

	function indentCurrentListItem() {
		editor?.chain().focus().sinkListItem('listItem').run();
	}

	function outdentCurrentListItem() {
		editor?.chain().focus().liftListItem('listItem').run();
	}

	function hasDroppableEditorFiles(data: DataTransfer | null | undefined) {
		return Boolean(getMarkdownFiles(data).length || getMediaFiles(data).length);
	}

	function handleMarkdownFileDrop(view: EditorView, event: DragEvent) {
		const files = getMarkdownFiles(event.dataTransfer);

		if (!files.length) return false;

		event.preventDefault();
		setDropSelection(view, event);
		void insertMarkdownFiles(files);

		return true;
	}

	function handleMediaDrop(view: EditorView, event: DragEvent) {
		const files = getMediaFiles(event.dataTransfer);

		if (!files.length) return false;

		event.preventDefault();
		setDropSelection(view, event);

		void insertMediaFiles(files);

		return true;
	}

	function setDropSelection(view: EditorView, event: DragEvent) {
		const dropPosition = view.posAtCoords({
			left: event.clientX,
			top: event.clientY
		});

		if (dropPosition) {
			editor?.chain().focus().setTextSelection(dropPosition.pos).run();
		}
	}

	async function insertMarkdownFiles(files: File[]) {
		try {
			const markdown = (await Promise.all(files.map((file) => file.text()))).join('\n\n');

			insertMarkdown(markdown);
		} catch {
			session.markError();
		}
	}

	function countWords(text: string) {
		const normalized = text.trim();
		return normalized ? normalized.split(/\s+/).length : 0;
	}

	function insertMarkdown(markdown: string) {
		const result = insertEditorMarkdown(editor, markdown);

		if (result.properties) session.mergeProperties(result.properties);

		return result.inserted || Boolean(result.frontmatter);
	}

	async function insertMediaFiles(files: File[]) {
		if (!editor || !files.length) return;

		try {
			session.markSaving();

			for (const file of files) {
				const media = await resolveMediaFile(file);

				insertMediaBlock({
					kind: getMediaKindForFile(file),
					src: media.src,
					assetId: media.assetId,
					alt: getAltTextForFile(file)
				});
			}
		} catch {
			session.markError();
		}
	}

	async function resolveMediaFile(file: File) {
		const asset = await saveNoteAsset(file, page.id);

		return {
			src: createLocalAssetSrc(asset.id),
			assetId: asset.id
		};
	}

	function insertMediaUrl(src: string, kind: MediaBlockKind) {
		insertMediaBlock({ kind, src });
	}

	function insertMediaBlock(
		attrs: Partial<MediaBlockAttrs> & { kind: MediaBlockKind; src: string }
	) {
		if (!editor || !attrs.src) return;

		editor.chain().focus().insertMediaBlock(attrs).run();
	}

	function scheduleHistorySnapshot() {
		historyTimer.schedule(recordEditorHistorySnapshot, 550);
	}

	function flushHistorySnapshot() {
		historyTimer.cancel();
		recordEditorHistorySnapshot();
	}

	function recordEditorHistorySnapshot() {
		if (!editor) return;

		recordHistorySnapshotFromContent(previewReturnContent ?? editor.getJSON());
	}

	function recordHistorySnapshotFromContent(content: JSONContent) {
		const signature = getEditorHistorySignature(content);
		const existing = historyEntries.find((entry) => entry.signature === signature);

		if (existing) {
			activeHistoryId = existing.id;
			return;
		}

		const entry = createEditorHistoryEntry(content, createHistoryId());

		historyEntries = [entry, ...historyEntries].slice(0, MAX_EDITOR_HISTORY_ENTRIES);
		activeHistoryId = entry.id;
	}

	function createHistoryId() {
		historyEntryIndex += 1;

		return `history-${Date.now()}-${historyEntryIndex}`;
	}

	function toggleHistoryPanel() {
		if (!historyPanelOpen) {
			flushHistorySnapshot();
		}

		historyPanelOpen = !historyPanelOpen;
	}

	function closeHistoryPanel() {
		clearHistoryPreview();
		historyPanelOpen = false;
	}

	function openShortcutsPanel() {
		shortcutsPanelOpen = true;
	}

	function closeShortcutsPanel() {
		shortcutsPanelOpen = false;
	}

	function restoreHistoryEntry(entry: EditorHistoryEntry) {
		if (!editor) return;

		clearHistoryPreview();

		const currentSignature = getEditorHistorySignature(editor.getJSON());

		historyTimer.cancel();
		activeHistoryId = entry.id;

		if (currentSignature === entry.signature) {
			editor.commands.focus();
			return;
		}

		closeSelectionToolbar();
		closeLinkPopover();
		editor.commands.setContent(cloneEditorContent(entry.content));
		editor.commands.focus();
	}

	function previewHistoryEntry(entry: EditorHistoryEntry) {
		if (!editor || entry.id === activeHistoryId) return;

		previewReturnContent ??= editor.getJSON();
		previewHistoryId = entry.id;
		replaceEditorContentForPreview(entry.content);
	}

	function clearHistoryPreview() {
		if (!editor || !previewReturnContent) return;

		const content = previewReturnContent;

		previewReturnContent = null;
		previewHistoryId = '';
		replaceEditorContentForPreview(content);
	}

	function replaceEditorContentForPreview(content: JSONContent) {
		if (!editor) return;

		const document = editor.schema.nodeFromJSON(cloneEditorContent(content));
		const transaction = editor.state.tr
			.replaceWith(0, editor.state.doc.content.size, document)
			.setMeta('addToHistory', false)
			.setMeta('preventUpdate', true);

		editor.view.dispatch(transaction);
		noteEditorChanged();
	}

	function showLinkPopover(range: Range, editing = false) {
		if (!editor || !editorHost) return;

		cancelLinkPopoverOpen();
		cancelLinkPopoverClose();

		linkPopover = createLinkPopoverState({ editor, range, editing });
	}

	function scheduleLinkPopoverFromMouse(event: MouseEvent) {
		if (!editor || linkPopover.editing || selectionToolbar.visible) return;

		const target = event.target as Element | null;
		const link = target?.closest('a[data-href]');

		if (!link || !editorHost?.contains(link)) return;

		const position = editor.view.posAtCoords({ left: event.clientX, top: event.clientY });
		if (!position) return;

		const range = getLinkRangeAtPosition(editor, position.pos);
		if (!range) return;

		cancelLinkPopoverOpen();
		cancelLinkPopoverClose();

		linkShowTimer.schedule(() => {
			showLinkPopover(range);
		}, LINK_POPOVER_DELAY);
	}

	function scheduleLinkPopoverCloseFromMouse(event: MouseEvent) {
		if (linkPopover.editing) return;

		const target = event.target as Element | null;
		const link = target?.closest('a[data-href]');

		if (!link) return;

		const relatedTarget = event.relatedTarget as Element | null;

		if (
			relatedTarget?.closest('.link-popover') ||
			relatedTarget?.closest('a[data-href]') === link
		) {
			return;
		}

		cancelLinkPopoverOpen();
		if (!linkPopover.visible) return;

		scheduleLinkPopoverClose();
	}

	function scheduleLinkPopoverClose() {
		linkHideTimer.schedule(() => {
			if (!linkPopover.editing) closeLinkPopover();
		}, 180);
	}

	function cancelLinkPopoverClose() {
		linkHideTimer.cancel();
	}

	function cancelLinkPopoverOpen() {
		linkShowTimer.cancel();
	}

	function closeLinkPopover() {
		cancelLinkPopoverOpen();
		cancelLinkPopoverClose();
		linkPopover = createHiddenLinkPopover();
	}

	function openLinkEditorFromKeyboard() {
		if (!editor || !editorHost) return;

		if (editor.state.selection.empty) {
			openDetailedLinkEditorFromCaret();
			return;
		}

		openLinkEditorFromSelection();
	}

	function openDetailedLinkEditorFromCaret() {
		if (!editor) return;

		const linkRange = getCurrentLinkRange(editor);
		const range = linkRange ?? {
			from: editor.state.selection.from,
			to: editor.state.selection.to
		};
		const details = linkRange ? getLinkDetails(editor, linkRange) : { href: '', label: '' };

		showDetailedLinkEditor(range, details);
	}

	function openLinkEditorFromSelection() {
		if (!editor || !editorHost) return;

		const { from, to, empty } = editor.state.selection;
		if (empty) return;

		const range = { from, to };
		const label = getSelectedText(range);
		if (!label.trim()) return;

		const linkRange = getCurrentLinkRange(editor);
		const activeRange = linkRange && rangesOverlap(linkRange, range) ? linkRange : range;
		const details =
			linkRange && rangesOverlap(linkRange, range)
				? getLinkDetails(editor, linkRange)
				: { href: '', label };

		showSelectionLinkForm(activeRange, details.href, details.label);
	}

	function showDetailedLinkEditor(
		range: Range,
		details: Partial<Pick<LinkPopoverState, 'href' | 'label'>> = {}
	) {
		if (!editor) return;

		cancelLinkPopoverOpen();
		cancelLinkPopoverClose();
		closeSelectionToolbar();

		linkPopover = createLinkPopoverState({
			editor,
			range,
			editing: true,
			href: details.href,
			label: details.label
		});
	}

	function rangesOverlap(first: Range, second: Range) {
		return first.from <= second.to && second.from <= first.to;
	}

	function showSelectionLinkForm(range: Range, href = '', label = getSelectedText(range)) {
		if (!editor) return;

		const anchor = getSelectionAnchor(range);
		if (!anchor || !label.trim()) return;

		cancelLinkPopoverOpen();
		cancelLinkPopoverClose();
		if (linkPopover.visible) closeLinkPopover();

		selectionToolbar = {
			visible: true,
			mode: 'link',
			from: range.from,
			to: range.to,
			label,
			href,
			error: '',
			anchor
		};
	}

	function updateSelectionLinkHref(href: string) {
		selectionToolbar = {
			...selectionToolbar,
			href,
			error: ''
		};
	}

	function cancelSelectionLinkEdit() {
		if (!selectionToolbar.visible) return;

		selectionToolbar = {
			...selectionToolbar,
			mode: 'format',
			error: ''
		};

		editor?.commands.focus();
	}

	function applySelectionLinkEdit(event: SubmitEvent) {
		event.preventDefault();
		if (!editor || !selectionToolbar.visible) return;

		const result = applyLinkEditToEditor(editor, {
			visible: true,
			editing: true,
			placement: 'below',
			href: selectionToolbar.href,
			label: selectionToolbar.label,
			from: selectionToolbar.from,
			to: selectionToolbar.to,
			left: 0,
			top: 0,
			error: selectionToolbar.error
		});

		if (!result.ok) {
			selectionToolbar = {
				...selectionToolbar,
				error: result.error
			};
			return;
		}

		const anchor = getSelectionAnchor(result.range) ?? selectionToolbar.anchor;

		selectionToolbar = {
			visible: true,
			mode: 'format',
			from: result.range.from,
			to: result.range.to,
			label: getSelectedText(result.range),
			href: '',
			error: '',
			anchor
		};

		noteEditorChanged();
	}

	function editVisibleLink() {
		if (!linkPopover.visible) return;

		linkPopover = {
			...linkPopover,
			editing: true,
			error: ''
		};
	}

	function updateLinkPopover(patch: Partial<LinkPopoverState>) {
		linkPopover = {
			...linkPopover,
			...patch
		};
	}

	function applyLinkEdit(event?: SubmitEvent) {
		event?.preventDefault();
		if (!editor || !linkPopover.visible) return;

		const result = applyLinkEditToEditor(editor, linkPopover);

		if (!result.ok) {
			updateLinkPopover({ error: result.error });
			return;
		}

		showLinkPopover(result.range);
		noteEditorChanged();
	}

	function removeVisibleLink() {
		if (!editor || !linkPopover.visible) return;

		removeLinkFromEditor(editor, linkPopover);
		closeLinkPopover();
		noteEditorChanged();
	}

	function openVisibleLink() {
		if (!linkPopover.href) return;

		openLinkHrefOnce(linkPopover.href);
	}

	function handleLinkPopoverKeydown(event: KeyboardEvent) {
		if (event.key === 'Escape') {
			event.preventDefault();
			closeLinkPopover();
		}
	}

	function downloadMarkdown() {
		if (!editor) return;

		const content = editor.getJSON();

		void downloadNotePageExport(session.getDraftPage(content), content);
	}

	function getInitialEditorContent(page: NotePageV1): JSONContent {
		// `page` is a Svelte $state proxy, so its `content` is deeply proxied.
		// ProseMirror retains proxy references for object-valued node attrs (e.g.
		// component embed props), and those proxies can't be structuredClone'd
		// into IndexedDB — which silently breaks every save. Snapshot to plain
		// objects before the content ever reaches the editor.
		const content = $state.snapshot(page.content) as JSONContent;
		return content;
	}
</script>

<svelte:window onkeydown={handleRichEditorKeydown} />

<div class="rich-editor">
	<input
		bind:this={imageInput}
		class="media-file-input"
		type="file"
		accept="image/png,image/jpeg,image/webp,image/gif,image/avif"
		multiple
		onchange={handlePickedMedia}
	/>
	<input
		bind:this={videoInput}
		class="media-file-input"
		type="file"
		accept="video/mp4,video/webm,video/quicktime,video/x-m4v"
		multiple
		onchange={handlePickedMedia}
	/>

	<EditorDocumentActions
		saveState={session.saveState}
		saveLabel={session.saveLabel}
		syncStatus={session.syncLabelStatus}
		publicationState={session.publicationState}
		{publicHref}
		historyOpen={historyPanelOpen}
		{propertiesOpen}
		onDownloadMarkdown={downloadMarkdown}
		onToggleHistory={toggleHistoryPanel}
		onToggleProperties={() => (propertiesOpen = !propertiesOpen)}
		onTogglePublication={session.canPublish ? () => session.togglePublication() : undefined}
	/>

	{#if propertiesOpen}
		<aside class="properties-popover" aria-label="Page properties">
			<MetadataPanel
				properties={session.properties}
				onChange={(next) => session.updateProperties(next)}
			/>
		</aside>
	{/if}

	<EditorHistoryPanel
		entries={historyEntries}
		activeId={activeHistoryId}
		previewId={previewHistoryId}
		visible={historyPanelOpen}
		onClose={closeHistoryPanel}
		onRestore={restoreHistoryEntry}
		onPreview={previewHistoryEntry}
		onClearPreview={clearHistoryPreview}
	/>

	<KeyboardShortcutsPanel visible={shortcutsPanelOpen} onClose={closeShortcutsPanel} />

	{#if selectionToolbar.visible}
		<div class="selection-anchor" style={selectionAnchorStyle} aria-hidden="true"></div>
	{/if}

	<EditorToolbar
		{editor}
		{editorTick}
		visible={selectionToolbar.visible}
		mode={selectionToolbar.mode}
		linkHref={selectionToolbar.href}
		linkError={selectionToolbar.error}
		fallbackLeft={selectionToolbarFallbackLeft}
		fallbackTop={selectionToolbarFallbackTop}
		onCommand={noteEditorChanged}
		onOpenLink={openLinkEditorFromSelection}
		onCancelLink={cancelSelectionLinkEdit}
		onClose={closeSelectionToolbar}
		onLinkHrefChange={updateSelectionLinkHref}
		onSubmitLink={applySelectionLinkEdit}
	/>

	<SlashMenu
		visible={slashMenu.visible}
		items={slashMenuItems}
		activeIndex={slashMenu.activeIndex}
		left={slashMenu.left}
		top={slashMenu.top}
		onSelect={runSlashMenuItem}
	/>

	<MobileListToolbar
		visible={mobileListActions.visible}
		canIndent={mobileListActions.canIndent}
		canOutdent={mobileListActions.canOutdent}
		onIndent={indentCurrentListItem}
		onOutdent={outdentCurrentListItem}
	/>

	<EditorSurface
		onHost={updateEditorHost}
		onDragOver={handleSurfaceDragOver}
		onDrop={handleSurfaceDrop}
		onScroll={handleSurfaceScroll}
		{navigation}
	>
		{#snippet header()}
			<CraftArticleHeader
				title={session.title}
				date={session.date}
				{wordCount}
				editable
				onTitleChange={(value) => session.updateTitle(value)}
			/>
		{/snippet}
		<BlockHandle
			{editor}
			target={blockHandleTarget}
			onElement={(element) => (blockHandleElement = element)}
		/>
	</EditorSurface>

	{#if linkPopover.visible}
		<LinkPopover
			popover={linkPopover}
			onUpdate={updateLinkPopover}
			onSubmit={applyLinkEdit}
			onEdit={editVisibleLink}
			onRemove={removeVisibleLink}
			onOpen={openVisibleLink}
			onCancelClose={cancelLinkPopoverClose}
			onScheduleClose={scheduleLinkPopoverClose}
			onKeydown={handleLinkPopoverKeydown}
		/>
	{/if}
</div>

<style>
	.selection-anchor {
		anchor-name: --notes-selection-anchor;
		opacity: 0;
		pointer-events: none;
		position: fixed;
	}

	.rich-editor {
		--toolbar-size: 2.25rem;
		background: color-mix(in oklch, var(--base) 92%, var(--base-1));
		display: flex;
		flex: 1;
		flex-direction: column;
		height: 100vh;
		min-height: 100vh;
		overflow: hidden;
		position: relative;
		width: 100%;
	}

	.media-file-input {
		display: none;
	}

	.properties-popover {
		backdrop-filter: blur(18px);
		background: color-mix(in oklch, var(--base-1) 92%, transparent);
		border: 1px solid color-mix(in oklch, var(--edge) 76%, transparent);
		border-radius: var(--s-3);
		box-shadow: 0 1.2rem 3rem rgb(0 0 0 / 0.14);
		overflow: visible;
		padding: var(--s-1);
		position: absolute;
		right: calc(var(--s0) + env(safe-area-inset-right));
		top: calc(4rem + env(safe-area-inset-top));
		width: min(34rem, calc(100vw - var(--s0) * 2));
		z-index: 10;
	}

	@media (max-width: 42rem) {
		.properties-popover {
			right: var(--s-2);
			top: calc(3.5rem + env(safe-area-inset-top));
			width: calc(100vw - var(--s-2) * 2);
		}
	}
</style>
