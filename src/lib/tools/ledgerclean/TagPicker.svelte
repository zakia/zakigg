<script lang="ts">
	import type { TagDictionary } from './tags';
	let {
		tags,
		ids,
		label,
		disabled = false,
		onChange
	}: {
		tags: TagDictionary;
		ids: readonly string[];
		label: string;
		disabled?: boolean;
		onChange: (ids: string[]) => void;
	} = $props();
	const listed = $derived(Object.values(tags));
	const purpose = $derived(ids.find((id) => tags[id]?.dimension === 'purpose') ?? '');
	const extra = $derived(ids.filter((id) => tags[id] && tags[id].dimension !== 'purpose'));
	const uid = $props.id();
	let trigger: HTMLButtonElement;
	let open = $state(false);
	function setPurpose(id: string) {
		onChange([...ids.filter((id) => tags[id]?.dimension !== 'purpose'), ...(id ? [id] : [])]);
	}
	function positionMenu(menu: HTMLDivElement) {
		function position() {
			if (!menu.matches(':popover-open') || !trigger) return;
			const rect = trigger.getBoundingClientRect();
			const bounds = menu.getBoundingClientRect();
			const top =
				rect.bottom + 6 + bounds.height <= window.innerHeight - 8
					? rect.bottom + 6
					: Math.max(8, rect.top - bounds.height - 6);
			Object.assign(menu.style, {
				left: `${Math.max(8, Math.min(rect.left, window.innerWidth - bounds.width - 8))}px`,
				top: `${top}px`
			});
		}
		function toggle() {
			open = menu.matches(':popover-open');
			if (open) {
				position();
				menu.querySelector('select')?.focus({ preventScroll: true });
			}
		}
		menu.addEventListener('toggle', toggle);
		window.addEventListener('resize', position);
		window.addEventListener('scroll', position, true);
		return {
			destroy() {
				menu.removeEventListener('toggle', toggle);
				window.removeEventListener('resize', position);
				window.removeEventListener('scroll', position, true);
			}
		};
	}
</script>

<div class="tags" aria-label={`Tags for ${label}`}>
	{#each [...(purpose ? [purpose] : []), ...extra] as id (id)}
		<button
			type="button"
			class="pill"
			style={`--tag-color:${tags[id].color}`}
			popovertarget={`${uid}-tags`}
			{disabled}
			aria-label={`Edit ${tags[id].name} tag for ${label}`}>{tags[id].name}</button
		>
	{/each}
	<button
		type="button"
		class="add"
		class:open
		class:has-tags={ids.length > 0}
		bind:this={trigger}
		popovertarget={`${uid}-tags`}
		aria-label={`Edit tags for ${label}`}
		aria-haspopup="dialog"
		aria-expanded={open}
		{disabled}>{ids.length ? '+' : '+ Tag'}</button
	>
</div>
<div
	class="tag-menu"
	id={`${uid}-tags`}
	popover="auto"
	role="dialog"
	aria-label={`Tags for ${label}`}
	use:positionMenu
>
	<label class="purpose"
		>Purpose
		<select
			aria-label={`Wants or needs for ${label}`}
			value={purpose}
			{disabled}
			onchange={(event) => setPurpose(event.currentTarget.value)}
		>
			<option value="">Unspecified</option>
			{#each listed.filter((tag) => tag.dimension === 'purpose') as tag (tag.id)}
				<option value={tag.id}>{tag.name}</option>
			{/each}
		</select>
	</label>
	<div class="choices">
		{#each listed.filter((tag) => tag.dimension !== 'purpose') as tag (tag.id)}
			<label
				><input
					type="checkbox"
					aria-label={`${tag.name} tag for ${label}`}
					checked={ids.includes(tag.id)}
					{disabled}
					onchange={(event) =>
						onChange(
							event.currentTarget.checked ? [...ids, tag.id] : ids.filter((id) => id !== tag.id)
						)}
				/>{tag.name}</label
			>
		{/each}
	</div>
</div>

<style>
	.tags {
		display: inline-flex;
		align-items: center;
		gap: 0.3rem;
		flex: 0 0 auto;
		white-space: nowrap;
		font-size: 0.72rem;
	}
	button {
		font: inherit;
		cursor: pointer;
		color: var(--content-1);
		background: transparent;
	}
	.pill {
		background: color-mix(in oklab, var(--tag-color) 12%, var(--base-1));
		border: 1px solid color-mix(in oklab, var(--tag-color) 42%, var(--edge));
		color: color-mix(in oklab, var(--tag-color) 75%, var(--content));
		font-weight: 500;
		padding: 0.18rem 0.48rem;
		border-radius: 999px;
		transition: border-color 120ms ease;
	}
	.pill:hover:not(:disabled) {
		border-color: var(--tag-color);
	}
	.add {
		border: 1px dashed transparent;
		padding: 0.18rem 0.42rem;
		border-radius: 999px;
		font-size: 0.7rem;
		color: var(--content-1);
		transition:
			opacity 120ms ease,
			background-color 120ms ease,
			border-color 120ms ease,
			color 120ms ease;
	}
	.add:hover:not(:disabled),
	.add.open {
		background: var(--base-2);
		border-color: var(--edge-1);
		color: var(--content);
	}
	@media (hover: hover) {
		:global(tr) .add:not(.open):not(:focus-visible) {
			opacity: 0;
		}
		:global(tr:hover) .add,
		:global(tr:focus-within) .add,
		.tags:hover .add,
		.tags:focus-within .add {
			opacity: 1;
		}
	}
	button:disabled {
		opacity: 0.5;
		cursor: default;
	}
	.tag-menu {
		position: fixed;
		inset: auto;
		margin: 0;
		width: 230px;
		max-width: calc(100vw - 16px);
		max-height: calc(100vh - 16px);
		overflow: auto;
		padding: 0.8rem;
		border: 1px solid var(--edge-1);
		border-radius: 8px;
		background: var(--base-1);
		color: var(--content);
		box-shadow: 0 8px 24px #0002;
		font-size: 0.8rem;
	}
	.purpose {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
	}
	select {
		font: inherit;
		border: 1px solid var(--edge-1);
		border-radius: 5px;
		padding: 0.3rem;
		background: var(--base-1);
		color: var(--content);
	}
	.choices {
		display: grid;
		gap: 0.5rem;
		padding-top: 0.7rem;
		margin-top: 0.7rem;
		border-top: 1px solid var(--edge);
	}
	.choices label {
		display: flex;
		align-items: center;
		gap: 0.4rem;
		cursor: pointer;
	}
	input {
		accent-color: var(--content);
	}
	button:focus-visible,
	select:focus-visible,
	input:focus-visible {
		outline: 2px solid var(--content-1);
		outline-offset: 2px;
	}
</style>
