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

<div class="bg-base max-w-3xl rounded-md p-s0">
	<svelte:boundary>
		{#snippet pending()}
			<div class="text-content-1 flex items-center gap-s-2">
				<Icon icon="mdi:clock" />
				<span>Loading tasks…</span>
			</div>
		{/snippet}
		<div class="flex flex-col gap-s-2">
			{#each await tasks as task}
				<div
					class="border-edge bg-base-1 flex items-start gap-s-1 rounded-md border p-s-1 md:p-s0"
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
						<h3 class="truncate text-s0 font-medium md:text-s1">{task.name}</h3>
						{#if task.details}
							<p class="text-content-1 text-s-1">{task.details}</p>
						{/if}
					</div>
				</div>
			{/each}
		</div>
	</svelte:boundary>
</div>
