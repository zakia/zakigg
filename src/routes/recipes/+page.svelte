<script lang="ts">
	import { parse } from 'yaml';
	
	type Recipe = {
		id: string;
		name: string;
		ingredients: string[];
		steps: string[];
		images: string[];
	};

	const recipes = import.meta.glob('./data/*.yaml', {
		query: '?raw',
		import: 'default',
		eager: true
	});

	console.log(Object.values(recipes).map((recipe) => parse(recipe as string)));
</script>

{#snippet recipeDisplay({ name, ingredients, steps, images }: Recipe)}
	<div class="grid gap-1">
		<h1>{name}</h1>
		<h3 class="mt-4">Ingredients</h3>
		<ul class="list-disc pl-4">
			{#each ingredients as ingredient}
				<li>{ingredient}</li>
			{/each}
		</ul>
		<h3 class="mt-4">Steps</h3>
		<ol class="grid list-decimal pl-6 marker:font-bold">
			{#each steps as step}
				<li>{step}</li>
			{/each}
		</ol>
		{#each images as image}
			<img src={image} alt={name} />
		{/each}
	</div>
{/snippet}

<main class="layout grid gap-8">
	{#each Object.values(recipes).map((recipe) => parse(recipe as string)) as recipe}
		{@render recipeDisplay(recipe)}
	{/each}
</main>
