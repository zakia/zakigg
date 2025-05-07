<script lang="ts">
	import Icon from '@iconify/svelte';
	import { title } from 'radash';
	import Card from './Card.svelte';
	import { experiences, hobbies, projects, skills } from './data';
	import emblaCarouselSvelte from 'embla-carousel-svelte';
	import ProjectCard from './ProjectCard.svelte';

	emblaCarouselSvelte.globalOptions = { align: 'center' };

	const contactLinks = [
		{ href: 'mailto:a@zaki.gg', icon: 'mdi:email', text: 'a@zaki.gg' },
		// { href: 'tel:4374405536', icon: 'mdi:phone', text: '(437) 440-5526' },
		{ href: 'https://github.com/azakiio', icon: 'mdi:github', text: 'azakiio' },
		{ href: 'https://www.linkedin.com/in/adhamzaki/', icon: 'mdi:linkedin', text: 'adhamzaki' }
	];
</script>

<div
	class="layout print:py-4 max-w-5xl mx-a gap-8 items-start md:grid-cols-[3fr_4fr] print:max-w-none print:mt-0"
>
	<!-- <div class="col-span-full flex justify-between gap-2"></div> -->

	<section class="grid gap-4">
		<h1>
			<span class="font-extralight">Adham</span>
			<span class="font-semibold">Zaki</span>
		</h1>
		<!-- <div class="flex gap-1 items-center -mt-4">
			{#each hobbies as hobby}
				<div
					class="flex-shrink-0 w-8 h-8 grid rounded-full p-1.5 shadow-[var(--shadow-1)] border-1.5 border-primary"
					title={hobby.label}
				>
					{#if hobby.link}
						<a href={hobby.link} target="_blank" class="w-full h-full">
							<Icon icon={hobby.icon} class="w-full h-full text-primary" />
						</a>
					{:else}
						<Icon icon={hobby.icon} class="w-full h-full" />
					{/if}
				</div>
			{/each}
		</div> -->

		<p>
			<b>Full Stack Developer & Entrepreneur</b> with a background in <b>Industrial Engineering</b>,
			based in <b>Toronto</b>.
		</p>

		<p>
			Passionate about creating intuitive and pleasing digital experiences; balancing
			<b> technical excellence </b>
			with <b>user-centric design</b>.
		</p>

		<div class="flex gap-3">
			{#each contactLinks as link}
				<a href={link.href} class="flex gap-1 items-center w-fit slide-link" target="_blank">
					<Icon icon={link.icon} class="w-6 h-6" />
					{#if link.text}
						{link.text}
					{/if}
				</a>
			{/each}
		</div>
	</section>

	<section class="grid gap-2">
		<h2>Projects</h2>
		<div class="grid gap-2">
			{#each projects as project}
				<ProjectCard {...project} />
			{/each}
		</div>
	</section>

	<section class="grid gap-4">
		<h2 class="col-span-full -mb-2">Skills</h2>
		{#each Object.entries(skills) as [key, items]}
			<div>
				<h4 class="mb-2">{title(key)}</h4>
				<div class="flex flex-wrap gap-2">
					{#each items as item}
						<div
							class="flex gap-1 bg-base-200 rounded-full px-2 py-1 items-center font-medium shadow"
						>
							<Icon icon={item.icon} class="shrink-0 h-4 w-4" />
							{item.label}
						</div>
					{/each}
				</div>
			</div>
		{/each}
	</section>

	<section class="grid gap-6 row-span-4 md:row-start-1 md:col-start-2">
		<h2>Experience</h2>

		{#each experiences as experience}
			<Card {...experience} />
		{/each}
	</section>

	<!-- <section>
		<h2>Education</h2>

		<Card {...education} compact={true} />
	</section> -->
</div>
