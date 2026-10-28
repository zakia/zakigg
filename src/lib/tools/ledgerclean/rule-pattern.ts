import { RE2JS } from 're2js';

const cache = new Map<string, RE2JS>();
function compile(pattern: string, limit = 500) {
	if (!pattern.trim()) throw new Error('Enter a matching pattern.');
	if (pattern.length > limit) throw new Error('Keep the pattern under 500 characters.');
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
	if (pattern.length > 500) return 'Keep the pattern under 500 characters.';
	if (match !== 'regex' && match !== 'words') return '';
	try {
		if (match === 'words') {
			const generated = wordPattern(pattern);
			if (!generated) return 'Enter at least one word or phrase.';
			compile(generated, 1100);
		} else compile(pattern);
		return '';
	} catch (cause) {
		return `Invalid regex: ${cause instanceof Error ? cause.message : 'Unsupported pattern.'}`;
	}
}

/** Unicode word edges keep BAR out of BARBER and allow accented words such as CAFÉ. */
function wordPattern(value: string): string {
	const words = value
		.split(',')
		.map((word) => word.trim().replace(/\s+/g, ' '))
		.filter(Boolean);
	if (!words.length) return '';
	const escaped = words.map((word) => word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
	return `(?:^|[^\\p{L}\\p{N}_])(?:${escaped.join('|')})(?:$|[^\\p{L}\\p{N}_])`;
}

export function wordsMatch(words: string, text: string): boolean {
	if (words.length > 500) return false;
	const pattern = wordPattern(words);
	try {
		return !!pattern && compile(pattern, 1100).matcher(text).find();
	} catch {
		return false;
	}
}
export function regexMatches(pattern: string, text: string): boolean {
	try {
		return compile(pattern).matcher(text).find();
	} catch {
		return false;
	}
}
