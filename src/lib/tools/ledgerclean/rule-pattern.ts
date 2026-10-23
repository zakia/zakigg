import { RE2JS } from 're2js';

const cache = new Map<string, RE2JS>();
function compile(pattern: string) {
	if (!pattern.trim()) throw new Error('Enter a matching pattern.');
	if (pattern.length > 500) throw new Error('Keep the pattern under 500 characters.');
	let compiled = cache.get(pattern);
	if (!compiled) {
		compiled = RE2JS.compile(pattern, RE2JS.CASE_INSENSITIVE);
		if (cache.size >= 100) cache.delete(cache.keys().next().value!);
		cache.set(pattern, compiled);
	}
	return compiled;
}

/** The same linear-time regex engine validates, previews and applies user patterns. */
export function patternError(pattern: string, match?: string): string {
	if (!pattern.trim()) return 'Enter a matching pattern.';
	if (match !== 'regex') return '';
	try {
		compile(pattern);
		return '';
	} catch (cause) {
		return `Invalid regex: ${cause instanceof Error ? cause.message : 'Unsupported pattern.'}`;
	}
}
export function regexMatches(pattern: string, text: string): boolean {
	try {
		return compile(pattern).matcher(text).find();
	} catch {
		return false;
	}
}
