export type MetadataPrimitiveValue = string | boolean;
export type MetadataPropertyValue = MetadataPrimitiveValue | string[];
export type MetadataProperties = Record<string, MetadataPropertyValue>;

// Property order is user data (drag/keyboard reordering), so the attr stores an
// ordered entries array. A plain record can't carry order through ProseMirror:
// its attr comparison (compareDeep) ignores object key order, so a reorder-only
// change would be invisible to the view, the update event, and undo history.
export type MetadataEntry = { key: string; value: MetadataPropertyValue };
export type MetadataPropertiesInput = MetadataProperties | MetadataEntry[];

export type MetadataPropertyType = 'text' | 'list' | 'date' | 'boolean';

export type MetadataPropertyDefinition = {
	key: string;
	label: string;
	type: MetadataPropertyType;
	icon: string;
};

export const METADATA_PROPERTY_DEFINITIONS: MetadataPropertyDefinition[] = [
	{
		key: 'title',
		label: 'title',
		type: 'text',
		icon: 'mdi:format-title'
	},
	{
		key: 'slug',
		label: 'slug',
		type: 'text',
		icon: 'mdi:link-variant'
	},
	{
		key: 'description',
		label: 'description',
		type: 'text',
		icon: 'mdi:text-box-outline'
	},
	{
		key: 'tags',
		label: 'tags',
		type: 'list',
		icon: 'mdi:tag-outline'
	},
	{
		key: 'date',
		label: 'date',
		type: 'date',
		icon: 'mdi:calendar-blank-outline'
	},
	{
		key: 'draft',
		label: 'draft',
		type: 'boolean',
		icon: 'mdi:checkbox-marked-outline'
	}
];

export const DEFAULT_METADATA_PROPERTIES: MetadataProperties = {};

const PROPERTY_DEFINITION_BY_KEY = new Map(
	METADATA_PROPERTY_DEFINITIONS.map((definition) => [definition.key, definition])
);
const LIST_PROPERTIES = new Set(
	METADATA_PROPERTY_DEFINITIONS.filter((definition) => definition.type === 'list').map(
		(definition) => definition.key
	)
);
const BOOLEAN_PROPERTIES = new Set(
	METADATA_PROPERTY_DEFINITIONS.filter((definition) => definition.type === 'boolean').map(
		(definition) => definition.key
	)
);

export function getMetadataPropertyDefinition(key: string): MetadataPropertyDefinition {
	return (
		PROPERTY_DEFINITION_BY_KEY.get(key) ?? {
			key,
			label: key,
			type: inferMetadataPropertyType(key),
			icon: 'mdi:tune-variant'
		}
	);
}

export function inferMetadataPropertyType(key: string): MetadataPropertyType {
	if (LIST_PROPERTIES.has(key)) return 'list';
	if (BOOLEAN_PROPERTIES.has(key)) return 'boolean';
	if (key === 'date' || key.endsWith('date')) return 'date';

	return 'text';
}

// Accepts the canonical entries array or a legacy/interchange record (stored
// notes predating the entries format, parsed YAML frontmatter, ...).
export function normalizeMetadataEntries(value: unknown): MetadataEntry[] {
	if (!value || typeof value !== 'object') return [];

	const rawEntries: [unknown, unknown][] = Array.isArray(value)
		? value.map((item) => {
				const entry = item && typeof item === 'object' ? (item as Partial<MetadataEntry>) : {};

				return [entry.key, entry.value];
			})
		: Object.entries(value);

	const entries: MetadataEntry[] = [];
	const seen = new Set<string>();

	for (const [rawKey, rawValue] of rawEntries) {
		const key = normalizeMetadataPropertyKey(rawKey);
		if (!key || seen.has(key) || !PROPERTY_DEFINITION_BY_KEY.has(key)) continue;

		seen.add(key);
		entries.push({
			key,
			value: normalizeMetadataPropertyValue(rawValue, inferMetadataPropertyType(key))
		});
	}

	return entries;
}

export function metadataEntriesToRecord(entries: MetadataEntry[]): MetadataProperties {
	return Object.fromEntries(entries.map((entry) => [entry.key, entry.value]));
}

export function normalizeMetadataProperties(value: unknown): MetadataProperties {
	return metadataEntriesToRecord(normalizeMetadataEntries(value));
}

export function slugifyText(value: unknown) {
	return String(value ?? '')
		.toLowerCase()
		.trim()
		.replace(/['"`]/g, '')
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '')
		.slice(0, 72);
}

export function normalizeMetadataPropertyKey(value: unknown) {
	return String(value ?? '')
		.trim()
		.replace(/\s+/g, '-')
		.replace(/[^A-Za-z0-9_-]/g, '')
		.slice(0, 64);
}

export function normalizeMetadataPropertyValue(
	value: unknown,
	type: MetadataPropertyType
): MetadataPropertyValue {
	if (type === 'boolean') return value === true || value === 'true';
	if (type === 'list') return normalizeMetadataList(value);

	if (value instanceof Date) return value.toISOString().slice(0, 10);
	if (value === null || value === undefined) return '';
	if (typeof value === 'number' && Number.isFinite(value)) return String(value);
	if (typeof value === 'boolean') return value;

	return String(value).trim();
}

export function normalizeMetadataList(value: unknown) {
	const values = Array.isArray(value) ? value : typeof value === 'string' ? value.split(',') : [];

	return [...new Set(values.map((item) => String(item ?? '').trim()).filter(Boolean))];
}

export function metadataPropertiesAreEmpty(properties: MetadataPropertiesInput) {
	return normalizeMetadataEntries(properties).length === 0;
}
