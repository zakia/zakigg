<script lang="ts">
	import Icon from '@iconify/svelte';
	import { getTasks, updateTask, seedTasks, clearTasks } from './task.remote';

	let tasks = getTasks();
</script>

<section class="layout gap-s0 max-w-3xl">
	<header class="gap-s-2 flex items-center justify-between">
		<h1>Tasks</h1>
		<div class="gap-s-3 flex flex-wrap">
			<button class="btn variant-base" onclick={() => seedTasks()}>
				<Icon icon="mdi:seed-outline" />
				Seed
			</button>
			<button class="btn variant-ghost" onclick={() => clearTasks()}>
				<Icon icon="mdi:trash-can-outline" />
				Clear
			</button>
		</div>
	</header>

	<div class="bg-base-1 p-s0 rounded-md">
		<svelte:boundary>
			{#snippet pending()}
				<div class="text-content-1 gap-s-2 flex items-center">
					<Icon icon="mdi:clock" />
					<span>Loading tasks…</span>
				</div>
			{/snippet}

			{#snippet failed(error)}
				<div class="text-error gap-s-2 flex items-center">
					<Icon icon="mdi:alert-circle-outline" />
					<span>{error instanceof Error ? error.message : 'Failed to load tasks.'}</span>
				</div>
			{/snippet}

			{#await tasks then loaded}
				{#if loaded.length === 0}
					<div class="gap-s-2 py-s1 grid place-items-center text-center">
						<Icon icon="mdi:clipboard-text-outline" class="text-content-1 size-10" />
						<p class="text-content-1">No tasks yet.</p>
						<button class="btn variant-primary" onclick={() => seedTasks()}>
							<Icon icon="mdi:seed-outline" />
							Seed sample tasks
						</button>
					</div>
				{:else}
					<div class="gap-s-2 flex flex-col">
						{#each loaded as task}
							<div
								class="border-edge bg-base gap-s-1 p-s-1 md:p-s0 flex items-start rounded-md border"
							>
								<button
									type="button"
									class="border-edge bg-base-1 grid h-5 w-5 place-items-center rounded-sm border"
									onclick={() => updateTask({ id: task.id, toggle: true })}
									aria-pressed={task.completed}
									title={task.completed ? 'Mark as incomplete' : 'Mark as complete'}
								>
									{#if task.completed}
										<Icon icon="mdi:check" class="text-brand" />
									{/if}
								</button>
								<div class="min-w-0 flex-1">
									<h3 class="text-s0 md:text-s1 truncate font-medium">{task.name}</h3>
									{#if task.details}
										<p class="text-content-1 text-s-1">{task.details}</p>
									{/if}
								</div>
							</div>
						{/each}
					</div>
				{/if}
			{/await}
		</svelte:boundary>
	</div>
</section>
