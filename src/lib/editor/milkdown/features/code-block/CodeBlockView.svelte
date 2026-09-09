<script lang="ts">
	import type { CodeBlockState } from './code-block-state.svelte';

	export type CodeLanguageInfo = {
		name: string;
		alias: readonly string[];
	};

	let {
		viewState,
		languages,
		onSetLanguage,
		onFocusEditor
	}: {
		viewState: CodeBlockState;
		languages: CodeLanguageInfo[];
		onSetLanguage: (language: string) => void;
		onFocusEditor: () => void;
	} = $props();

	let open = $state(false);
	let filter = $state('');
	let activeIndex = $derived(Math.min(0, filter.length));
	let searchInput = $state<HTMLInputElement>();
	let picker = $state<HTMLElement>();
	let copied = $state(false);
	const filteredLanguages = $derived.by(() => {
		const query = filter.trim().toLowerCase();
		const source = query
			? languages.filter((language) =>
					[language.name, ...language.alias].some((value) => value.toLowerCase().includes(query))
				)
			: languages;
		return source.slice(0, 80);
	});

	async function togglePicker() {
		open = !open;
		if (!open) {
			onFocusEditor();
			return;
		}
		filter = '';
		await Promise.resolve();
		searchInput?.focus();
	}

	function chooseLanguage(language: string) {
		onSetLanguage(language);
		open = false;
		onFocusEditor();
	}

	function handleSearchKeydown(event: KeyboardEvent) {
		if (event.key === 'ArrowDown') {
			event.preventDefault();
			activeIndex = Math.min(activeIndex + 1, Math.max(0, filteredLanguages.length - 1));
		}
		if (event.key === 'ArrowUp') {
			event.preventDefault();
			activeIndex = Math.max(0, activeIndex - 1);
		}
		if (event.key === 'Enter' && filteredLanguages[activeIndex]) {
			event.preventDefault();
			chooseLanguage(filteredLanguages[activeIndex].name);
		}
		if (event.key === 'Escape') {
			event.preventDefault();
			open = false;
			onFocusEditor();
		}
		if (['ArrowDown', 'ArrowUp'].includes(event.key)) {
			requestAnimationFrame(() => {
				picker
					?.querySelector<HTMLElement>(`[data-language-index="${activeIndex}"]`)
					?.scrollIntoView({ block: 'nearest' });
			});
		}
	}

	async function copyCode() {
		await navigator.clipboard.writeText(viewState.text);
		copied = true;
		window.setTimeout(() => (copied = false), 1200);
	}

	function closeOnOutsidePointer(event: PointerEvent) {
		if (!open || !(event.target instanceof Node) || picker?.contains(event.target)) return;
		open = false;
	}
</script>

<svelte:window onpointerdown={closeOnOutsidePointer} />

<div class="code-tools" class:selected={viewState.selected} contenteditable="false">
	<div class="language-control" bind:this={picker}>
		<button
			type="button"
			class="language-trigger"
			aria-haspopup="listbox"
			aria-expanded={open}
			onclick={togglePicker}
		>
			<span>{viewState.language || 'Text'}</span>
			<span aria-hidden="true">⌄</span>
		</button>
		{#if open}
			<div class="language-popover">
				<input
					bind:this={searchInput}
					bind:value={filter}
					type="search"
					placeholder="Search language"
					aria-label="Search language"
					onkeydown={handleSearchKeydown}
				/>
				<div class="language-list" role="listbox" aria-label="Code language">
					{#if filteredLanguages.length}
						{#each filteredLanguages as language, index (language.name)}
							<button
								type="button"
								role="option"
								aria-selected={language.name === viewState.language}
								class:active={index === activeIndex}
								data-language-index={index}
								onpointerenter={() => (activeIndex = index)}
								onclick={() => chooseLanguage(language.name)}>{language.name}</button
							>
						{/each}
					{:else}
						<p>No matching languages</p>
					{/if}
				</div>
			</div>
		{/if}
	</div>
	<button type="button" class="copy-button" aria-label="Copy code" onclick={copyCode}>
		{copied ? 'Copied' : 'Copy'}
	</button>
</div>

<style>
	.code-tools {
		align-items: center;
		display: flex;
		justify-content: space-between;
		padding: 0.55rem 0.65rem 0.35rem;
	}

	.language-control {
		position: relative;
	}

	.language-trigger,
	.copy-button {
		align-items: center;
		background: transparent;
		border: 0;
		border-radius: calc(var(--radius) * 0.55);
		color: var(--content-1);
		cursor: pointer;
		display: inline-flex;
		font: 650 0.76rem/1 var(--font-body);
		gap: 0.35rem;
		min-height: 1.8rem;
		padding: 0.35rem 0.5rem;
	}

	.language-trigger:hover,
	.language-trigger:focus-visible,
	.copy-button:hover,
	.copy-button:focus-visible {
		background: color-mix(in oklch, var(--brand) 10%, var(--base-2));
		color: var(--content);
		outline: none;
	}

	.language-popover {
		background: var(--base-1);
		border: 1px solid var(--edge-1);
		border-radius: calc(var(--radius) * 0.8);
		box-shadow: 0 0.7rem 2rem rgb(0 0 0 / 0.16);
		inset: calc(100% + 0.35rem) auto auto 0;
		padding: 0.4rem;
		position: absolute;
		width: min(17rem, 70vw);
		z-index: 5;
	}

	.language-popover input {
		background: var(--base-2);
		border: 1px solid transparent;
		border-radius: calc(var(--radius) * 0.55);
		color: var(--content);
		font: 0.8rem/1.2 var(--font-body);
		outline: none;
		padding: 0.55rem 0.6rem;
		width: 100%;
	}

	.language-popover input:focus {
		border-color: var(--brand);
	}

	.language-list {
		max-height: 14rem;
		overflow-y: auto;
		padding-top: 0.3rem;
	}

	.language-list button {
		background: transparent;
		border: 0;
		border-radius: calc(var(--radius) * 0.5);
		color: var(--content);
		cursor: pointer;
		display: block;
		font: 0.8rem/1.2 var(--font-body);
		padding: 0.48rem 0.55rem;
		text-align: left;
		width: 100%;
	}

	.language-list button.active {
		background: color-mix(in oklch, var(--brand) 13%, var(--base-1));
	}

	.language-list button[aria-selected='true'] {
		color: var(--brand);
		font-weight: 750;
	}

	.language-list p {
		color: var(--content-1);
		font-size: 0.78rem;
		margin: 0;
		padding: 0.65rem;
	}

	:global(.milkdown-code-block) {
		background: color-mix(in oklch, var(--base-2) 92%, var(--brand) 8%);
		border: 1px solid var(--edge-1);
		border-radius: var(--radius);
		margin-block: var(--s1);
		overflow: visible;
		position: relative;
	}

	:global(.milkdown-code-block.selected) {
		box-shadow: 0 0 0 3px color-mix(in oklch, var(--brand) 24%, transparent);
	}

	:global(.milkdown-code-block .code-editor-host) {
		overflow: hidden;
	}

	:global(.milkdown-code-block .cm-editor) {
		background: transparent;
	}

	:global(.milkdown-code-block .cm-focused) {
		outline: none;
	}
</style>
