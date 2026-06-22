<script lang="ts">
	import type { Node as ProseMirrorNode } from '@tiptap/pm/model';
	import type { Readable } from 'svelte/store';
	import type {
		ComponentEmbedField,
		ComponentEmbedRegistry,
		RegisteredComponentEmbed
	} from './registry';

	type UpdateResult = { ok: true } | { ok: false; message: string };

	type Props = {
		node: Readable<ProseMirrorNode>;
		registry: ComponentEmbedRegistry;
		updateProps: (props: Record<string, unknown>) => UpdateResult;
		setEditing: (editing: boolean, props?: Record<string, unknown>) => UpdateResult;
	};

	let { node, registry, updateProps, setEditing }: Props = $props();
	let editError = $state('');

	const embed = $derived(registry.parseAttrs($node.attrs));
	const fields = $derived(embed.ok ? getFieldEntries(embed.entry) : []);
	const editing = $derived(Boolean($node.attrs.editing));

	function getFieldEntries(entry: RegisteredComponentEmbed) {
		return Object.entries(entry.fields ?? {});
	}

	function getFieldValue(name: string, field: ComponentEmbedField) {
		const value = embed.ok ? embed.props[name] : undefined;

		if (field.control === 'datetime-local' && typeof value === 'string') {
			return toDateTimeLocalValue(value);
		}

		if (field.control === 'json') {
			return JSON.stringify(value ?? null, null, 2);
		}

		if (typeof value === 'boolean') return value ? 'true' : 'false';
		if (typeof value === 'number' || typeof value === 'string') return String(value);

		return '';
	}

	function getCheckedValue(name: string) {
		return embed.ok && embed.props[name] === true;
	}

	function updateField(name: string, field: ComponentEmbedField, rawValue: string | boolean) {
		if (!embed.ok) return;

		const nextValue = parseFieldValue(field, rawValue);

		if (!nextValue.ok) {
			editError = nextValue.message;
			return;
		}

		const result = updateProps({
			...embed.props,
			[name]: nextValue.value
		});

		editError = result.ok ? '' : result.message;
	}

	function commitEditing() {
		if (!embed.ok) return;

		const result = registry.parseProps(embed.entry.id, embed.props);

		if (!result.ok) {
			editError = result.message;
			return;
		}

		const updateResult = setEditing(false, result.props);
		editError = updateResult.ok ? '' : updateResult.message;
	}

	function editAgain() {
		const result = setEditing(true);
		editError = result.ok ? '' : result.message;
	}

	function handleSetupKeydown(event: KeyboardEvent) {
		if (event.key !== 'Enter' || event.shiftKey) return;

		event.preventDefault();
		commitEditing();
	}

	function parseFieldValue(field: ComponentEmbedField, value: string | boolean) {
		if (field.control === 'toggle') {
			return { ok: true as const, value: Boolean(value) };
		}

		if (typeof value !== 'string') {
			return { ok: true as const, value };
		}

		if (field.control === 'number') {
			const numberValue = Number(value);

			return Number.isFinite(numberValue)
				? { ok: true as const, value: numberValue }
				: { ok: false as const, message: 'Enter a valid number.' };
		}

		if (field.control === 'datetime-local') {
			const date = new Date(value);

			return Number.isFinite(date.getTime())
				? { ok: true as const, value: date.toISOString() }
				: { ok: false as const, message: 'Enter a valid date and time.' };
		}

		if (field.control === 'json') {
			try {
				return { ok: true as const, value: JSON.parse(value) as unknown };
			} catch {
				return { ok: false as const, message: 'Enter valid JSON.' };
			}
		}

		return { ok: true as const, value };
	}

	function toDateTimeLocalValue(value: string) {
		const date = new Date(value);

		if (!Number.isFinite(date.getTime())) return '';

		const offsetDate = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);

		return offsetDate.toISOString().slice(0, 16);
	}
</script>

<div class:editing class="component-embed-shell" data-component-embed-controls>
	{#if embed.ok}
		{@const Component = embed.entry.component}

		{#if editing && fields.length}
			<form class="component-embed-setup" onsubmit={(event) => event.preventDefault()}>
				{#each fields as [name, field] (name)}
					{#if field.control === 'textarea' || field.control === 'json'}
						<textarea
							aria-label={field.label ?? name}
							value={getFieldValue(name, field)}
							rows={field.control === 'json' ? 4 : 2}
							oninput={(event) => updateField(name, field, event.currentTarget.value)}
							onkeydown={handleSetupKeydown}
						></textarea>
					{:else if field.control === 'toggle'}
						<input
							aria-label={field.label ?? name}
							type="checkbox"
							checked={getCheckedValue(name)}
							onchange={(event) => updateField(name, field, event.currentTarget.checked)}
							onkeydown={handleSetupKeydown}
						/>
					{:else if field.control === 'select'}
						<select
							aria-label={field.label ?? name}
							value={getFieldValue(name, field)}
							onchange={(event) => updateField(name, field, event.currentTarget.value)}
							onkeydown={handleSetupKeydown}
						>
							{#each field.options ?? [] as option (option)}
								<option value={option}>{option}</option>
							{/each}
						</select>
					{:else}
						<input
							aria-label={field.label ?? name}
							type={field.control === 'number'
								? 'number'
								: field.control === 'datetime-local'
									? 'datetime-local'
									: 'text'}
							value={getFieldValue(name, field)}
							oninput={(event) => updateField(name, field, event.currentTarget.value)}
							onkeydown={handleSetupKeydown}
						/>
					{/if}
				{/each}
			</form>

			{#if editError}
				<p class="component-embed-error">{editError}</p>
			{/if}
		{:else}
			<div class="component-embed-output">
				<Component {...embed.props} />
				{#if fields.length}
					<button type="button" class="component-embed-edit" onclick={editAgain}> Edit </button>
				{/if}
			</div>
		{/if}
	{:else}
		<div class="component-embed-missing">
			<span>Component unavailable</span>
			<small>{embed.message}</small>
		</div>
	{/if}
</div>

<style>
	.component-embed-shell {
		display: inline-grid;
		margin-block: var(--s-3);
		max-width: 100%;
		vertical-align: middle;
		width: fit-content;
	}

	.component-embed-shell.editing {
		gap: var(--s-4);
	}

	.component-embed-setup,
	.component-embed-output {
		align-items: center;
		display: flex;
	}

	.component-embed-setup {
		gap: var(--s-3);
		width: fit-content;
	}

	input,
	select,
	textarea {
		background: var(--base-1);
		border: 1px solid color-mix(in oklch, var(--edge) 84%, transparent);
		border-radius: var(--s-5);
		color: var(--content);
		font: inherit;
		font-size: var(--s-2);
		line-height: 1.1;
		max-width: min(14rem, 72vw);
		min-width: 0;
		padding: 0.2rem var(--s-3);
	}

	input[type='checkbox'] {
		height: 1rem;
		width: 1rem;
	}

	textarea {
		resize: vertical;
	}

	input:focus,
	select:focus,
	textarea:focus {
		border-color: var(--brand);
		box-shadow: 0 0 0 2px color-mix(in oklch, var(--brand) 18%, transparent);
		outline: none;
	}

	button,
	.component-embed-output {
		align-items: center;
		display: inline-flex;
	}

	.component-embed-output {
		gap: var(--s-3);
		max-width: 100%;
		width: fit-content;
	}

	.component-embed-edit {
		background: transparent;
		border-radius: var(--s-5);
		color: color-mix(in oklch, var(--content-1) 72%, transparent);
		font-size: var(--s-2);
		font-weight: 600;
		line-height: 1;
		opacity: 0.58;
		padding: var(--s-5) var(--s-4);
		transition:
			background-color 0.16s,
			color 0.16s,
			opacity 0.16s;
	}

	.component-embed-edit:hover,
	.component-embed-edit:focus-visible {
		background: color-mix(in oklch, var(--content) 8%, transparent);
		color: var(--content);
		opacity: 1;
		outline: none;
	}

	.component-embed-error,
	.component-embed-missing {
		color: var(--error);
		font-size: var(--s-1);
		margin: 0;
	}

	.component-embed-missing {
		display: grid;
		gap: var(--s-5);
	}

	.component-embed-missing small {
		color: var(--content-1);
	}

	@media (max-width: 42rem) {
		.component-embed-setup {
			align-items: flex-start;
			flex-direction: column;
		}
	}
</style>
