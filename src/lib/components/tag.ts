import assignments from '../crafts/tags.json';
import {
	readTagRegistry,
	tagKey,
	tagPalette,
	type TagColor
} from '#lib/crafts/tags.js';

const builtTags = readTagRegistry(JSON.stringify(assignments));
const paletteColors = Object.values(tagPalette);

export function tagColor(name: string): string {
	const key = tagKey(name);
	if (Object.hasOwn(builtTags, key)) {
		return tagPalette[builtTags[key] as TagColor];
	}

	let hash = 2166136261;
	for (let i = 0; i < key.length; i += 1) {
		hash ^= key.charCodeAt(i);
		hash = Math.imul(hash, 16777619);
	}
	return paletteColors[(hash >>> 0) % paletteColors.length] ?? 'oklch(65% 0 0)';
}
