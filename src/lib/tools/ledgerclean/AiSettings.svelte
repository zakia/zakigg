<script lang="ts">
	import LocalAiButton from './LocalAiButton.svelte';
	import { localAi } from './local-ai.svelte';
	import type { AiSettings } from './workspace-storage';
	let { settings, onChange }: { settings: AiSettings; onChange: (settings: AiSettings) => void } =
		$props();
	let error = $state('');
	async function remove() {
		try {
			await localAi.removeDownload();
			onChange({ enabled: false });
		} catch {
			error = 'Could not remove the download. Try again.';
		}
	}
</script>

<section aria-labelledby="local-ai-title">
	<h3 id="local-ai-title">Local AI</h3>
	<p>Classifies into your existing categories on this device. No account or API key.</p>
	<LocalAiButton
		enabled={settings.enabled}
		label={localAi.status === 'ready' ? 'Local AI ready' : 'Load local AI'}
		disabled={localAi.status === 'ready'}
		onEnabled={() => onChange({ enabled: true })}
	/>
	{#if settings.enabled}<button class="quiet" type="button" onclick={remove}
			>Remove model download</button
		>{/if}
	{#if error}<p role="alert">{error}</p>{/if}
</section>

<style>
	section {
		font-size: 0.85rem;
	}
	h3 {
		font-size: 1rem;
	}
	p {
		color: var(--content-1);
		line-height: 1.6;
	}
	button {
		font: inherit;
		padding: 0.5rem 0.8rem;
		background: transparent;
		border: 0;
		color: var(--content-1);
		cursor: pointer;
	}
</style>
