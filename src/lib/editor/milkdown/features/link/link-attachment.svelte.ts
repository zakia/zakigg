import { mount, unmount } from 'svelte';
import type { Attachment } from 'svelte/attachments';
import { editorViewCtx, type Editor } from '@milkdown/kit/core';
import type { EditorView } from '@milkdown/kit/prose/view';
import type { VirtualElement } from '@floating-ui/dom';
import { PopoverAttachment } from '$lib/editor/surface/popover-attachment.svelte';
import LinkPopover from './LinkPopover.svelte';
import { linkInteractionApiCtx } from './link-interaction';
import {
	applyLinkDraft,
	openLink,
	removeLink,
	targetFromAnchor,
	targetFromSelection
} from './link-model';
import { LinkPopoverState, type LinkTarget } from './link-popover-state.svelte';

const PREVIEW_DELAY_MS = 180;
const CLOSE_DELAY_MS = 120;

function linkAnchor(root: HTMLElement, target: EventTarget | null) {
	if (!(target instanceof Element)) return;
	const anchor = target.closest<HTMLAnchorElement>('a[href]');
	if (!anchor || !root.contains(anchor)) return;
	return anchor;
}

function selectionReference(view: EditorView, from: number, to: number): VirtualElement {
	return {
		contextElement: view.dom,
		getBoundingClientRect: () => {
			const start = view.coordsAtPos(from);
			const end = view.coordsAtPos(to);
			const left = Math.min(start.left, end.left);
			const right = Math.max(start.right, end.right);
			const top = Math.min(start.top, end.top);
			const bottom = Math.max(start.bottom, end.bottom);
			return new DOMRect(left, top, Math.max(right - left, 1), Math.max(bottom - top, 1));
		}
	};
}

/**
 * Owns every DOM interaction for Markdown links. The attachment delegates from
 * the editor root, so ProseMirror may replace link DOM without losing handlers.
 */
export function createLinkAttachment(getEditor: () => Editor | undefined): Attachment<HTMLElement> {
	return (root) => {
		const editor = getEditor();
		if (!editor) return;

		const surface = new PopoverAttachment();
		const viewState = new LinkPopoverState();
		const portal = document.createElement('div');
		portal.dataset.editorSurface = 'link';
		document.body.append(portal);

		let previewTimer: number | undefined;
		let closeTimer: number | undefined;

		const clearPreviewTimer = () => {
			window.clearTimeout(previewTimer);
			previewTimer = undefined;
		};
		const clearCloseTimer = () => {
			window.clearTimeout(closeTimer);
			closeTimer = undefined;
		};
		const close = () => {
			clearPreviewTimer();
			clearCloseTimer();
			surface.close();
			viewState.reset();
		};
		const scheduleClose = () => {
			clearCloseTimer();
			closeTimer = window.setTimeout(close, CLOSE_DELAY_MS);
		};
		const showPreview = (target: LinkTarget) => {
			if (!target.anchor) return;
			clearPreviewTimer();
			clearCloseTimer();
			viewState.preview(target);
			surface.open(target.anchor);
		};
		const schedulePreview = (target: LinkTarget) => {
			clearPreviewTimer();
			clearCloseTimer();
			if (surface.visible && viewState.mode === 'edit') return;
			if (surface.visible && viewState.target?.anchor === target.anchor) return;
			previewTimer = window.setTimeout(() => showPreview(target), PREVIEW_DELAY_MS);
		};
		const enterEdit = () => {
			const target = viewState.target;
			if (!target) return;
			clearCloseTimer();
			viewState.edit(target);
		};
		const cancelEdit = () => {
			const target = viewState.target;
			if (target?.anchor?.isConnected) {
				showPreview(targetFromAnchor(target.view, target.anchor) ?? target);
				return;
			}
			close();
			target?.view.focus();
		};
		const commitEdit = () => {
			const current = viewState.target;
			if (!current) return;
			const target = current.anchor
				? (targetFromAnchor(current.view, current.anchor) ?? current)
				: current;
			const result = applyLinkDraft(target, {
				destination: viewState.destination,
				label: viewState.label
			});
			if (!result.ok) {
				viewState.error = result.error;
				return;
			}
			close();
			target.view.focus();
		};
		const removeCurrentLink = () => {
			const current = viewState.target;
			if (!current) return;
			const target = current.anchor
				? (targetFromAnchor(current.view, current.anchor) ?? current)
				: current;
			removeLink(target);
			close();
			target.view.focus();
		};

		const component = mount(LinkPopover, {
			target: portal,
			props: {
				viewState,
				surface,
				onOpen: () => viewState.target && openLink(viewState.target),
				onCopy: () => {
					void navigator.clipboard.writeText(viewState.destination).then(() => {
						viewState.copied = true;
					});
				},
				onEdit: enterEdit,
				onCommit: commitEdit,
				onCancel: cancelEdit,
				onRemove: removeCurrentLink,
				onPointerEnter: clearCloseTimer,
				onPointerLeave: scheduleClose
			}
		});

		const openSelection = (view: EditorView) => {
			const target = targetFromSelection(view);
			if (!target) return;
			clearPreviewTimer();
			clearCloseTimer();
			viewState.edit(target);
			surface.open(selectionReference(view, target.from, target.to));
		};
		editor.action((ctx) => ctx.set(linkInteractionApiCtx.key, { editSelection: openSelection }));

		const onPointerOver = (event: PointerEvent) => {
			const anchor = linkAnchor(root, event.target);
			if (!anchor) return;
			if (event.relatedTarget instanceof Node && anchor.contains(event.relatedTarget)) return;
			const view = editor.action((ctx) => ctx.get(editorViewCtx));
			const target = targetFromAnchor(view, anchor);
			if (target) schedulePreview(target);
		};
		const onPointerOut = (event: PointerEvent) => {
			const anchor = linkAnchor(root, event.target);
			if (!anchor) return;
			if (event.relatedTarget instanceof Node) {
				if (anchor.contains(event.relatedTarget) || portal.contains(event.relatedTarget)) return;
			}
			scheduleClose();
		};
		const onPointerDown = (event: PointerEvent) => {
			const anchor = linkAnchor(root, event.target);
			if (!anchor) return;
			const view = editor.action((ctx) => ctx.get(editorViewCtx));
			if (!targetFromAnchor(view, anchor)) return;
			event.preventDefault();
		};
		const onClick = (event: MouseEvent) => {
			const anchor = linkAnchor(root, event.target);
			if (!anchor) return;
			const view = editor.action((ctx) => ctx.get(editorViewCtx));
			const target = targetFromAnchor(view, anchor);
			if (!target) return;
			event.preventDefault();
			event.stopPropagation();
			openLink(target);
		};
		const onFocusIn = (event: FocusEvent) => {
			const anchor = linkAnchor(root, event.target);
			if (!anchor) return;
			const view = editor.action((ctx) => ctx.get(editorViewCtx));
			const target = targetFromAnchor(view, anchor);
			if (target) schedulePreview(target);
		};
		const onFocusOut = (event: FocusEvent) => {
			const anchor = linkAnchor(root, event.target);
			if (!anchor) return;
			if (event.relatedTarget instanceof Node && portal.contains(event.relatedTarget)) return;
			scheduleClose();
		};
		const onKeyDown = (event: KeyboardEvent) => {
			if (event.key !== 'Enter') return;
			const anchor = linkAnchor(root, event.target);
			if (!anchor) return;
			const view = editor.action((ctx) => ctx.get(editorViewCtx));
			const target = targetFromAnchor(view, anchor);
			if (!target) return;
			event.preventDefault();
			openLink(target);
		};
		const onDocumentPointerDown = (event: PointerEvent) => {
			if (!surface.visible || !(event.target instanceof Node)) return;
			if (portal.contains(event.target) || viewState.target?.anchor?.contains(event.target)) return;
			if (viewState.mode === 'edit') commitEdit();
			else close();
		};

		root.addEventListener('pointerover', onPointerOver);
		root.addEventListener('pointerout', onPointerOut);
		root.addEventListener('pointerdown', onPointerDown);
		root.addEventListener('click', onClick);
		root.addEventListener('focusin', onFocusIn);
		root.addEventListener('focusout', onFocusOut);
		root.addEventListener('keydown', onKeyDown);
		document.addEventListener('pointerdown', onDocumentPointerDown, true);

		return () => {
			clearPreviewTimer();
			clearCloseTimer();
			root.removeEventListener('pointerover', onPointerOver);
			root.removeEventListener('pointerout', onPointerOut);
			root.removeEventListener('pointerdown', onPointerDown);
			root.removeEventListener('click', onClick);
			root.removeEventListener('focusin', onFocusIn);
			root.removeEventListener('focusout', onFocusOut);
			root.removeEventListener('keydown', onKeyDown);
			document.removeEventListener('pointerdown', onDocumentPointerDown, true);
			void unmount(component);
			portal.remove();
		};
	};
}
