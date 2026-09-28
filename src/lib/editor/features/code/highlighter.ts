import {
	CODE_BLOCK_CLASS_NAMES,
	CODE_BLOCK_LANGUAGES,
	SHIKI_THEME,
	getCodeLanguageShikiId
} from './config';

export type ShikiToken = {
	content: string;
	offset: number;
	color?: string;
	bgColor?: string;
	fontStyle?: number;
};

type CodeBlockHighlighter = {
	codeToTokensBase: (
		code: string,
		options: {
			lang: string;
			theme: string;
		}
	) => ShikiToken[][];
};

let highlighterPromise: Promise<CodeBlockHighlighter> | null = null;

async function getHighlighter() {
	highlighterPromise ??= import('shiki/bundle/web').then(
		({ getSingletonHighlighter }) =>
			getSingletonHighlighter({
				themes: [SHIKI_THEME],
				langs: CODE_BLOCK_LANGUAGES.map((language) => language.shiki)
			}) as Promise<CodeBlockHighlighter>
	);

	return highlighterPromise;
}

export async function tokenizeCode(code: string, language: unknown) {
	const highlighter = await getHighlighter();

	return highlighter.codeToTokensBase(code, {
		lang: getCodeLanguageShikiId(language),
		theme: SHIKI_THEME
	});
}

export function tokenStyle(token: ShikiToken) {
	const styles: string[] = [];

	if (token.color) styles.push(`color: ${token.color}`);
	if (token.bgColor) styles.push(`background-color: ${token.bgColor}`);
	if (token.fontStyle) {
		if (token.fontStyle & 1) styles.push('font-style: italic');
		if (token.fontStyle & 2) styles.push('font-weight: 700');
		if (token.fontStyle & 4) styles.push('text-decoration: underline');
	}

	return styles.join('; ');
}

export async function highlightCodeToHtml(code: string, language: unknown) {
	try {
		return tokensToHtml(await tokenizeCode(code, language));
	} catch {
		return escapeHtml(code);
	}
}

function tokensToHtml(lines: ShikiToken[][]) {
	return lines
		.map((line) =>
			line
				.map((token) => {
					const content = escapeHtml(token.content);
					const style = tokenStyle(token);

					if (!style) return content;

					return `<span class="${CODE_BLOCK_CLASS_NAMES.token}" style="${escapeAttribute(style)}">${content}</span>`;
				})
				.join('')
		)
		.join('\n');
}

function escapeHtml(value: string) {
	return value
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&#39;');
}

function escapeAttribute(value: string) {
	return escapeHtml(value).replace(/`/g, '&#96;');
}
