/** Shared palette and allocation rules; src/lib/crafts/tags.json owns the assignments. */
export const tagPalette = {
	blue: 'oklch(65% 0.11 250)',
	violet: 'oklch(65% 0.11 300)',
	rose: 'oklch(65% 0.11 15)',
	amber: 'oklch(68% 0.11 80)',
	teal: 'oklch(65% 0.09 185)',
	green: 'oklch(65% 0.10 145)'
} as const;
export type TagColor = keyof typeof tagPalette;
export type TagRegistry = Record<string, TagColor>;
export const tagRegistryPath = 'src/lib/crafts/tags.json';
export const tagKey = (name: string) => name.trim().toLowerCase();

export function readTagRegistry(source: string): TagRegistry {
	const value: unknown = JSON.parse(source);
	if (!value || typeof value !== 'object' || Array.isArray(value))
		throw new Error('Invalid tag color registry');
	for (const [tag, color] of Object.entries(value)) {
		if (
			!tag ||
			tag !== tagKey(tag) ||
			typeof color !== 'string' ||
			!Object.hasOwn(tagPalette, color)
		)
			throw new Error(`Invalid tag color assignment: ${tag}`);
	}
	return value as TagRegistry;
}

/** Keep old assignments, including unused tags; allocate only on an explicit save. */
export function assignTagColors(registry: TagRegistry, names: string[]): TagRegistry {
	const next = { ...registry };
	const colors = Object.keys(tagPalette) as TagColor[];
	const usage = Object.fromEntries(
		colors.map((color) => [color, Object.values(next).filter((value) => value === color).length])
	) as Record<TagColor, number>;
	for (const tag of [...new Set(names.map(tagKey).filter(Boolean))].sort()) {
		if (Object.hasOwn(next, tag)) continue;
		const color = colors.reduce((least, candidate) =>
			usage[candidate] < usage[least] ? candidate : least
		);
		Object.defineProperty(next, tag, {
			value: color,
			enumerable: true,
			writable: true,
			configurable: true
		});
		usage[color]++;
	}
	return next;
}

export function writeTagRegistry(registry: TagRegistry) {
	return (
		JSON.stringify(
			Object.fromEntries(Object.entries(registry).sort(([a], [b]) => a.localeCompare(b))),
			null,
			'\t'
		) + '\n'
	);
}
