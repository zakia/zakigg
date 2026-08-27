import type { Component } from 'svelte';
import * as v from 'valibot';

export type EditorDocumentNode = {
	type?: string;
	attrs?: Record<string, unknown>;
	content?: EditorDocumentNode[];
};

export type EmbedComponent = Component<Record<string, unknown>>;

export type ComponentField =
	| {
			name: string;
			label: string;
			type: 'text' | 'textarea' | 'number' | 'boolean';
			placeholder?: string;
	  }
	| {
			name: string;
			label: string;
			type: 'select';
			options: readonly { label: string; value: string }[];
	  };

export type ComponentEmbedAttrs = {
	component: string;
	markdownName?: string;
	props: Record<string, unknown>;
	childrenMarkdown?: string;
};

// Every discoverable component declares its complete authoring contract in its
// own folder. The catalog and slash menu are derived from these definitions.
export type ComponentEmbedDefinition<TSchema extends v.GenericSchema = v.GenericSchema> = {
	id: string;
	// Stable author-facing tag used in Markdown, for example `Timer` in
	// `<Timer endIsoTimestamp="…" />`. Persistence never exposes internal ids.
	markdownName?: string;
	label: string;
	description: string;
	icon?: string;
	editLabel?: string;
	keywords?: readonly string[];
	fields: readonly ComponentField[];
	props: TSchema;
	initialProps?: () => v.InferInput<TSchema>;
	insertable?: boolean;
	load: () => Promise<{ default: unknown }>;
};

export type RegisteredComponentEmbed<TSchema extends v.GenericSchema = v.GenericSchema> = Omit<
	ComponentEmbedDefinition<TSchema>,
	'markdownName' | 'load'
> & {
	markdownName: string;
	load: () => Promise<EmbedComponent>;
};

export type ComponentEmbedRegistry = ReturnType<typeof createComponentEmbedRegistry>;

export type ComponentEmbedResult =
	| {
			ok: true;
			entry: RegisteredComponentEmbed;
			props: Record<string, unknown>;
	  }
	| {
			ok: false;
			message: string;
	  };

export type ComponentEmbedValidationIssue = {
	path: string;
	message: string;
};

export function defineComponentEmbed<TSchema extends v.GenericSchema>(
	definition: ComponentEmbedDefinition<TSchema>
): ComponentEmbedDefinition<TSchema> {
	return definition;
}

function registerComponentEmbed<TSchema extends v.GenericSchema>(
	definition: ComponentEmbedDefinition<TSchema>
): RegisteredComponentEmbed<TSchema> {
	return {
		...definition,
		markdownName: definition.markdownName ?? componentNameFromId(definition.id),
		load: async () => (await definition.load()).default as EmbedComponent
	};
}

export function createComponentEmbedRegistry(definitions: readonly ComponentEmbedDefinition[]) {
	const entries = definitions.map(registerComponentEmbed);
	assertUniqueEntries(entries);
	const byId = new Map(entries.map((entry) => [entry.id, entry]));
	const byMarkdownName = new Map(entries.map((entry) => [entry.markdownName, entry]));
	const componentCache = new Map<string, Promise<EmbedComponent>>();
	const getEntry = (value: string) => byId.get(value) ?? byMarkdownName.get(value);

	return {
		all: entries,
		insertable: () => entries.filter((entry) => entry.insertable !== false),
		get: getEntry,
		getByMarkdownName: (name: string) => byMarkdownName.get(name),
		resolveComponent: (id: string) => resolveEmbedComponent(byId, componentCache, id),
		createNode: (id: string, inputProps?: unknown) =>
			createComponentEmbedNode(getEntry, id, inputProps),
		parseProps: (id: string, inputProps: unknown) =>
			parseComponentEmbedProps(getEntry, id, inputProps),
		parseAttrs: (attrs: unknown) => parseComponentEmbedAttrs(getEntry, attrs),
		validateDocument: (content: EditorDocumentNode) => validateComponentEmbeds(getEntry, content)
	};
}

function assertUniqueEntries(entries: readonly RegisteredComponentEmbed[]) {
	const ids = new Set<string>();
	const markdownNames = new Set<string>();

	for (const entry of entries) {
		if (ids.has(entry.id)) throw new Error(`Duplicate component id: ${entry.id}`);
		if (markdownNames.has(entry.markdownName)) {
			throw new Error(`Duplicate component Markdown name: ${entry.markdownName}`);
		}
		ids.add(entry.id);
		markdownNames.add(entry.markdownName);
	}
}

function resolveEmbedComponent(
	entries: Map<string, RegisteredComponentEmbed>,
	cache: Map<string, Promise<EmbedComponent>>,
	id: string
): Promise<EmbedComponent> {
	const entry = entries.get(id);

	if (!entry) return Promise.reject(new Error(`Unknown component embed: ${id}`));

	let pending = cache.get(id);

	if (!pending) {
		pending = entry.load();
		// A failed load should retry on the next render, not cache the error.
		pending.catch(() => cache.delete(id));
		cache.set(id, pending);
	}

	return pending;
}

function createComponentEmbedNode(
	getEntry: (id: string) => RegisteredComponentEmbed | undefined,
	id: string,
	inputProps?: unknown
):
	| {
			ok: true;
			node: EditorDocumentNode;
			props: Record<string, unknown>;
	  }
	| {
			ok: false;
			message: string;
	  } {
	const entry = getEntry(id);

	if (!entry) {
		return { ok: false, message: `Unknown component embed: ${id}` };
	}

	const propsInput = inputProps ?? entry.initialProps?.() ?? {};
	const result = parseProps(entry, propsInput);

	if (!result.ok) return result;

	return {
		ok: true,
		props: result.props,
		node: {
			type: 'componentEmbed',
			attrs: {
				component: entry.id,
				markdownName: entry.markdownName,
				props: result.props
			} satisfies ComponentEmbedAttrs
		}
	};
}

function parseComponentEmbedAttrs(
	getEntry: (id: string) => RegisteredComponentEmbed | undefined,
	attrs: unknown
): ComponentEmbedResult {
	if (!attrs || typeof attrs !== 'object') {
		return { ok: false, message: 'Component embed is missing attrs.' };
	}

	const { component, props } = attrs as Partial<ComponentEmbedAttrs>;

	if (!component || typeof component !== 'string') {
		return { ok: false, message: 'Component embed is missing a component id.' };
	}

	const entry = getEntry(component);

	if (!entry) {
		return { ok: false, message: `Unknown component embed: ${component}` };
	}

	const result = parseProps(entry, props ?? {});

	if (!result.ok) return result;

	return {
		ok: true,
		entry,
		props: result.props
	};
}

function parseProps(entry: RegisteredComponentEmbed, input: unknown) {
	const result = v.safeParse(entry.props, input);

	if (!result.success) {
		return {
			ok: false as const,
			message: summarizeIssues(result.issues)
		};
	}

	return {
		ok: true as const,
		props: normalizeParsedProps(result.output)
	};
}

function parseComponentEmbedProps(
	getEntry: (id: string) => RegisteredComponentEmbed | undefined,
	id: string,
	input: unknown
):
	| {
			ok: true;
			entry: RegisteredComponentEmbed;
			props: Record<string, unknown>;
	  }
	| {
			ok: false;
			message: string;
	  } {
	const entry = getEntry(id);

	if (!entry) {
		return { ok: false, message: `Unknown component embed: ${id}` };
	}

	const result = parseProps(entry, input);

	if (!result.ok) return result;

	return {
		ok: true,
		entry,
		props: result.props
	};
}

function normalizeParsedProps(value: unknown): Record<string, unknown> {
	if (!value || typeof value !== 'object' || Array.isArray(value)) return {};

	return value as Record<string, unknown>;
}

function summarizeIssues(issues: readonly v.GenericIssue[]) {
	return issues
		.map((issue) => {
			const path = issue.path?.map((part) => String(part.key)).join('.');
			return path ? `${path}: ${issue.message}` : issue.message;
		})
		.join('; ');
}

function validateComponentEmbeds(
	getEntry: (id: string) => RegisteredComponentEmbed | undefined,
	content: EditorDocumentNode
) {
	const issues: ComponentEmbedValidationIssue[] = [];
	visitNode(content, 'doc', (node, path) => {
		if (node.type !== 'componentEmbed') return;

		const result = parseComponentEmbedAttrs(getEntry, node.attrs);

		if (!result.ok) {
			issues.push({
				path,
				message: result.message
			});
		}
	});

	return issues;
}

function componentNameFromId(value: string) {
	const parts = value.split(/[^A-Za-z0-9]+/).filter(Boolean);
	const last = parts.at(-1) ?? '';

	if (value.startsWith('core.') && /^[A-Z]/.test(last)) return last;

	return parts.map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`).join('');
}

function visitNode(
	node: EditorDocumentNode,
	path: string,
	visit: (node: EditorDocumentNode, path: string) => void
) {
	visit(node, path);
	node.content?.forEach((child, index) => {
		visitNode(child, `${path}.content.${index}`, visit);
	});
}
