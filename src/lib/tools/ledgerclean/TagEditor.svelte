<script lang="ts">
	import { addTag, DEFAULT_TAGS, validateTags, type TagDictionary } from './tags';
	let {
		tags,
		onChange,
		onDelete
	}: {
		tags: TagDictionary;
		onChange: (tags: TagDictionary) => void;
		onDelete: (id: string) => void;
	} = $props();
	let name = $state(''),
		error = $state('');
	function rename(id: string, name: string) {
		try {
			const next = { ...tags, [id]: { ...tags[id], name: name.trim() } };
			validateTags(next);
			onChange(next);
			error = '';
		} catch (cause) {
			error = cause instanceof Error ? cause.message : 'Could not edit tag.';
		}
	}
</script>

<div class="tag-settings">
	{#if error}<p role="alert">{error}</p>{/if}
	<div class="list">
		{#each Object.values(tags) as tag (tag.id)}
			<div class="tag-item">
				<span class="dot" style:background={tag.color} aria-hidden="true"></span>
				<input
					aria-label={`Name for tag ${tag.name}`}
					value={tag.name}
					onchange={(event) => rename(tag.id, event.currentTarget.value)}
				/>
				<small class="dimension">{tag.dimension}</small>
				{#if !DEFAULT_TAGS[tag.id]}
					<button
						type="button"
						class="delete-btn"
						aria-label={`Delete tag ${tag.name}`}
						onclick={() => onDelete(tag.id)}>×</button
					>
				{/if}
			</div>
		{/each}
	</div>
	<form
		onsubmit={(event) => {
			event.preventDefault();
			try {
				onChange(addTag(tags, name));
				name = '';
				error = '';
			} catch (cause) {
				error = cause instanceof Error ? cause.message : 'Could not add tag.';
			}
		}}
	>
		<input
			aria-label="New context tag"
			placeholder="New context tag, e.g. Summer trip"
			bind:value={name}
			required
			maxlength="80"
		/><button type="submit" disabled={!name.trim()}>Add tag</button>
	</form>
</div>

<style>
	.tag-settings {
		font-size: 0.8rem;
	}
	.list {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(230px, 1fr));
		gap: 0.5rem;
		margin: 0.75rem 0 1rem;
	}
	.tag-item,
	form {
		display: flex;
		gap: 0.45rem;
		align-items: center;
	}
	.tag-item {
		background: var(--base-2);
		border: 1px solid var(--edge);
		border-radius: 7px;
		padding: 0.3rem 0.55rem;
	}
	.dot {
		width: 0.55rem;
		height: 0.55rem;
		border-radius: 999px;
		flex-shrink: 0;
	}
	.tag-item input {
		border-color: transparent;
		background: transparent;
		padding: 0.25rem 0.35rem;
	}
	.tag-item input:hover,
	.tag-item input:focus {
		background: var(--base-1);
		border-color: var(--edge-1);
	}
	input,
	button {
		font: inherit;
		border: 1px solid var(--edge-1);
		border-radius: 6px;
		padding: 0.4rem 0.6rem;
		color: var(--content);
		background: var(--base-1);
	}
	input {
		flex: 1;
		min-width: 0;
	}
	.dimension {
		color: var(--content-1);
		font-size: 0.68rem;
		text-transform: uppercase;
		letter-spacing: 0.03em;
	}
	.delete-btn {
		border: 0;
		background: transparent;
		padding: 0.15rem 0.35rem;
		color: var(--content-1);
	}
	p {
		color: var(--error);
	}
	button {
		cursor: pointer;
	}
	button:disabled {
		opacity: 0.5;
		cursor: default;
	}
	input:focus-visible,
	button:focus-visible {
		outline: 2px solid var(--content-1);
		outline-offset: 2px;
	}
</style>
