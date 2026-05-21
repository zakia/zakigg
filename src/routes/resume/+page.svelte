<script lang="ts">
	import Icon from '@iconify/svelte';
	import { title } from 'radash';
	import Card from './Card.svelte';
	import { experiences, projects, skills } from './data';
	import ProjectCard from './ProjectCard.svelte';

	const contactLinks = [
		{ href: 'mailto:azakica@gmail.com', icon: 'mdi:email', text: 'azakica@gmail.com' },
		{ href: 'https://github.com/zakia', icon: 'mdi:github', text: 'zakia' },
		{ href: 'https://www.linkedin.com/in/adhamzaki/', icon: 'mdi:linkedin', text: 'adhamzaki' }
	];
</script>

<div class="gap-s0 mx-auto flex flex-col px-6 py-16 text-sm not-print:max-w-3xl print:p-3">
	<section>
		<div class="gap-s0 flex items-center">
			<h1 class="text-s3 trim">
				<span class="font-extralight">Adham</span>
				<span class="font-bold">Zaki</span>
			</h1>
			<div class="gap-s0 ml-auto flex">
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
		</div>
		<div class="mt-s-1">
			<div>
				<b> University of Toronto, </b>
				<span> Bachelor of Applied Science in Industrial Engineering </span>
			</div>
			<p class="text-sm opacity-60">
				Honors | Minor in AI Engineering | Certificate in Engineering Business
			</p>
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
		<h2 class="text-brand border-edge mb-1 border-b pb-1 font-bold uppercase">Projects</h2>
		<div class="gap-s1 grid grid-cols-2">
			{#each projects as project}
				<ProjectCard {...project} />
			{/each}
		</div>
	</section>

	<section class="flex flex-col">
		<h2 class="text-brand border-edge mb-1 border-b pb-1 font-bold uppercase">Technical Skills</h2>

		<div class="gap-s-2 mt-2 flex flex-wrap">
			{#each skills as skill}
				<div
					class="bg-base-1 gap-s-2 px-s-1 py-s-4 border-base-2 pdf flex items-center rounded-lg border text-sm font-medium shadow-sm"
				>
					<Icon icon={skill.icon} class="h-4 w-4 shrink-0" />
					{skill.label}
				</div>
			{/each}
		</div>
	</section>
</div>

<style>
	.pdf {
		/* -webkit-print-color-adjust: exact; */
		-webkit-filter: opacity(1);
	}
</style>
