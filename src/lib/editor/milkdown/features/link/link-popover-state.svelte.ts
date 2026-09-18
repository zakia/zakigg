import type { EditorView } from '@milkdown/kit/prose/view';

export type LinkKind = 'link' | 'wiki';

export type LinkTarget = {
	kind: LinkKind;
	view: EditorView;
	from: number;
	to: number;
	destination: string;
	href: string;
	label: string;
	title?: string | null;
	anchor?: HTMLAnchorElement;
};

export class LinkPopoverState {
	mode = $state<'preview' | 'edit'>('preview');
	target = $state.raw<LinkTarget>();
	destination = $state('');
	label = $state('');
	error = $state('');
	copied = $state(false);

	preview(target: LinkTarget) {
		this.target = target;
		this.destination = target.destination;
		this.label = target.label;
		this.error = '';
		this.copied = false;
		this.mode = 'preview';
	}

	edit(target: LinkTarget) {
		this.preview(target);
		this.mode = 'edit';
	}

	reset() {
		this.target = undefined;
		this.destination = '';
		this.label = '';
		this.error = '';
		this.copied = false;
		this.mode = 'preview';
	}
}
