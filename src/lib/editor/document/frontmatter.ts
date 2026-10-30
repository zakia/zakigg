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
			error: hasFrontmatterStart(source) ? 'Missing closing --- fence.' : null
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
		return { range, values: values ?? {}, error: null };
	} catch (error) {
		return {
			range,
			values: null,
			error: error instanceof Error ? error.message : 'Invalid YAML frontmatter.'
		};
	}
}

export function updateFrontmatterValue(
	source: string,
	key: string,
	value: FrontmatterValue,
	removeKeys: readonly string[] = []
) {
	const range = frontmatterRange(source);
	if (!range) {
		if (hasFrontmatterStart(source)) return null;
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
	for (const name of removeKeys) document.delete(name);
	const insert = withSourceNewlines(document.toString({ lineWidth: 0 }).trimEnd(), source);
	if (insert === source.slice(range.yamlFrom, range.yamlTo)) return null;
	return { from: range.yamlFrom, to: range.yamlTo, insert };
}
