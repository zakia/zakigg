<script lang="ts">
	import { onMount, tick, type Snippet } from 'svelte';
	import { Editor, posToDOMRect, type JSONContent, type Range } from '@tiptap/core';
	import type { EditorView } from '@tiptap/pm/view';
	import { noteComponentEmbeds } from '$lib/notes/component-embeds';
	import {
		getCraftPublication,
		publishNoteCraft,
		unpublishNoteCraft
	} from '$lib/crafts/publication.remote';
	import { isPublishedCraftOutdated, stripLeadingPageHeader } from '$lib/crafts/publication';
	import { insertRegisteredComponentEmbed } from '$lib/editor/component-embeds';
	import { hideBlockHandle } from '$lib/editor/block-handle';
	import type { MediaBlockAttrs, MediaBlockKind } from '$lib/editor/media-block';
	import CraftArticleHeader from '$lib/crafts/CraftArticleHeader.svelte';
	import EditorDocumentActions from './EditorDocumentActions.svelte';
	import EditorHistoryPanel from './EditorHistoryPanel.svelte';
	import EditorSurface from './EditorSurface.svelte';
	import EditorToolbar from './EditorToolbar.svelte';
	import BlockHandle from './BlockHandle.svelte';
	import SlashMenu, { type SlashMenuItem } from './SlashMenu.svelte';
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
	import {
		normalizeMetadataEntries,
		type MetadataEntry,
		type MetadataProperties
	} from './metadata-block';
	import { downloadNotePageExport } from './export';
	import {
		createLocalAssetSrc,
		getAltTextForFile,
		getMediaFiles,
		getMediaKindForFile,
		getMediaKindForUrl,
		isMediaFile
	} from './media';
	import { formatSaveLabel, type SaveState, type SyncLabelStatus } from './save-state';
	import { insertTable } from './tables';
	import { startSyncEngine, syncState } from './sync/engine.svelte';
	import { auth } from '$lib/auth';
	import { resolveNoteAssetObjectUrl, saveNoteAsset, saveNotePage } from './storage';
	import { createTimer } from '../editor/timers';
	import { resolveNotePageMetadata, type NotePageV1 } from './types';

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
	// Ordered page metadata, edited by the properties panel (source of truth).
	// Seeded once — the route remounts this component per note ({#key note.id}).
	// svelte-ignore state_referenced_locally
	let properties = $state<MetadataEntry[]>(
		normalizeMetadataEntries($state.snapshot(page.properties))
	);
	// The handle element the drag-handle extension positions and binds drag to.
	let blockHandleElement = $state<HTMLElement>();
	let imageInput = $state<HTMLInputElement>();
	let videoInput = $state<HTMLInputElement>();
	let editor = $state<Editor>();
	let saveState = $state<SaveState>('loading');
	let lastSavedAt = $state<string>();
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
	let pendingSave = false;
	let linkPopover = $state<LinkPopoverState>(createHiddenLinkPopover());
	let selectionToolbar = $state<SelectionToolbarState>(createHiddenSelectionToolbar());
	let publicationState = $state<'loading' | 'unpublished' | 'published' | 'working' | 'error'>(
		'loading'
	);
	let publicationExists = $state(false);
	let pendingPublicationPage = $state<NotePageV1 | null>(null);
	let publicationUpdateInFlight = $state(false);
	let publicationChecked = false;
	let selectionToolbarFrame = 0;
	let pointerSelectionActive = false;
	let historyEntryIndex = 0;
	let previewReturnContent: JSONContent | null = null;
	const saveTimer = createTimer();
	const historyTimer = createTimer();
	const linkShowTimer = createTimer();
	const linkHideTimer = createTimer();

	const syncLabelStatus = $derived<SyncLabelStatus>(auth.user ? syncState.status : 'disabled');
	const saveLabel = $derived(formatSaveLabel(saveState, lastSavedAt, syncLabelStatus));
	const selectionAnchorStyle = $derived(
		`left: ${selectionToolbar.anchor.left}px; top: ${selectionToolbar.anchor.top}px; width: ${selectionToolbar.anchor.width}px; height: ${selectionToolbar.anchor.height}px;`
	);
	const selectionToolbarFallbackLeft = $derived(
		selectionToolbar.anchor.left + selectionToolbar.anchor.width / 2
	);
	const selectionToolbarFallbackTop = $derived(selectionToolbar.anchor.top);
	const embedActions = $derived(
		noteComponentEmbeds.insertable().map(({ id, label, icon }) => ({ id, label, icon }))
	);
	const slashMenuItems = $derived(
		getSlashMenuItems().filter((item) =>
			`${item.label} ${item.description}`.toLowerCase().includes(slashMenu.query.toLowerCase())
		)
	);
	const mobileListActions = $derived.by(() => {
		editorTick;
		return {
			visible: Boolean(editor?.isActive('listItem')),
			canIndent: Boolean(editor?.can().chain().focus().sinkListItem('listItem').run()),
			canOutdent: Boolean(editor?.can().chain().focus().liftListItem('listItem').run())
		};
	});
	const headerTitle = $derived(String(getPropertyValue('title') ?? page.title));
	const headerDate = $derived(String(getPropertyValue('date') || page.createdAt));
	const wordCount = $derived.by(() => {
		editorTick;
		return countWords(`${headerTitle} ${editor?.getText() ?? ''}`);
	});

	$effect(() => {
		if (!auth.ready || !auth.user || publicationChecked) return;
		publicationChecked = true;
		void refreshPublicationState();
	});

	$effect(() => {
		if (
			!auth.user ||
			!publicationExists ||
			!pendingPublicationPage ||
			publicationUpdateInFlight ||
			publicationState === 'error' ||
			syncState.status !== 'synced'
		) {
			return;
		}

		void updatePublishedCraft();
	});

	onMount(() => {
		startSyncEngine();

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
				extensions: createEditorExtensions(noteComponentEmbeds, resolveNoteAssetObjectUrl, {
					getBlockHandleElement: () => blockHandleElement ?? null,
					onBlockHandleTargetChange: (nextTarget) => {
						blockHandleTarget = nextTarget;
					}
				}),
				content: initialContent,
				// Position 1 is inside the leading H1 — land there on a fresh,
				// untitled note so the user starts typing the title.
				autofocus: startsWithEmptyTitle(initialContent) ? 1 : 'end',
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
					scheduleSave();
					scheduleHistorySnapshot();
				},
				onSelectionUpdate: noteEditorChanged,
				onTransaction: noteEditorChanged
			});

			recordHistorySnapshotFromContent(initialContent);
			editor = instance;
			lastSavedAt = page.updatedAt;
			saveState = 'saved';
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
			saveTimer.cancel();
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
			if (pendingSave) void persistNow({ notify: false });
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

	function getSlashMenuItems(): SlashMenuItem[] {
		return [
			{ id: 'paragraph', label: 'Text', description: 'Plain paragraph', icon: 'mdi:format-text' },
			{
				id: 'heading-1',
				label: 'Heading 1',
				description: 'Large section heading',
				icon: 'mdi:format-header-1'
			},
			{
				id: 'heading-2',
				label: 'Heading 2',
				description: 'Medium section heading',
				icon: 'mdi:format-header-2'
			},
			{
				id: 'heading-3',
				label: 'Heading 3',
				description: 'Small section heading',
				icon: 'mdi:format-header-3'
			},
			{
				id: 'bullet-list',
				label: 'Bullet list',
				description: 'Create a bulleted list',
				icon: 'mdi:format-list-bulleted'
			},
			{
				id: 'ordered-list',
				label: 'Numbered list',
				description: 'Create a numbered list',
				icon: 'mdi:format-list-numbered'
			},
			{
				id: 'quote',
				label: 'Quote',
				description: 'Emphasize a quotation',
				icon: 'mdi:format-quote-close'
			},
			{
				id: 'code',
				label: 'Code block',
				description: 'Code with syntax highlighting',
				icon: 'mdi:code-tags'
			},
			{ id: 'divider', label: 'Divider', description: 'Separate sections', icon: 'mdi:minus' },
			{ id: 'table', label: 'Table', description: 'Insert a 3 × 2 table', icon: 'mdi:table' },
			{
				id: 'image',
				label: 'Image',
				description: 'Upload one or more images',
				icon: 'mdi:image-outline'
			},
			{
				id: 'video',
				label: 'Video',
				description: 'Upload one or more videos',
				icon: 'mdi:video-outline'
			},
			...embedActions.map((embed) => ({
				id: `component:${embed.id}`,
				label: embed.label,
				description: 'Interactive component',
				icon: embed.icon ?? 'mdi:application-braces-outline'
			}))
		];
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
		const nextItems = getSlashMenuItems().filter((item) =>
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

		const { from, to } = slashMenu;
		closeSlashMenu();
		const chain = editor.chain().focus().deleteRange({ from, to });

		switch (id) {
			case 'paragraph':
				chain.setParagraph().run();
				break;
			case 'heading-1':
				chain.setHeading({ level: 1 }).run();
				break;
			case 'heading-2':
				chain.setHeading({ level: 2 }).run();
				break;
			case 'heading-3':
				chain.setHeading({ level: 3 }).run();
				break;
			case 'bullet-list':
				chain.toggleBulletList().run();
				break;
			case 'ordered-list':
				chain.toggleOrderedList().run();
				break;
			case 'quote':
				chain.toggleBlockquote().run();
				break;
			case 'code':
				chain.toggleCodeBlock().run();
				break;
			case 'divider':
				chain.setHorizontalRule().run();
				break;
			case 'table':
				chain.run();
				insertTable(editor);
				break;
			case 'image':
				chain.run();
				openImagePicker();
				break;
			case 'video':
				chain.run();
				openVideoPicker();
				break;
			default:
				chain.run();
				if (id.startsWith('component:')) insertEmbed(id.slice('component:'.length));
		}
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
			saveState = 'error';
		}
	}

	// Panel edits and pasted/imported frontmatter both flow through here.
	function updateProperties(next: MetadataEntry[]) {
		properties = normalizeMetadataEntries(next);
		noteEditorChanged();
		scheduleSave();
	}

	function getPropertyValue(key: string) {
		return properties.find((property) => property.key === key)?.value;
	}

	function updateHeaderProperty(key: 'title', value: string) {
		const next = [...normalizeMetadataEntries(properties)];
		const index = next.findIndex((property) => property.key === key);

		if (index >= 0) next[index] = { key, value };
		else next.unshift({ key, value });

		updateProperties(next);
	}

	function countWords(text: string) {
		const normalized = text.trim();
		return normalized ? normalized.split(/\s+/).length : 0;
	}

	function insertMarkdown(markdown: string) {
		const result = insertEditorMarkdown(editor, markdown);

		if (result.properties) mergePageProperties(result.properties);

		return result.inserted || Boolean(result.frontmatter);
	}

	// Pasted/dropped frontmatter merges into page properties; incoming values
	// win per key, everything else is kept.
	function mergePageProperties(incoming: MetadataProperties) {
		const merged = [...normalizeMetadataEntries(properties)];

		for (const entry of normalizeMetadataEntries(incoming)) {
			const index = merged.findIndex((existing) => existing.key === entry.key);

			if (index >= 0) merged[index] = entry;
			else merged.push(entry);
		}

		updateProperties(merged);
	}

	async function insertMediaFiles(files: File[]) {
		if (!editor || !files.length) return;

		try {
			saveState = 'saving';

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
			saveState = 'error';
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

	function scheduleSave() {
		saveState = 'saving';
		pendingSave = true;
		saveTimer.schedule(() => {
			void persistNow();
		}, 350);
	}

	async function persistNow({ notify = true }: { notify?: boolean } = {}) {
		if (!editor) return;

		pendingSave = false;

		try {
			const content = previewReturnContent ?? editor.getJSON();
			// saveNotePage re-derives title/slug/tags/frontmatter from properties
			// and the document's first H1.
			const nextPage = await saveNotePage({
				...page,
				properties: $state.snapshot(properties) as MetadataEntry[],
				content
			});
			// On teardown we save but must not notify: onSaved -> the page's
			// slug-change redirect would fire during route transitions and revert
			// navigation away from the editor.
			if (notify) onSaved?.(nextPage);
			lastSavedAt = nextPage.updatedAt;
			saveState = 'saved';
			if (publicationExists) pendingPublicationPage = nextPage;
			return nextPage;
		} catch {
			saveState = 'error';
		}
	}

	async function refreshPublicationState() {
		try {
			const publication = await getCraftPublication(page.id);
			publicationExists = Boolean(publication);
			publicationState = publicationExists ? 'published' : 'unpublished';
			if (publication && isPublishedCraftOutdated(page, publication)) {
				pendingPublicationPage = page;
			}
		} catch {
			publicationState = 'error';
		}
	}

	async function updatePublishedCraft() {
		const nextPage = pendingPublicationPage;
		if (!nextPage || publicationUpdateInFlight) return;

		pendingPublicationPage = null;
		publicationUpdateInFlight = true;
		publicationState = 'working';

		try {
			await publishNoteCraft({ pageJson: JSON.stringify(nextPage) });
			publicationState = 'published';
		} catch {
			pendingPublicationPage = nextPage;
			publicationState = 'error';
		} finally {
			publicationUpdateInFlight = false;
		}
	}

	async function togglePublication() {
		if (publicationState === 'working' || publicationState === 'loading') return;

		const shouldUnpublish = publicationExists && publicationState !== 'error';
		publicationState = 'working';

		try {
			if (shouldUnpublish) {
				await unpublishNoteCraft(page.id);
				publicationExists = false;
				pendingPublicationPage = null;
				publicationState = 'unpublished';
				return;
			}

			const savedPage = await persistNow();
			if (!savedPage) throw new Error('Save failed');

			await publishNoteCraft({ pageJson: JSON.stringify(savedPage) });
			publicationExists = true;
			pendingPublicationPage = null;
			publicationState = 'published';
		} catch {
			publicationState = 'error';
		}
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

	function insertEmbed(id: string) {
		if (!editor) return;

		const result = insertRegisteredComponentEmbed(editor, noteComponentEmbeds, id);

		if (!result.ok) {
			saveState = 'error';
		}
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

		void downloadNotePageExport(getDraftPage(content), content);
	}

	function getDraftPage(content: JSONContent): NotePageV1 {
		const draft: NotePageV1 = {
			...page,
			properties: $state.snapshot(properties) as MetadataEntry[],
			content
		};

		return { ...draft, ...resolveNotePageMetadata(draft, content) };
	}

	function startsWithEmptyTitle(content: JSONContent) {
		// The document now leads with the title H1 (metadata lives on the page).
		const first = content.type === 'doc' ? content.content?.[0] : undefined;

		return (
			first?.type === 'heading' && Number(first.attrs?.level) === 1 && !(first.content ?? []).length
		);
	}

	function getInitialEditorContent(page: NotePageV1): JSONContent {
		// `page` is a Svelte $state proxy, so its `content` is deeply proxied.
		// ProseMirror retains proxy references for object-valued node attrs (e.g.
		// component embed props), and those proxies can't be structuredClone'd
		// into IndexedDB — which silently breaks every save. Snapshot to plain
		// objects before the content ever reaches the editor.
		const content = $state.snapshot(page.content) as JSONContent;
		return stripLeadingPageHeader(content, page.title, page.frontmatter?.description);
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
		{saveState}
		{saveLabel}
		syncStatus={syncLabelStatus}
		{publicationState}
		{publicHref}
		historyOpen={historyPanelOpen}
		{propertiesOpen}
		onDownloadMarkdown={downloadMarkdown}
		onToggleHistory={toggleHistoryPanel}
		onToggleProperties={() => (propertiesOpen = !propertiesOpen)}
		onTogglePublication={auth.user ? togglePublication : undefined}
	/>

	{#if propertiesOpen}
		<aside class="properties-popover" aria-label="Page properties">
			<MetadataPanel {properties} onChange={updateProperties} />
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
				title={headerTitle}
				date={headerDate}
				{wordCount}
				editable
				onTitleChange={(value) => updateHeaderProperty('title', value)}
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
