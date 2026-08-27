import {
	createComponentEmbedRegistry,
	type ComponentEmbedDefinition
} from '$lib/editor/components/registry';

// This path is the registration boundary. Adding a typed `embed.ts` to any
// direct child folder makes the component available to Markdown rendering and
// the editor slash menu without changing a central list.
const modules = import.meta.glob<{ embed: ComponentEmbedDefinition }>('./*/embed.ts', {
	eager: true
});

export const componentEmbeds = createComponentEmbedRegistry(
	Object.entries(modules)
		.sort(([left], [right]) => left.localeCompare(right))
		.map(([path, module]) => {
			if (!module.embed) throw new Error(`Component definition missing from ${path}`);
			return module.embed;
		})
);
