<script lang="ts">
	import { enhance } from '$app/forms';

	let { data } = $props();

	interface Task {
		id: string;
		name: string;
		description?: string;
		tags?: string[];
		due_date?: string;
		start_date?: string;
		end_date?: string;
	}

	let form = $state({
		name: '',
		description: '',
		tags: '',
		due_date: '',
		start_date: '',
		end_date: ''
	});
</script>

<svelte:head>
	<title>About</title>
	<meta name="description" content="About this app" />
</svelte:head>

<div class="text-column">
	<div class="grid gap-2">
		<!-- {#each data.items as task (task.id)}
			<div class="border-2 p-4">
				<h2>{task.name}</h2>
				<p>{task.description}</p>
				<p>{task.tags}</p>

				<p>{task.due_date}</p>
				<p>{task.start_date}</p>
				<p>{task.end_date}</p>
			</div>
		{/each} -->
	</div>
	<form class="grid gap-4" method="post" use:enhance>
		<label>
			<span>Name:</span>
			<input type="text" name="name" value="Ring Workout" />
		</label>
		<label>
			<span>Description:</span>
			<textarea name="description" value="TEstingt a description with <b>bold</b>"></textarea>
		</label>
		<label>
			<span>Tags:</span>
			<input name="tags" value="p1, grocery" />
		</label>
		<label>
			<span>Due Date:</span>
			<input name="due_date" type="datetime-local" />
		</label>
		<label>
			<span>Start Date:</span>
			<input name="start_date" type="datetime-local" />
		</label>
		<label>
			<span>End Date:</span>
			<input name="end_date" type="datetime-local" />
		</label>
		<button type="submit">Add task</button>
	</form>
</div>
