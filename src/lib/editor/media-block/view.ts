import type { Editor } from '@tiptap/core';
import type { Node as ProseMirrorNode } from '@tiptap/pm/model';
import { NodeSelection } from '@tiptap/pm/state';
import type { NodeView } from '@tiptap/pm/view';
import { flushSync, mount, unmount } from 'svelte';
import { writable } from 'svelte/store';
import {
	MEDIA_BLOCK_CLASS_NAMES,
	normalizeMediaBlockAttrs,
	type MediaBlockAssetResolver
} from './config';
import MediaBlock from './MediaBlock.svelte';

const MEDIA_BLOCK_DRAGGING_CLASS_NAME = 'media-block-dragging';
const MAX_DRAG_IMAGE_SCALE = 2;

function syncMediaBlockRoot(root: HTMLElement, node: ProseMirrorNode) {
	const attrs = normalizeMediaBlockAttrs(node.attrs);

	for (const className of MEDIA_BLOCK_CLASS_NAMES.root.split(' ')) {
		root.classList.add(className);
	}

	root.setAttribute('data-media-block', '');
	root.setAttribute('data-media-kind', attrs.kind);
	root.setAttribute('data-media-src', attrs.src);
	root.setAttribute('data-media-align', attrs.align);

	if (attrs.width < 100) {
		root.setAttribute('data-media-width', String(attrs.width));
		root.style.width = `${attrs.width}%`;
		applyMediaBlockAlignment(root, attrs.align);
	} else {
		root.removeAttribute('data-media-width');
		root.style.removeProperty('width');
		clearMediaBlockAlignment(root);
	}
}

function applyMediaBlockAlignment(root: HTMLElement, align: string) {
	if (align === 'left') {
		root.style.marginInlineStart = '0';
		root.style.marginInlineEnd = 'auto';
		return;
	}

	if (align === 'right') {
		root.style.marginInlineStart = 'auto';
		root.style.marginInlineEnd = '0';
		return;
	}

	root.style.marginInlineStart = 'auto';
	root.style.marginInlineEnd = 'auto';
}

function clearMediaBlockAlignment(root: HTMLElement) {
	root.style.removeProperty('margin-inline-start');
	root.style.removeProperty('margin-inline-end');
}

function createCleanMediaDragImage(root: HTMLElement, event: DragEvent) {
	const frame = root.querySelector<HTMLElement>(`.${MEDIA_BLOCK_CLASS_NAMES.frame}`);
	const media = frame?.querySelector<HTMLImageElement | HTMLVideoElement>(
		`.${MEDIA_BLOCK_CLASS_NAMES.media}`
	);
	if (!frame || !media || !event.dataTransfer) return;

	const rect = frame.getBoundingClientRect();
	if (!rect.width || !rect.height) return;

	const preview = document.createElement('div');
	const frameStyle = getComputedStyle(frame);
	const previewMedia = createDragPreviewMedia(media, rect) ?? cloneDragPreviewMedia(media);

	preview.style.background = frameStyle.backgroundColor;
	preview.style.borderRadius = frameStyle.borderRadius;
	preview.style.height = `${rect.height}px`;
	preview.style.left = '-10000px';
	preview.style.overflow = 'hidden';
	preview.style.pointerEvents = 'none';
	preview.style.position = 'fixed';
	preview.style.top = '-10000px';
	preview.style.width = `${rect.width}px`;

	if (previewMedia) {
		preview.append(previewMedia);
	}

	document.body.append(preview);

	event.dataTransfer.setDragImage(
		preview,
		clamp(event.clientX - rect.left, 0, rect.width),
		clamp(event.clientY - rect.top, 0, rect.height)
	);

	return preview;
}

function createDragPreviewMedia(
	media: HTMLImageElement | HTMLVideoElement,
	rect: DOMRect
): HTMLCanvasElement | undefined {
	const intrinsicWidth = media instanceof HTMLImageElement ? media.naturalWidth : media.videoWidth;
	const intrinsicHeight =
		media instanceof HTMLImageElement ? media.naturalHeight : media.videoHeight;
	if (!intrinsicWidth || !intrinsicHeight) return;

	const scale = Math.min(window.devicePixelRatio || 1, MAX_DRAG_IMAGE_SCALE);
	const canvas = document.createElement('canvas');
	const context = canvas.getContext('2d');
	if (!context) return;

	canvas.width = Math.max(1, Math.round(rect.width * scale));
	canvas.height = Math.max(1, Math.round(rect.height * scale));
	canvas.style.display = 'block';
	canvas.style.height = '100%';
	canvas.style.width = '100%';

	try {
		context.drawImage(media, 0, 0, canvas.width, canvas.height);
		return canvas;
	} catch {
		return;
	}
}

function cloneDragPreviewMedia(media: HTMLImageElement | HTMLVideoElement) {
	if (media instanceof HTMLImageElement) {
		const image = document.createElement('img');
		image.alt = '';
		image.decoding = 'sync';
		image.draggable = false;
		image.src = media.currentSrc || media.src;
		styleDragPreviewMedia(image, media);
		return image;
	}

	const video = document.createElement('video');
	video.autoplay = false;
	video.controls = false;
	video.loop = media.loop;
	video.muted = true;
	video.playsInline = true;
	video.poster = media.poster;
	video.preload = 'metadata';
	video.src = media.currentSrc || media.src;
	styleDragPreviewMedia(video, media);
	return video;
}

function styleDragPreviewMedia(element: HTMLElement, source: HTMLElement) {
	const sourceStyle = getComputedStyle(source);

	element.style.display = 'block';
	element.style.height = '100%';
	element.style.objectFit = sourceStyle.objectFit || 'contain';
	element.style.width = '100%';
}

function clamp(value: number, min: number, max: number) {
	return Math.min(Math.max(value, min), max);
}

export function createMediaBlockNodeView(
	editor: Editor,
	resolveAssetSrc?: MediaBlockAssetResolver
) {
	return ({
		node,
		getPos
	}: {
		node: ProseMirrorNode;
		getPos: () => number | undefined;
	}): NodeView => {
		let currentNode = node;
		const root = document.createElement('figure');
		const nodeStore = writable(currentNode);
		let mediaDragImage: HTMLElement | undefined;

		syncMediaBlockRoot(root, currentNode);
		root.contentEditable = 'false';

		const selectNode = () => {
			const position = getPos();
			if (typeof position !== 'number') return;

			editor.view.dispatch(
				editor.view.state.tr.setSelection(NodeSelection.create(editor.view.state.doc, position))
			);
			editor.view.focus();
		};

		const updateAttributes = (attributes: Record<string, unknown>) => {
			const position = getPos();

			if (typeof position !== 'number') {
				return { ok: false as const, message: 'Unable to update media position.' };
			}

			editor.commands.command(({ tr }) => {
				tr.setNodeMarkup(position, undefined, {
					...currentNode.attrs,
					...attributes
				});

				return true;
			});

			return { ok: true as const };
		};

		const handleMediaPointerDown = (event: PointerEvent) => {
			if (!event.isPrimary || event.button !== 0 || event.defaultPrevented) return;

			const target = event.target instanceof Element ? event.target : null;
			if (target?.closest('[data-media-resize-handle], [data-media-toolbar]')) return;

			selectNode();
		};

		const removeMediaDragImage = () => {
			mediaDragImage?.remove();
			mediaDragImage = undefined;
		};

		const clearMediaDragState = () => {
			root.classList.remove(MEDIA_BLOCK_DRAGGING_CLASS_NAME);
			removeMediaDragImage();
			window.removeEventListener('dragend', clearMediaDragState, true);
			window.removeEventListener('drop', clearMediaDragState, true);
		};

		const handleMediaDragStart = (event: DragEvent) => {
			removeMediaDragImage();
			mediaDragImage = createCleanMediaDragImage(root, event);
			root.classList.add(MEDIA_BLOCK_DRAGGING_CLASS_NAME);
			window.addEventListener('dragend', clearMediaDragState, true);
			window.addEventListener('drop', clearMediaDragState, true);
		};

		root.addEventListener('pointerdown', handleMediaPointerDown);
		root.addEventListener('dragstart', handleMediaDragStart);

		const component = mount(MediaBlock, {
			target: root,
			props: {
				node: nodeStore,
				resolveAssetSrc,
				selectNode,
				updateAttributes
			}
		});
		flushSync();

		return {
			dom: root,

			update(updatedNode) {
				if (updatedNode.type.name !== currentNode.type.name) return false;

				currentNode = updatedNode;
				syncMediaBlockRoot(root, currentNode);
				nodeStore.set(currentNode);

				return true;
			},

			ignoreMutation() {
				return true;
			},

			stopEvent(event) {
				if (
					event.target instanceof Element &&
					event.target.closest('[data-media-resize-handle], [data-media-toolbar]')
				) {
					return true;
				}

				return event.target instanceof HTMLMediaElement;
			},

			destroy() {
				clearMediaDragState();
				root.removeEventListener('pointerdown', handleMediaPointerDown);
				root.removeEventListener('dragstart', handleMediaDragStart);
				void unmount(component);
			}
		};
	};
}
