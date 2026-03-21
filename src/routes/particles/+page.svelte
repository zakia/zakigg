<script lang="ts">
	import GravitySimulation from './GravitySimulation.svelte';
	import LinkedParticles from './LinkedParticles.svelte';

	const configs = [
		{
			id: 'gravity',
			name: 'Gravity',
			description: 'N-body gravitational simulation with orbiting planets',
			component: GravitySimulation
		},
		{
			id: 'linked',
			name: 'Linked',
			description: 'Particles with proximity connections and mouse repulsion',
			component: LinkedParticles
		}
	] as const;

	let active = $state<string>(configs[0].id);

	const current = $derived(configs.find((c) => c.id === active)!);
</script>

<div class="flex h-dvh flex-col">
	<nav class="bg-base/80 border-edge z-10 flex items-center gap-s0 border-b px-s1 py-s-1 backdrop-blur-sm">
		{#each configs as cfg}
			<button
				class="btn text-s-1"
				class:variant-primary={active === cfg.id}
				class:variant-ghost={active !== cfg.id}
				onclick={() => (active = cfg.id)}
			>
				{cfg.name}
			</button>
		{/each}
		<span class="text-content-1 ml-auto text-s-2">{current.description}</span>
	</nav>

	<div class="relative min-h-0 flex-1">
		{#key active}
			<current.component />
		{/key}
	</div>
</div>
