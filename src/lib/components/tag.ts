import assignments from '../crafts/tags.json';
import { readTagRegistry, tagKey, tagPalette, type TagRegistry } from '$lib/crafts/tags';

const builtTags = readTagRegistry(JSON.stringify(assignments));

// Encode the whole name instead of hashing: CSS property names cannot collide.
function property(name: string) {
	return `--tag-${Array.from(tagKey(name), (character) => character.codePointAt(0)!.toString(16)).join('-')}`;
}

export function tagColor(name: string) {
	const color = Object.hasOwn(builtTags, tagKey(name))
		? tagPalette[builtTags[tagKey(name)]]
		: 'oklch(65% 0 0)';
	return `var(${property(name)}, ${color})`;
}

/** Apply live Git assignments to Svelte badges and existing CodeMirror DOM alike. */
export function applyTagColors(registry: TagRegistry) {
	if (typeof document === 'undefined') return;
	for (const [name, color] of Object.entries(registry)) {
		document.documentElement.style.setProperty(property(name), tagPalette[color]);
	}
}
