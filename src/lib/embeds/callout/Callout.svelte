<script lang="ts">
	import CraftDocumentRenderer from '$lib/crafts/CraftDocumentRenderer.svelte';
	import type { CalloutProps } from './embed';

	let {
		kind,
		markdown,
		editing = false,
		updateProps
	}: CalloutProps & {
		editing?: boolean;
		updateProps?: (props: Record<string, unknown>) => void;
	} = $props();
</script>

<aside class={`callout callout-${kind}`} aria-label={kind}>
	<strong>{kind}</strong>
	<div class="callout-content">
		<CraftDocumentRenderer document={{ version: 2, format: 'markdown', markdown }} />
	</div>
	{#if editing && updateProps}
		<div class="callout-editor">
			<label>
				<span>Type</span>
				<select
					value={kind}
					onchange={(event) => updateProps({ kind: event.currentTarget.value, markdown })}
				>
					<option value="note">Note</option>
					<option value="tip">Tip</option>
					<option value="important">Important</option>
					<option value="warning">Warning</option>
					<option value="caution">Caution</option>
				</select>
			</label>
			<label>
				<span>Markdown</span>
				<textarea
					value={markdown}
					oninput={(event) => updateProps({ kind, markdown: event.currentTarget.value })}
				></textarea>
			</label>
		</div>
	{/if}
</aside>

<style>
	.callout {
		--callout-color: var(--brand);
		background: color-mix(in oklch, var(--callout-color) 8%, var(--base-1));
		border: 1px solid color-mix(in oklch, var(--callout-color) 34%, var(--edge));
		border-left: 0.24rem solid var(--callout-color);
		border-radius: var(--s-3);
		display: grid;
		gap: var(--s-2);
		margin: var(--s1) 0;
		padding: var(--s0);
	}

	.callout-warning,
	.callout-caution {
		--callout-color: var(--warning, #c88000);
	}

	.callout-important {
		--callout-color: #8b5cf6;
	}

	.callout > strong {
		color: var(--callout-color);
		font-size: var(--s-2);
		letter-spacing: 0.04em;
		text-transform: uppercase;
	}

	.callout-content :global(.content > :first-child) {
		margin-top: 0;
	}

	.callout-editor {
		border-top: 1px solid color-mix(in oklch, var(--callout-color) 25%, var(--edge));
		display: grid;
		gap: var(--s-2);
		padding-top: var(--s-2);
	}

	.callout-editor label {
		display: grid;
		gap: var(--s-4);
	}

	.callout-editor span {
		color: var(--content-1);
		font-size: var(--s-2);
		font-weight: 700;
	}

	.callout-editor select,
	.callout-editor textarea {
		background: var(--base-2);
		border: 1px solid var(--edge);
		border-radius: var(--s-3);
		color: var(--content);
		font: inherit;
		padding: var(--s-2);
	}

	.callout-editor textarea {
		font-family: var(--font-mono, monospace);
		min-height: 6rem;
		resize: vertical;
	}
</style>
