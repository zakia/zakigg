<script lang="ts">
	import Icon from '@iconify/svelte';
	import { title } from 'radash';
	import Card from './Card.svelte';
	import { experiences, projects, skills } from './data';
	import ProjectCard from './ProjectCard.svelte';

	const contactLinks = [
		{ href: 'mailto:a@zaki.gg', icon: 'mdi:email', text: 'adham@zaki.gg' },
		{ href: 'https://github.com/zakia', icon: 'mdi:github', text: 'zakia' },
		{ href: 'https://www.linkedin.com/in/adhamzaki/', icon: 'mdi:linkedin', text: 'adhamzaki' }
	];
</script>

<div class="gap-s0 mx-auto flex max-w-3xl flex-col px-6 py-16 text-sm print:p-0">
	<section class="flex flex-col items-center">
		<h1 class="text-s3">
			<span class="font-extralight">Adham</span>
			<span class="font-bold">Zaki</span>
		</h1>
		<div class="gap-s2 gap-y-s-1 mt-s-1 flex flex-wrap">
			{#each contactLinks as link}
				<a
					href={link.href}
					class="slide-link flex items-center gap-1 text-sm font-semibold"
					target="_blank"
				>
					<Icon icon={link.icon} class="h-5 w-5" />
					{link.text}
				</a>
			{/each}
		</div>
	</section>

	<section class="flex flex-col">
		<h2 class="text-brand border-edge mb-1 border-b pb-1 font-bold uppercase">Experience</h2>
		<div class="gap-s0 flex flex-col">
			{#each experiences as experience}
				<Card {...experience} />
			{/each}
		</div>
	</section>

	<section class="flex flex-col">
		<h2 class="text-brand mb-1 border-b pb-1 font-bold uppercase opacity-60">Projects</h2>
		<div class="gap-s1 grid md:grid-cols-3">
			{#each projects as project}
				<ProjectCard {...project} />
			{/each}
		</div>
	</section>

	<section class="gap-s2 flex flex-col">
		<h2 class="text-brand mb-1 border-b pb-1 font-bold uppercase opacity-60">Technical Skills</h2>
		<div class="gap-s1 mt-s-1 flex flex-col">
			{#each Object.entries(skills) as [key, items]}
				<div class="gap-s0">
					<h4 class="w-56 shrink-0 text-xs font-bold uppercase opacity-50">{title(key)}</h4>
					<div class="gap-s-2 flex flex-wrap">
						{#each items as item}
							<div
								class="bg-base-1 gap-s-2 px-s-1 py-s-4 border-base-2 flex items-center rounded-lg border text-sm font-medium shadow-sm"
							>
								<Icon icon={item.icon} class="h-4 w-4 shrink-0" />
								{item.label}
							</div>
						{/each}
					</div>
				</div>
			{/each}
		</div>
	</section>

	<section class="gap-s1 flex flex-col">
		<h2 class="text-primary text-sm font-bold tracking-[0.2em] uppercase opacity-80">Education</h2>
		<div class="mt-s-1">
			<p class="text-xl font-bold">University of Toronto</p>
			<p class="text-lg opacity-90">B.A.Sc. in Industrial Engineering (Honours)</p>
			<p class="mt-1 text-sm italic opacity-60">Minor in Artificial Intelligence Engineering</p>
		</div>
	</section>
</div>
