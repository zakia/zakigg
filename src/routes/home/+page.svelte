<script lang="ts">
	import Icon from '@iconify/svelte';
	import { getTasks, updateTask } from './task.remote';

	let tasks = getTasks();
</script>

<div>
	<h1>Tasks</h1>
	<div>
		<form>
			<input type="text" name="name" placeholder="Task name" />
		</form>
		<form>
			<input type="text" name="details" placeholder="Task details" />
		</form>
		<form>
			<input type="text" name="tags" placeholder="Task tags" />
		</form>
		<form>
			<input type="text" name="reminderDate" placeholder="Reminder date" />
		</form>
	</div>
</div>

<div class="bg-base-200 max-w-3xl rounded-lg p-4">
	<svelte:boundary>
		{#snippet pending()}
			<div class="text-base-content/70 flex items-center gap-2">
				<Icon icon="mdi:clock" />
				<span>Loading tasks…</span>
			</div>
		{/snippet}
		<div class="flex flex-col gap-2">
			{#each await tasks as task}
				<div
					class="border-base-300 bg-base-100 flex items-start gap-3 rounded-lg border p-3 md:p-4"
				>
					<button
						type="button"
						class="border-base-300 bg-base-100 grid h-5 w-5 place-items-center rounded border"
						onclick={() => updateTask({ id: task.id, toggle: true })}
						aria-pressed={task.completed}
						title={task.completed ? 'Mark as incomplete' : 'Mark as complete'}
					>
						{#if task.completed}
							<Icon icon="mdi:check" class="text-primary" />
						{/if}
					</button>
					<div class="min-w-0 flex-1">
						<h3 class="truncate text-base font-medium md:text-lg">{task.name}</h3>
						{#if task.details}
							<p class="text-base-content/70 mt-0.5 text-sm">{task.details}</p>
						{/if}
					</div>
				</div>
			{/each}
		</div>
	</svelte:boundary>
</div>
