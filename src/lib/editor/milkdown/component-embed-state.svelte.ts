import type { ComponentEmbedAttrs } from '$lib/editor/components/registry';

export class ComponentEmbedViewState {
	attrs = $state<ComponentEmbedAttrs>({ component: '', markdownName: '', props: {} });
	editing = $state(false);

	constructor(attrs: ComponentEmbedAttrs) {
		this.attrs = attrs;
	}
}
