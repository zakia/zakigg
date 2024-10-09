<script lang="ts">
	import { parse } from 'yaml';
	import hotPockets from './data/hot-pocket.yaml?raw';

	type Recipe = {
		id: string;
		name: string;
		ingredients: {
			[key: string]: string[];
		};
		steps: string[];
	};

	const test = parse(hotPockets) as Recipe;

	const recipes = import.meta.glob('./data/*.yaml', {
		query: '?raw',
		import: 'default',
		eager: true
	});

	console.log(Object.values(recipes).map((recipe) => parse(recipe as string)));
</script>

{#snippet recipeDisplay({ name, ingredients, steps }: Recipe)}
	<div class="grid gap-1">
		<h1>{name}</h1>
		{#each Object.entries(ingredients) as [header, items]}
			<h3 class="mt-4">{header}</h3>
			<ul class="list-disc pl-4">
				{#each items as item}
					<li>{item}</li>
				{/each}
			</ul>
		{/each}
		<h3 class="mt-4">Steps</h3>
		<ol class="grid gap-1 list-decimal marker:font-bold pl-6">
			{#each steps as step}
				<li>{step}</li>
			{/each}
		</ol>
	</div>
{/snippet}

<main class="layout grid gap-8">
	{#each Object.values(recipes).map((recipe) => parse(recipe as string)) as recipe}
		{@render recipeDisplay(recipe)}
	{/each}
</main>
