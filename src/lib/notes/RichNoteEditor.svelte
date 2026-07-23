<script lang="ts">
	import { onMount } from 'svelte';
	import { Editor, posToDOMRect, type JSONContent, type Range } from '@tiptap/core';
	import type { EditorView } from '@tiptap/pm/view';
	import { craftComponentEmbeds } from '$lib/crafts/component-embeds';
	import { insertRegisteredComponentEmbed } from '$lib/editor/component-embeds';
	import type { MediaBlockAttrs, MediaBlockKind } from '$lib/editor/media-block';
	import EditorDocumentActions from './EditorDocumentActions.svelte';
	import EditorHistoryPanel from './EditorHistoryPanel.svelte';
	import EditorSurface from './EditorSurface.svelte';
	import EditorToolbar from './EditorToolbar.svelte';
	import BlockHandle from './BlockHandle.svelte';
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
	import {
		getMarkdownFiles,
		insertEditorMarkdown,
		looksLikeMarkdown,
		serializeNotePageMarkdown
	} from './markdown';
	import {
		METADATA_BLOCK_NODE_NAME,
		ensureLeadingMetadataBlock,
		normalizeMetadataEntries,
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
	import { formatSaveLabel, type SaveState } from './save-state';
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

	let {
		page,
		onSaved
	}: {
		page: NotePageV1;
		onSaved?: (page: NotePageV1) => void;
	} = $props();

	let editorHost = $state<HTMLDivElement>();
	let imageInput = $state<HTMLInputElement>();
	let videoInput = $state<HTMLInputElement>();
	let editor = $state<Editor>();
	let saveState = $state<SaveState>('loading');
	let lastSavedAt = $state<string>();
	let copied = $state(false);
	let editorTick = $state(0);
	let historyEntries = $state<EditorHistoryEntry[]>([]);
	let activeHistoryId = $state('');
	let previewHistoryId = $state('');
	let historyPanelOpen = $state(false);
	let shortcutsPanelOpen = $state(false);
	let blockHandleTarget = $state<import('$lib/editor/block-handle').BlockHandleTarget | null>(null);
	let editorTickQueued = false;
	let pendingSave = false;
	let linkPopover = $state<LinkPopoverState>(createHiddenLinkPopover());
	let selectionToolbar = $state<SelectionToolbarState>(createHiddenSelectionToolbar());
	let selectionToolbarFrame = 0;
	let pointerSelectionActive = false;
	let historyEntryIndex = 0;
	let previewReturnContent: JSONContent | null = null;
	const saveTimer = createTimer();
	const copyTimer = createTimer();
	const historyTimer = createTimer();
	const linkShowTimer = createTimer();
	const linkHideTimer = createTimer();

	const saveLabel = $derived(formatSaveLabel(saveState, lastSavedAt));
	const selectionAnchorStyle = $derived(
		`left: ${selectionToolbar.anchor.left}px; top: ${selectionToolbar.anchor.top}px; width: ${selectionToolbar.anchor.width}px; height: ${selectionToolbar.anchor.height}px;`
	);
	const selectionToolbarFallbackLeft = $derived(
		selectionToolbar.anchor.left + selectionToolbar.anchor.width / 2
	);
	const selectionToolbarFallbackTop = $derived(selectionToolbar.anchor.top);
	const embedActions = $derived(
		craftComponentEmbeds.insertable().map(({ id, label, icon }) => ({ id, label, icon }))
	);

	onMount(() => {
		let destroyed = false;
		const syncVisibleSelectionToolbar = () => {
			if (selectionToolbar.visible) scheduleSelectionToolbarSync();
		};
		const handleDocumentPointerdown = (event: PointerEvent) => {
			const target = event.target as Element | null;

			if (!target) return;
			if (target.closest('.selection-toolbar')) return;

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
			if (destroyed || !editorHost) return;

			const initialContent = getInitialEditorContent(page);
			const instance = new Editor({
				element: editorHost,
				extensions: createEditorExtensions(craftComponentEmbeds, resolveNoteAssetObjectUrl, {
					onBlockHandleTargetChange: (nextTarget) => {
						blockHandleTarget = nextTarget;
					}
				}),
				content: initialContent,
				// Position 2 is inside the H1 (the leading metadata block is a
				// size-1 atom at position 0).
				autofocus: startsWithEmptyTitle(initialContent) ? 2 : 'end',
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
		window.addEventListener('resize', syncVisibleSelectionToolbar);
		document.addEventListener('scroll', syncVisibleSelectionToolbar, true);
		document.addEventListener('pointerdown', handleDocumentPointerdown, true);
		document.addEventListener('pointerup', handleDocumentPointerup, true);
		document.addEventListener('pointercancel', handleDocumentPointercancel, true);

		return () => {
			destroyed = true;
			pointerSelectionActive = false;
			cancelSelectionToolbarSync();
			saveTimer.cancel();
			copyTimer.cancel();
			historyTimer.cancel();
			cancelLinkPopoverOpen();
			cancelLinkPopoverClose();
			window.removeEventListener('resize', syncVisibleSelectionToolbar);
			document.removeEventListener('scroll', syncVisibleSelectionToolbar, true);
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

	function createEditorDomHandlers() {
		return {
			keydown: (_view: unknown, event: KeyboardEvent) => {
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

		if (editorTickQueued) return;

		editorTickQueued = true;
		queueMicrotask(() => {
			editorTickQueued = false;
			editorTick += 1;
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

	function insertMarkdown(markdown: string) {
		const result = insertEditorMarkdown(editor, markdown);

		if (result.properties) mergeLeadingMetadataProperties(result.properties);

		return result.inserted || Boolean(result.frontmatter);
	}

	// Pasted/dropped frontmatter lands in the document's one metadata block;
	// incoming values win per key, everything else is kept.
	function mergeLeadingMetadataProperties(properties: MetadataProperties) {
		if (!editor) return;

		const block = editor.state.doc.child(0);
		if (block.type.name !== METADATA_BLOCK_NODE_NAME) return;

		const merged = [...normalizeMetadataEntries(block.attrs.properties)];

		for (const entry of normalizeMetadataEntries(properties)) {
			const index = merged.findIndex((existing) => existing.key === entry.key);

			if (index >= 0) merged[index] = entry;
			else merged.push(entry);
		}

		editor.view.dispatch(
			editor.state.tr.setNodeMarkup(0, undefined, {
				...block.attrs,
				properties: merged
			})
		);
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
			const metadata = resolveNotePageMetadata(page, content);
			const nextPage = await saveNotePage({
				...page,
				...metadata,
				content
			});
			// On teardown we save but must not notify: onSaved -> the page's
			// slug-change redirect would fire during route transitions and revert
			// navigation away from the editor.
			if (notify) onSaved?.(nextPage);
			lastSavedAt = nextPage.updatedAt;
			saveState = 'saved';
		} catch {
			saveState = 'error';
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

		const result = insertRegisteredComponentEmbed(editor, craftComponentEmbeds, id);

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

	async function copyMarkdown() {
		if (!editor) return;

		const content = editor.getJSON();
		const draftPage = getDraftPage(content);
		const markdown = serializeNotePageMarkdown(draftPage, content);
		if (!markdown) return;

		await navigator.clipboard.writeText(markdown);
		copied = true;
		copyTimer.schedule(() => {
			copied = false;
		}, 1800);
	}

	function downloadMarkdown() {
		if (!editor) return;

		const content = editor.getJSON();

		void downloadNotePageExport(getDraftPage(content), content);
	}

	function getDraftPage(content: JSONContent): NotePageV1 {
		return {
			...page,
			...resolveNotePageMetadata(page, content),
			content
		};
	}

	function startsWithEmptyTitle(content: JSONContent) {
		// content[0] is always the metadata block; the title H1 follows it.
		const first = content.type === 'doc' ? content.content?.[1] : undefined;

		return (
			first?.type === 'heading' && Number(first.attrs?.level) === 1 && !(first.content ?? []).length
		);
	}

	function getInitialEditorContent(page: NotePageV1): JSONContent {
		// `page` is a Svelte $state proxy, so its `content` is deeply proxied.
		// ProseMirror retains proxy references for object-valued node attrs (e.g.
		// the metadata block's `properties`), and those proxies can't be
		// structuredClone'd into IndexedDB — which silently breaks every save.
		// Snapshot to plain objects before the content ever reaches the editor.
		const content = $state.snapshot(page.content) as JSONContent;
		const frontmatter = page.frontmatter
			? ($state.snapshot(page.frontmatter) as NotePageV1['frontmatter'])
			: undefined;

		// The schema requires a leading metadata block; normalize legacy
		// content here (seeded from stored frontmatter and tags) rather than
		// letting ProseMirror drop a mid-document block and synthesize an
		// empty one.
		return ensureLeadingMetadataBlock(content, {
			...frontmatter,
			...(page.tags.length ? { tags: $state.snapshot(page.tags) } : {})
		});
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
		{copied}
		{saveState}
		{saveLabel}
		historyOpen={historyPanelOpen}
		embeds={embedActions}
		onCopyMarkdown={copyMarkdown}
		onDownloadMarkdown={downloadMarkdown}
		onOpenShortcuts={openShortcutsPanel}
		onToggleHistory={toggleHistoryPanel}
		onInsertImage={openImagePicker}
		onInsertVideo={openVideoPicker}
		onInsertEmbed={insertEmbed}
	/>

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

	<EditorSurface
		onHost={updateEditorHost}
		onDragOver={handleSurfaceDragOver}
		onDrop={handleSurfaceDrop}
	>
		<BlockHandle {editor} target={blockHandleTarget} />
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
</style>
