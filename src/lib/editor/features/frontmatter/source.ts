import { isMap, parseDocument } from 'yaml';

export type FrontmatterRange = {
	yamlFrom: number;
	yamlTo: number;
	fenceTo: number;
	bodyFrom: number;
};

export type FrontmatterValue = string | number | boolean | string[];

function sourceNewline(source: string) {
	return source.includes('\r\n') ? '\r\n' : '\n';
}

function withSourceNewlines(value: string, source: string) {
	return value.replace(/\r?\n/g, sourceNewline(source));
}

export function hasFrontmatterStart(source: string) {
	return /^\uFEFF?---[ \t]*\r?\n/.test(source);
}

export function frontmatterRange(source: string): FrontmatterRange | null {
	const match = /^(?:\uFEFF?---[ \t]*\r?\n)([\s\S]*?)(\r?\n---[ \t]*)(?:\r?\n(?:\r?\n)?|$)/.exec(
		source
	);
	if (!match) return null;
	const yamlFrom = match[0].indexOf('\n') + 1;
	const yamlTo = yamlFrom + match[1].length;
	return { yamlFrom, yamlTo, fenceTo: yamlTo + match[2].length, bodyFrom: match[0].length };
}

export function readFrontmatter(source: string) {
	const range = frontmatterRange(source);
	if (!range)
		return {
			range: null,
			values: null,
			error: hasFrontmatterStart(source) ? 'Missing closing --- fence.' : 'Frontmatter is missing.'
		};
	const document = parseDocument(source.slice(range.yamlFrom, range.yamlTo), { uniqueKeys: true });
	if (document.errors.length || (document.contents && !isMap(document.contents))) {
		return {
			range,
			values: null,
			error: document.errors[0]?.message ?? 'Frontmatter must be a YAML object.'
		};
	}
	try {
		const values = document.toJS() as Record<string, unknown> | null;
		const error = validateKnownProperties(values ?? {});
		if (error) return { range, values: null, error };
		return { range, values: values ?? {}, error: null };
	} catch (error) {
		return {
			range,
			values: null,
			error: error instanceof Error ? error.message : 'Invalid YAML frontmatter.'
		};
	}
}

function validateKnownProperties(values: Record<string, unknown>) {
	for (const key of ['id', 'title', 'slug', 'description']) {
		if (values[key] != null && typeof values[key] !== 'string') return `${key} must be text.`;
	}
	if (
		values.date != null &&
		(typeof values.date !== 'string' ||
			(values.date !== '' && !/^\d{4}-\d{2}-\d{2}$/.test(values.date)))
	)
		return 'date must use YYYY-MM-DD.';
	if (
		values.tags != null &&
		(!Array.isArray(values.tags) || !values.tags.every((value) => typeof value === 'string'))
	)
		return 'tags must be a list of text values.';
	for (const key of ['published', 'draft']) {
		if (values[key] != null && typeof values[key] !== 'boolean')
			return `${key} must be true or false.`;
	}
	return null;
}

export function updateFrontmatterValue(source: string, key: string, value: FrontmatterValue) {
	const range = frontmatterRange(source);
	if (!range) {
		const document = parseDocument('');
		document.set(key, value);
		return {
			from: 0,
			to: 0,
			insert: withSourceNewlines(`---\n${document.toString().trimEnd()}\n---\n\n`, source)
		};
	}
	if (readFrontmatter(source).error) return null;
	const document = parseDocument(source.slice(range.yamlFrom, range.yamlTo), {
		uniqueKeys: true
	});
	if (document.errors.length || (document.contents && !isMap(document.contents))) return null;
	document.set(key, value);
	if (key === 'published') document.delete('draft');
	const insert = withSourceNewlines(document.toString({ lineWidth: 0 }).trimEnd(), source);
	if (insert === source.slice(range.yamlFrom, range.yamlTo)) return null;
	return { from: range.yamlFrom, to: range.yamlTo, insert };
}
