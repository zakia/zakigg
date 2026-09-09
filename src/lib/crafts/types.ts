export type CraftMeta = {
	title: string;
	description: string;
	tags: string[];
	date: string;
	wordCount?: number;
	draft?: boolean;
	fullBleed?: boolean;
};

export type CraftListItem = {
	id: string;
	slug: string;
	title: string;
	tags: string[];
	date: string;
	wordCount?: number;
};

export type CraftDocument = {
	version: 2;
	format: 'markdown';
	markdown: string;
	updatedAt?: string;
};

export function parseCraftDocument(value: unknown): CraftDocument | null {
	if (!value || typeof value !== 'object') return null;
	const document = value as Partial<CraftDocument>;
	if (
		document.version !== 2 ||
		document.format !== 'markdown' ||
		typeof document.markdown !== 'string'
	) {
		return null;
	}

	return {
		version: 2,
		format: 'markdown',
		markdown: document.markdown,
		...(typeof document.updatedAt === 'string' ? { updatedAt: document.updatedAt } : {})
	};
}
