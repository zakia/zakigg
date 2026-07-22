import type { JSONContent } from '@tiptap/core';
import type { Component } from 'svelte';
import * as v from 'valibot';

export type EmbedComponent = Component<Record<string, unknown>>;

export type ComponentEmbedAttrs = {
	component: string;
	props: Record<string, unknown>;
};

export type ComponentEmbedField = {
	label?: string;
	control?: 'text' | 'textarea' | 'number' | 'toggle' | 'select' | 'datetime-local' | 'json';
	description?: string;
	options?: readonly string[];
};

export type ComponentEmbedConfig<TSchema extends v.GenericSchema = v.GenericSchema> = {
	id: string;
	label: string;
	icon?: string;
	props: TSchema;
	fields?: Record<string, ComponentEmbedField>;
	initialProps?: () => v.InferInput<TSchema>;
	insertable?: boolean;
	crafts?: readonly string[];
};

export type RegisteredComponentEmbed<TSchema extends v.GenericSchema = v.GenericSchema> =
	ComponentEmbedConfig<TSchema> & {
		load: () => Promise<EmbedComponent>;
	};

export type ComponentEmbedRegistry = ReturnType<typeof createComponentEmbedRegistry>;

export type ComponentEmbedInsertContext = {
	craftSlug?: string;
};

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

export function registerComponentEmbed<
	TSchema extends v.GenericSchema,
	TProps extends Record<string, unknown>
>(
	component: Component<TProps>,
	config: ComponentEmbedConfig<TSchema>
): RegisteredComponentEmbed<TSchema> {
	return {
		...config,
		fields: deriveEmbedFields(config),
		load: () => Promise.resolve(component as unknown as EmbedComponent)
	};
}

// Lazy registration: the component module is only downloaded when a document
// actually renders the embed, so heavy embeds cost nothing at page load.
export function registerLazyComponentEmbed<TSchema extends v.GenericSchema>(
	load: () => Promise<{ default: unknown }>,
	config: ComponentEmbedConfig<TSchema>
): RegisteredComponentEmbed<TSchema> {
	return {
		...config,
		fields: deriveEmbedFields(config),
		load: async () => (await load()).default as EmbedComponent
	};
}

export function createComponentEmbedRegistry(entries: RegisteredComponentEmbed[]) {
	const byId = new Map(entries.map((entry) => [entry.id, entry]));
	const componentCache = new Map<string, Promise<EmbedComponent>>();

	return {
		all: entries,
		insertable: (context: ComponentEmbedInsertContext = {}) =>
			entries.filter((entry) => isInsertableEntry(entry, context)),
		get: (id: string) => byId.get(id),
		resolveComponent: (id: string) => resolveEmbedComponent(byId, componentCache, id),
		createNode: (id: string, inputProps?: unknown) =>
			createComponentEmbedNode(byId, id, inputProps),
		parseProps: (id: string, inputProps: unknown) => parseComponentEmbedProps(byId, id, inputProps),
		parseAttrs: (attrs: unknown) => parseComponentEmbedAttrs(byId, attrs),
		validateDocument: (content: JSONContent) => validateComponentEmbeds(byId, content)
	};
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

// The valibot props schema IS the embed contract: edit-mode form controls are
// derived from it (string -> text, number -> number, boolean -> toggle,
// picklist -> select), and `config.fields` only refines labels/controls.
function deriveEmbedFields(
	config: ComponentEmbedConfig<v.GenericSchema>
): Record<string, ComponentEmbedField> {
	const schema = config.props as { type?: string; entries?: Record<string, unknown> };

	if (schema.type !== 'object' || !schema.entries) return config.fields ?? {};

	const derived: Record<string, ComponentEmbedField> = {};

	for (const [name, entrySchema] of Object.entries(schema.entries)) {
		derived[name] = {
			control: deriveFieldControl(unwrapSchema(entrySchema)),
			...deriveFieldOptions(unwrapSchema(entrySchema)),
			...config.fields?.[name]
		};
	}

	// Keep any extra field definitions that have no schema entry.
	for (const [name, field] of Object.entries(config.fields ?? {})) {
		derived[name] ??= field;
	}

	return derived;
}

function unwrapSchema(schema: unknown): { type?: string; options?: readonly string[] } {
	let current = schema as { type?: string; wrapped?: unknown; options?: readonly string[] };

	while (
		current &&
		(current.type === 'optional' ||
			current.type === 'nullable' ||
			current.type === 'nullish' ||
			current.type === 'exact_optional' ||
			current.type === 'fallback')
	) {
		current = current.wrapped as typeof current;
	}

	return current ?? {};
}

function deriveFieldControl(schema: {
	type?: string;
	options?: readonly string[];
}): NonNullable<ComponentEmbedField['control']> {
	switch (schema.type) {
		case 'string':
			return 'text';
		case 'number':
			return 'number';
		case 'boolean':
			return 'toggle';
		case 'picklist':
		case 'enum':
			return 'select';
		default:
			return 'json';
	}
}

function deriveFieldOptions(schema: { type?: string; options?: readonly unknown[] }) {
	if ((schema.type !== 'picklist' && schema.type !== 'enum') || !schema.options) return {};

	return { options: schema.options.map(String) };
}

function isInsertableEntry(entry: RegisteredComponentEmbed, context: ComponentEmbedInsertContext) {
	if (entry.insertable === false) return false;
	if (!entry.crafts?.length) return true;

	return Boolean(context.craftSlug && entry.crafts.includes(context.craftSlug));
}

function createComponentEmbedNode(
	entries: Map<string, RegisteredComponentEmbed>,
	id: string,
	inputProps?: unknown
):
	| {
			ok: true;
			node: JSONContent;
			props: Record<string, unknown>;
	  }
	| {
			ok: false;
			message: string;
	  } {
	const entry = entries.get(id);

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
				props: result.props
			} satisfies ComponentEmbedAttrs
		}
	};
}

function parseComponentEmbedAttrs(
	entries: Map<string, RegisteredComponentEmbed>,
	attrs: unknown
): ComponentEmbedResult {
	if (!attrs || typeof attrs !== 'object') {
		return { ok: false, message: 'Component embed is missing attrs.' };
	}

	const { component, props } = attrs as Partial<ComponentEmbedAttrs>;

	if (!component || typeof component !== 'string') {
		return { ok: false, message: 'Component embed is missing a component id.' };
	}

	const entry = entries.get(component);

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
	entries: Map<string, RegisteredComponentEmbed>,
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
	const entry = entries.get(id);

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
	entries: Map<string, RegisteredComponentEmbed>,
	content: JSONContent
) {
	const issues: ComponentEmbedValidationIssue[] = [];
	visitNode(content, 'doc', (node, path) => {
		if (node.type !== 'componentEmbed') return;

		const result = parseComponentEmbedAttrs(entries, node.attrs);

		if (!result.ok) {
			issues.push({
				path,
				message: result.message
			});
		}
	});

	return issues;
}

function visitNode(
	node: JSONContent,
	path: string,
	visit: (node: JSONContent, path: string) => void
) {
	visit(node, path);
	node.content?.forEach((child, index) => {
		visitNode(child, `${path}.content.${index}`, visit);
	});
}
