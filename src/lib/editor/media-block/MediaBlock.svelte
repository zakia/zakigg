<script lang="ts">
	import { onDestroy } from 'svelte';
	import type { Node as ProseMirrorNode } from '@tiptap/pm/model';
	import type { Readable } from 'svelte/store';
	import ToolbarButton from '$lib/notes/ToolbarButton.svelte';
	import {
		MEDIA_BLOCK_CLASS_NAMES,
		normalizeMediaBlockAttrs,
		normalizeMediaWidthPercent,
		type MediaBlockAlign,
		type MediaBlockAssetResolver,
		type MediaBlockAttrs
	} from './config';

	type UpdateResult = { ok: true } | { ok: false; message: string };
	type ResizeDirection = -1 | 1;
	type ResizeHandle = {
		name: 'nw' | 'ne' | 'sw' | 'se';
		label: string;
		direction: ResizeDirection;
	};

	type Props = {
		node: Readable<ProseMirrorNode>;
		resolveAssetSrc?: MediaBlockAssetResolver;
		selectNode?: () => void;
		updateAttributes?: (attributes: Partial<MediaBlockAttrs>) => UpdateResult;
	};

	let { node, resolveAssetSrc, selectNode, updateAttributes }: Props = $props();
	let resizeShell = $state<HTMLDivElement>();
	let resolvedAssetId = $state('');
	let resolvedSrc = $state('');
	let objectUrl = '';
	let resizeState:
		| {
				pointerId: number;
				startX: number;
				startWidth: number;
				baseWidth: number;
				direction: ResizeDirection;
		  }
		| undefined;
	let pendingWidth: number | undefined;
	let resizeFrame = 0;
	let toolbarSticky = $state(false);
	let toolbarCloseTimer = 0;

	const attrs = $derived(normalizeMediaBlockAttrs($node.attrs));
	const mediaWidth = $derived(normalizeMediaWidthPercent(attrs.width));
	const displaySrc = $derived(resolvedSrc || (attrs.assetId ? '' : attrs.src));
	const resizeHandles: ResizeHandle[] = [
		{ name: 'nw', label: 'Resize media from top left', direction: -1 },
		{ name: 'ne', label: 'Resize media from top right', direction: 1 },
		{ name: 'sw', label: 'Resize media from bottom left', direction: -1 },
		{ name: 'se', label: 'Resize media from bottom right', direction: 1 }
	];
	const alignmentActions: Array<{ align: MediaBlockAlign; title: string; icon: string }> = [
		{ align: 'left', title: 'Align media left', icon: 'mdi:format-align-left' },
		{ align: 'center', title: 'Align media center', icon: 'mdi:format-align-center' },
		{ align: 'right', title: 'Align media right', icon: 'mdi:format-align-right' }
	];

	$effect(() => {
		if (!attrs.assetId || !resolveAssetSrc) {
			resolvedAssetId = '';
			setResolvedSrc('');
			return;
		}

		let cancelled = false;
		const assetId = attrs.assetId;

		void resolveAssetSrc(assetId).then((src) => {
			if (cancelled || assetId !== attrs.assetId) {
				revokeObjectUrl(src);
				return;
			}

			resolvedAssetId = assetId;
			setResolvedSrc(src ?? '');
		});

		return () => {
			cancelled = true;
		};
	});

	onDestroy(() => {
		cancelResize();
		cancelToolbarClose();
		setResolvedSrc('');
	});

	function startResize(event: PointerEvent, direction: ResizeDirection) {
		if (!updateAttributes || event.button !== 0) return;

		const baseWidth = getResizeBaseWidth();
		if (!baseWidth) return;

		event.preventDefault();
		event.stopPropagation();
		selectNode?.();

		resizeState = {
			pointerId: event.pointerId,
			startX: event.clientX,
			startWidth: mediaWidth,
			baseWidth,
			direction
		};

		(event.currentTarget as HTMLElement).setPointerCapture?.(event.pointerId);
		window.addEventListener('pointermove', handleResizePointerMove);
		window.addEventListener('pointerup', handleResizePointerEnd);
		window.addEventListener('pointercancel', handleResizePointerEnd);
	}

	function handleResizePointerMove(event: PointerEvent) {
		if (!resizeState || event.pointerId !== resizeState.pointerId) return;

		event.preventDefault();

		const deltaPercent =
			((event.clientX - resizeState.startX) * resizeState.direction * 100) / resizeState.baseWidth;

		queueWidthPreview(resizeState.startWidth + deltaPercent);
	}

	function handleResizePointerEnd(event: PointerEvent) {
		if (resizeState && event.pointerId !== resizeState.pointerId) return;

		commitWidthUpdate();
		cancelResize();
	}

	function handleResizeKeydown(event: KeyboardEvent, direction: ResizeDirection) {
		if (!updateAttributes) return;
		if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;

		event.preventDefault();
		event.stopPropagation();
		selectNode?.();

		const arrowDirection = event.key === 'ArrowRight' ? 1 : -1;
		const step = event.shiftKey ? 10 : 5;

		updateAttributes({
			width: normalizeMediaWidthPercent(mediaWidth + arrowDirection * direction * step)
		});
	}

	function keepEditorSelection(event: PointerEvent) {
		if ((event.target as HTMLElement).closest('button')) {
			event.preventDefault();
			selectNode?.();
		}
	}

	function showMediaToolbar() {
		cancelToolbarClose();
		toolbarSticky = true;
	}

	function scheduleMediaToolbarClose() {
		cancelToolbarClose();
		toolbarCloseTimer = window.setTimeout(() => {
			toolbarSticky = false;
			toolbarCloseTimer = 0;
		}, 260);
	}

	function cancelToolbarClose() {
		if (!toolbarCloseTimer) return;

		window.clearTimeout(toolbarCloseTimer);
		toolbarCloseTimer = 0;
	}

	function alignMedia(align: MediaBlockAlign) {
		selectNode?.();
		updateAttributes?.({ align });
	}

	function downloadMedia() {
		if (!displaySrc) return;

		selectNode?.();

		const anchor = document.createElement('a');
		anchor.href = displaySrc;
		anchor.download = getDownloadFileName();
		anchor.rel = 'noopener';
		document.body.append(anchor);
		anchor.click();
		window.setTimeout(() => anchor.remove(), 0);
	}

	function getDownloadFileName() {
		const label = (attrs.title || attrs.alt || getFileNameFromSrc(attrs.src) || attrs.kind).trim();
		const extension = getFileExtension(attrs.src) || (attrs.kind === 'video' ? 'mp4' : 'jpg');

		return `${sanitizeFileName(label)}.${extension}`;
	}

	function getFileNameFromSrc(src: string) {
		try {
			const url = new URL(src, window.location.href);
			return decodeURIComponent(url.pathname.split('/').pop() ?? '').replace(/\.[^.]+$/, '');
		} catch {
			return (
				src
					.split('/')
					.pop()
					?.replace(/\.[^.]+$/, '') ?? ''
			);
		}
	}

	function getFileExtension(src: string) {
		const cleanSrc = src.split(/[?#]/, 1)[0] ?? '';
		const extension = cleanSrc.match(/\.([a-z0-9]+)$/i)?.[1]?.toLowerCase();

		return extension && extension.length <= 5 ? extension : '';
	}

	function sanitizeFileName(value: string) {
		const sanitized = value
			.replace(/[/\\?%*:|"<>]/g, '-')
			.replace(/\s+/g, ' ')
			.trim();

		return sanitized || attrs.kind;
	}

	function getResizeBaseWidth() {
		const block = resizeShell?.closest<HTMLElement>('[data-media-block]');
		const rect = (block?.parentElement ?? resizeShell)?.getBoundingClientRect();

		return rect?.width && Number.isFinite(rect.width) ? rect.width : 0;
	}

	function queueWidthPreview(width: number) {
		pendingWidth = normalizeMediaWidthPercent(width);

		if (resizeFrame) return;

		resizeFrame = requestAnimationFrame(() => {
			resizeFrame = 0;

			if (pendingWidth !== undefined) {
				applyWidthPreview(pendingWidth);
			}
		});
	}

	function commitWidthUpdate() {
		if (resizeFrame) {
			cancelAnimationFrame(resizeFrame);
			resizeFrame = 0;
		}

		if (pendingWidth === undefined) return;

		const width = pendingWidth;
		pendingWidth = undefined;

		applyWidthPreview(width);
		updateAttributes?.({ width });
	}

	function cancelResize() {
		resizeState = undefined;
		pendingWidth = undefined;

		if (resizeFrame) {
			cancelAnimationFrame(resizeFrame);
			resizeFrame = 0;
		}

		window.removeEventListener('pointermove', handleResizePointerMove);
		window.removeEventListener('pointerup', handleResizePointerEnd);
		window.removeEventListener('pointercancel', handleResizePointerEnd);
	}

	function applyWidthPreview(width: number) {
		const block = resizeShell?.closest<HTMLElement>('[data-media-block]');
		if (!block) return;

		if (width < 100) {
			block.setAttribute('data-media-width', String(width));
			block.style.width = `${width}%`;
			applyPreviewAlignment(block);
			return;
		}

		block.removeAttribute('data-media-width');
		block.style.removeProperty('width');
		block.style.removeProperty('margin-inline-start');
		block.style.removeProperty('margin-inline-end');
	}

	function applyPreviewAlignment(block: HTMLElement) {
		if (attrs.align === 'left') {
			block.style.marginInlineStart = '0';
			block.style.marginInlineEnd = 'auto';
			return;
		}

		if (attrs.align === 'right') {
			block.style.marginInlineStart = 'auto';
			block.style.marginInlineEnd = '0';
			return;
		}

		block.style.marginInlineStart = 'auto';
		block.style.marginInlineEnd = 'auto';
	}

	function setResolvedSrc(src: string) {
		if (objectUrl && objectUrl !== src) {
			URL.revokeObjectURL(objectUrl);
		}

		objectUrl = src.startsWith('blob:') ? src : '';
		resolvedSrc = src;
	}

	function revokeObjectUrl(src: string | null | undefined) {
		if (src?.startsWith('blob:')) URL.revokeObjectURL(src);
	}
</script>

{#if displaySrc}
	<div
		class={`${MEDIA_BLOCK_CLASS_NAMES.shell} ${toolbarSticky ? 'toolbar-sticky' : ''}`}
		bind:this={resizeShell}
		role="group"
		aria-label={`${attrs.kind === 'video' ? 'Video' : 'Image'} block`}
		onpointerenter={showMediaToolbar}
		onpointerleave={scheduleMediaToolbarClose}
	>
		<div
			class={MEDIA_BLOCK_CLASS_NAMES.toolbar}
			data-media-toolbar
			role="toolbar"
			tabindex="-1"
			aria-label={`${attrs.kind === 'video' ? 'Video' : 'Image'} actions`}
			onpointerenter={showMediaToolbar}
			onpointerleave={scheduleMediaToolbarClose}
			onpointerdown={keepEditorSelection}
		>
			<div class={MEDIA_BLOCK_CLASS_NAMES.toolbarGroup}>
				<ToolbarButton title="Download media" icon="mdi:download-outline" onClick={downloadMedia} />
			</div>
			<div class={MEDIA_BLOCK_CLASS_NAMES.toolbarGroup}>
				{#each alignmentActions as action (action.align)}
					<ToolbarButton
						title={action.title}
						icon={action.icon}
						active={attrs.align === action.align}
						pressed={attrs.align === action.align}
						onClick={() => alignMedia(action.align)}
					/>
				{/each}
			</div>
		</div>

		<div class={MEDIA_BLOCK_CLASS_NAMES.frame}>
			{#if attrs.kind === 'video'}
				<video
					class={MEDIA_BLOCK_CLASS_NAMES.media}
					src={displaySrc}
					title={attrs.title || undefined}
					controls={attrs.controls}
					autoplay={attrs.autoplay}
					loop={attrs.loop}
					muted={attrs.muted}
					playsinline
				></video>
			{:else}
				<img
					class={MEDIA_BLOCK_CLASS_NAMES.media}
					src={displaySrc}
					alt={attrs.alt}
					title={attrs.title || undefined}
					draggable="false"
					loading="lazy"
					decoding="async"
				/>
			{/if}
		</div>

		<div class={MEDIA_BLOCK_CLASS_NAMES.handles} aria-hidden={false}>
			{#each resizeHandles as handle (handle.name)}
				<button
					type="button"
					class={`${MEDIA_BLOCK_CLASS_NAMES.handle} media-block-resize-handle-${handle.name}`}
					data-media-resize-handle={handle.name}
					aria-label={handle.label}
					title={handle.label}
					onpointerdown={(event) => startResize(event, handle.direction)}
					onkeydown={(event) => handleResizeKeydown(event, handle.direction)}
				></button>
			{/each}
		</div>
	</div>

	{#if attrs.caption}
		<!-- The node view mounts this component into a figure element. -->
		<!-- svelte-ignore a11y_figcaption_parent -->
		<figcaption class={MEDIA_BLOCK_CLASS_NAMES.caption}>{attrs.caption}</figcaption>
	{/if}
{:else if attrs.assetId && resolvedAssetId !== attrs.assetId}
	<div class={MEDIA_BLOCK_CLASS_NAMES.missing}>Loading media...</div>
{:else}
	<div class={MEDIA_BLOCK_CLASS_NAMES.missing}>Media unavailable</div>
{/if}

<style>
	.media-block-node {
		display: grid;
		gap: var(--s-3);
		margin: 0.95em 0;
		max-width: 100%;
		width: 100%;
	}

	.media-block-frame {
		background: var(--base-2);
		border-radius: var(--radius);
		overflow: hidden;
	}

	.media-block-resize-shell {
		max-width: 100%;
		position: relative;
	}

	.media-block-toolbar,
	.media-block-toolbar-group {
		align-items: center;
		display: flex;
	}

	.media-block-toolbar {
		--toolbar-size: 2.25rem;
		backdrop-filter: blur(18px);
		background: color-mix(in oklch, var(--base-1) 92%, transparent);
		border: 1px solid color-mix(in oklch, var(--edge) 78%, transparent);
		border-radius: var(--s-3);
		box-shadow: 0 14px 38px rgb(0 0 0 / 0.14);
		color: var(--content);
		gap: var(--s-4);
		left: 50%;
		opacity: 0;
		padding: var(--s-4);
		pointer-events: auto;
		position: absolute;
		bottom: calc(100% + var(--s-1));
		transform: translateX(-50%);
		transition:
			opacity 0.14s ease,
			visibility 0.14s ease,
			translate 0.16s cubic-bezier(0.16, 1, 0.3, 1);
		translate: 0 var(--s-5);
		visibility: hidden;
		z-index: 4;
	}

	.media-block-toolbar-group {
		border-right: 1px solid color-mix(in oklch, var(--edge) 72%, transparent);
		gap: var(--s-5);
		padding-right: var(--s-4);
	}

	.media-block-toolbar-group:last-child {
		border-right: 0;
		padding-right: 0;
	}

	.media-block-resize-shell:hover .media-block-toolbar,
	.media-block-resize-shell:focus-within .media-block-toolbar,
	.media-block-resize-shell.toolbar-sticky .media-block-toolbar,
	:global(.media-block-node.ProseMirror-selectednode) .media-block-toolbar {
		opacity: 1;
		translate: 0;
		visibility: visible;
	}

	.media-block-media {
		display: block;
		height: auto;
		object-fit: contain;
		width: 100%;
	}

	.media-block-frame > .media-block-media {
		max-height: none;
	}

	.media-block-resize-handles {
		inset: 0;
		opacity: 0;
		pointer-events: none;
		position: absolute;
		transition: opacity 0.12s ease;
	}

	.media-block-resize-shell:hover .media-block-resize-handles,
	.media-block-resize-shell:focus-within .media-block-resize-handles,
	.media-block-resize-shell.toolbar-sticky .media-block-resize-handles,
	:global(.media-block-node.ProseMirror-selectednode) .media-block-resize-handles {
		opacity: 1;
	}

	:global(.media-block-node.media-block-dragging) .media-block-toolbar,
	:global(.media-block-node.media-block-dragging) .media-block-resize-handles {
		opacity: 0;
		pointer-events: none;
		transition: none;
		visibility: hidden;
	}

	.media-block-resize-handle {
		appearance: none;
		background: var(--base-1);
		border: 2px solid var(--brand);
		border-radius: 999px;
		box-shadow: none;
		height: 1rem;
		margin: 0;
		padding: 0;
		pointer-events: auto;
		position: absolute;
		touch-action: none;
		transform: translate(-50%, -50%);
		width: 1rem;
	}

	.media-block-resize-handle:focus-visible {
		box-shadow: 0 0 0 3px color-mix(in oklch, var(--brand) 24%, transparent);
		outline: none;
	}

	.media-block-resize-handle-nw {
		cursor: nwse-resize;
		left: 0;
		top: 0;
	}

	.media-block-resize-handle-ne {
		cursor: nesw-resize;
		left: 100%;
		top: 0;
	}

	.media-block-resize-handle-sw {
		cursor: nesw-resize;
		left: 0;
		top: 100%;
	}

	.media-block-resize-handle-se {
		cursor: nwse-resize;
		left: 100%;
		top: 100%;
	}

	.media-block-caption {
		color: var(--content-1);
		font-size: var(--s-1);
		line-height: 1.4;
		text-align: center;
	}

	.media-block-missing {
		background: color-mix(in oklch, var(--base-2) 88%, var(--error) 7%);
		border: 1px solid color-mix(in oklch, var(--error) 30%, transparent);
		border-radius: var(--radius);
		color: var(--content-1);
		padding: var(--s-1) var(--s0);
	}

	@media (pointer: coarse) {
		.media-block-resize-handle {
			height: 1.25rem;
			width: 1.25rem;
		}
	}
</style>
