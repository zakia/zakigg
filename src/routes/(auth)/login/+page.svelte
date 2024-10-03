<script lang="ts">
	import type { PageData } from './$types';

	const onSubmit = async (event: Event) => {
		event.preventDefault();
		const form = event.target as HTMLFormElement;
		const data = new FormData(form);
		const response = await fetch('/login', {
			method: 'POST',
			body: data
		});
		console.log(response.ok);
	};
</script>

<form onsubmit={onSubmit} class="border grid p-4 max-w-sm w-full mx-auto gap-4">
	<input name="email" type="email" placeholder="email" value="azakica@gmail.com" />
	<input name="password" type="password" placeholder="Password" value="3NFpGZKksuOYKrO" />
	<button type="submit">Login</button>
	<a href="/register">Register</a>
</form>
