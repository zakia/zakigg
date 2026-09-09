export type SearchableSlashMenuItem = {
	label: string;
	description: string;
	keywords: readonly string[];
};

export function filterSlashMenuItems<T extends SearchableSlashMenuItem>(
	items: T[],
	filter: string
) {
	const query = filter.trim().toLowerCase();
	if (!query) return items;

	return items.filter(
		(item) =>
			item.label.toLowerCase().includes(query) ||
			item.description.toLowerCase().includes(query) ||
			item.keywords.some((keyword) => keyword.toLowerCase().startsWith(query))
	);
}
