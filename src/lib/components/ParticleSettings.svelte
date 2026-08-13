<script lang="ts">
	import DraggableValue from './DraggableValue.svelte';

	type Props = {
		count: number;
		defaultCount: number;
		restitution: number;
		onCountChange: (count: number) => void;
		onRestitutionChange: (restitution: number) => void;
	};

	let { count, defaultCount, restitution, onCountChange, onRestitutionChange }: Props = $props();
</script>

<section class="particle-settings" aria-label="Particle settings">
	<DraggableValue
		label="Particles"
		value={count}
		defaultValue={defaultCount}
		min={0}
		max={500}
		step={1}
		pixelsPerStep={6}
		onChange={onCountChange}
	/>
	<DraggableValue
		label="Restitution"
		value={restitution}
		defaultValue={0.3}
		min={0}
		max={1}
		step={0.05}
		pixelsPerStep={10}
		format={(value) => value.toFixed(2)}
		onChange={onRestitutionChange}
	/>
</section>

<style>
	.particle-settings {
		display: flex;
		gap: var(--s0);
		justify-content: center;
		width: min(22rem, calc(100vw - 2rem));
	}
</style>
