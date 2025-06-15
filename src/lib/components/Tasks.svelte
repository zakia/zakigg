<script lang="ts">
	import { repo } from 'remult';
	import { Task } from '../shared/Task';
	import Icon from '@iconify/svelte';

	let tasks = $state<Task[]>([]);

	$effect(() => {
		repo(Task)
			.find()
			.then((t) => (tasks = t));
	});

	let newTaskTitle = $state('');
	const addTask = async (event: Event) => {
		event.preventDefault();
		try {
			const newTask = await repo(Task).insert({ title: newTaskTitle });
			tasks.push(newTask);
			newTaskTitle = '';
		} catch (error) {
			alert((error as { message: string }).message);
		}
	};

	const setCompleted = async (task: Task, completed: boolean) => {
		await repo(Task).save({ ...task, completed });
	};

	const saveTask = async (e: Event, task: Task) => {
		e.preventDefault();
		await repo(Task).save({ ...task });
	};

	const deleteTask = async (e: Event, task: Task) => {
		e.preventDefault();
		await repo(Task).delete(task);
		tasks = tasks.filter((c) => c.id !== task.id);
	};
</script>

<div>
	<h1>todos</h1>
	<div>
		<form onsubmit={addTask}>
			<label class="input">
				<input bind:value={newTaskTitle} placeholder="What needs to be done?" />
				<Icon icon="mdi:plus" />
			</label>
		</form>

		{#each tasks as task}
			<div class="rounded border border-gray-300 p-2">
				<input
					type="checkbox"
					checked={task.completed}
					oninput={(e) => setCompleted(task, e.currentTarget.checked)}
				/>
				<input name="title" bind:value={task.title} />
				<button onclick={(e) => saveTask(e, task)}>Save</button>
				<button onclick={(e) => deleteTask(e, task)}>Delete</button>
			</div>
		{/each}
	</div>
</div>
