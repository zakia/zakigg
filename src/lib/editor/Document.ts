/** The complete persisted and transported document. Properties are derived from Markdown. */
export type Document = { id: string; markdown: string };

/** Accept existing version-3 archives as well as the source-only record. */
export function readStoredDocument(value: unknown): Document | null {
	if (!value || typeof value !== 'object') return null;
	const record = value as Partial<Document> & { version?: unknown; format?: unknown };
	if (
		(record.version !== undefined && record.version !== 3) ||
		(record.format !== undefined && record.format !== 'markdown') ||
		typeof record.id !== 'string' ||
		!/^[A-Za-z0-9_-]{1,180}$/.test(record.id) ||
		typeof record.markdown !== 'string'
	)
		return null;
	return { id: record.id, markdown: record.markdown };
}
