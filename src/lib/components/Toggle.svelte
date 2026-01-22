<script lang="ts">
	let {
		label,
		name,
		checked = $bindable()
	} = $props<{ label?: string; name?: string; checked: boolean }>();
</script>

<label class="cursor-pointer">
	{label}
	<input {name} type="checkbox" class="hidden" bind:checked />
	<div
		aria-checked={checked}
		class="bg-bg-surface aria-checked:bg-primary toggle flex h-7 w-12 items-center rounded-full p-1"
	>
		<span class="bg-bg block h-full w-1/2 rounded-full"></span>
	</div>
</label>

<style>
	.toggle {
		transition: background-color 0.3s;
	}

	.toggle span {
		will-change: translate;
		transition: translate 0.3s;
	}

	.toggle[aria-checked='true'] span {
		translate: 100%;
	}
</style>
