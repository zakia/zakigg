export type CodeBlockAttributes = {
	language?: string | null;
	title?: string | null;
};

export type CodeLanguage = {
	value: string;
	label: string;
	shiki: string;
};

export type CodeBlockKeyboardOptions = {
	exitOnTripleEnter?: boolean;
	exitOnArrowDown?: boolean;
	enableTabIndentation?: boolean;
	tabSize?: number;
};

export const DEFAULT_LANGUAGE = 'plaintext';
export const SHIKI_THEME = 'github-light';
export const DEFAULT_TAB_SIZE = 4;

export const CODE_BLOCK_CLASS_NAMES = {
	root: 'code-block',
	header: 'code-block-header',
	title: 'code-block-title',
	controls: 'code-block-controls',
	language: 'code-block-language',
	body: 'code-block-body',
	pre: 'code-block-pre',
	lineNumbers: 'code-block-line-numbers',
	content: 'code-block-content',
	copy: 'code-block-copy',
	copyIcon: 'code-block-copy-icon',
	token: 'code-block-token'
} as const;

const DEFAULT_CODE_LANGUAGE: CodeLanguage = {
	value: DEFAULT_LANGUAGE,
	label: 'Plain Text',
	shiki: 'text'
};

export const CODE_BLOCK_LANGUAGES: CodeLanguage[] = [
	DEFAULT_CODE_LANGUAGE,
	{ value: 'javascript', label: 'JavaScript', shiki: 'javascript' },
	{ value: 'typescript', label: 'TypeScript', shiki: 'typescript' },
	{ value: 'svelte', label: 'Svelte', shiki: 'svelte' },
	{ value: 'html', label: 'HTML', shiki: 'html' },
	{ value: 'css', label: 'CSS', shiki: 'css' },
	{ value: 'json', label: 'JSON', shiki: 'json' },
	{ value: 'bash', label: 'Shell', shiki: 'shellscript' },
	{ value: 'markdown', label: 'Markdown', shiki: 'markdown' },
	{ value: 'python', label: 'Python', shiki: 'python' },
	{ value: 'sql', label: 'SQL', shiki: 'sql' },
	{ value: 'yaml', label: 'YAML', shiki: 'yaml' }
];

const LANGUAGE_MAP = new Map(CODE_BLOCK_LANGUAGES.map((language) => [language.value, language]));

export function normalizeLanguage(language: unknown) {
	const value = typeof language === 'string' ? language.trim().toLowerCase() : '';

	return value && LANGUAGE_MAP.has(value) ? value : DEFAULT_LANGUAGE;
}

export function normalizeCodeBlockAttrs(attributes?: CodeBlockAttributes) {
	return {
		language: normalizeLanguage(attributes?.language),
		title: attributes?.title?.trim() ?? ''
	};
}

export function getCodeLanguage(value: unknown) {
	return LANGUAGE_MAP.get(normalizeLanguage(value)) ?? DEFAULT_CODE_LANGUAGE;
}

export function getCodeLanguageShikiId(value: unknown) {
	return getCodeLanguage(value).shiki;
}
