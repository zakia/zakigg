<script lang="ts">
	import { countries } from './data';

	let query = $state('');

	const filtered = $derived.by(() => {
		const q = query.trim().toLowerCase();
		if (!q) return countries;
		return countries.filter(
			(c) => c.name.toLowerCase().includes(q) || c.code.toLowerCase().includes(q)
		);
	});
</script>

<div class="layout gap-s0 w-full max-w-3xl">
	<header class="gap-s-2 grid">
		<h1>Flags</h1>
		<p class="text-content">Every country flag emoji in one place.</p>
	</header>

	<input type="search" class="input" placeholder="Search by name or code..." bind:value={query} />

	<div class="flag-grid">
		{#each filtered as country (country.code)}
			<div class="flag-cell" title={country.name}>
				<span class="flag">{country.flag}</span>
				<span class="code">{country.code}</span>
				<span class="name">{country.name}</span>
			</div>
		{:else}
			<p class="text-content col-span-full text-center">No matches.</p>
		{/each}
	</div>
</div>

<style>
	.flag-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
		gap: var(--s-2);
	}
	.flag-cell {
		display: grid;
		grid-template-columns: auto auto 1fr;
		align-items: center;
		gap: var(--s-3);
		padding: var(--s-3) var(--s-2);
		border-radius: var(--radius);
		border: 1px solid color-mix(in oklch, var(--content) 10%, transparent);
	}
	.flag {
		font-size: 1.5rem;
	}
	.code {
		font-family: var(--font-mono, monospace);
		font-size: var(--s-2);
		color: color-mix(in oklch, var(--content) 60%, transparent);
	}
	.name {
		font-size: var(--s-1);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
</style>
