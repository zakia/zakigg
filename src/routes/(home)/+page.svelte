<script lang="ts">
	import Icon from '@iconify/svelte';
	import { parseInline } from 'marked';
	type Item = {
		title: string;
		link: string;
		children: {
			title: string;
			description: string;
			link: string;
			external?: boolean;
		}[];
	};
	const projects: Item = {
		title: 'Projects',
		link: '/projects',
		children: [
			{
				title: 'TurboMenu',
				description: 'A free tool for restaurants to create QR code menus',
				link: 'https://turbo.menu',
				external: true
			},
			{
				title: 'Nice Buttons',
				description: 'Generate beautiful gradient hover effects',
				link: 'https://nicebuttons.com',
				external: true
			},
			{
				title: 'Quickset.online',
				description: 'A real-time, multiplayer card game built on Phoenix LiveView',
				link: 'https://quickset.online',
				external: true
			}
		]
	};

	const crafts: Item = {
		title: 'Crafts',
		link: '/crafts',
		children: [
			{
				title: 'Tic Tac Toe',
				description: 'How do computers play games?',
				link: '/crafts/tic-tac-toe'
			},
			{
				title: 'Scrolling Tabs',
				description: 'My attempt at tackling this common design pattern.',
				link: '/crafts/scrolling-tabs'
			},
			{
				title: '🗿📄✂️ VS AI',
				description: 'Play Rock, Paper, Scissors vs AI',
				link: '/crafts/rock-paper-scissors'
			}
		]
	};
</script>

<article class="layout max-w-2xl gap-4">
	<h1 class="H1">Adham Zaki</h1>
	<p>
		<em>Crafting interfaces.</em> Building polished software and web experiences. Experimenting with
		magical details in user interfaces. Founder of
		<a href="https://siteful.io" target="_blank">siteful.io.</a>
	</p>

	<div class="grid sm:grid-cols-2 gap-4 mt-4">
		{#each [crafts, projects] as { title, children }}
			<div>
				<h6 class="text-base-contrast mb-2 font-bold">{title}</h6>
				{#each children as { title, link, description, external }}
					<div class="mb-3">
						<div class="flex items-center gap-1">
							<a
								class="slide-link w-fit text-primary font-medium"
								target={external ? '_blank' : undefined}
								href={link}
							>
								{title}
							</a>
							{#if external}
								<Icon icon="ep-top-right" class="text-base-dimmed" />
							{/if}
						</div>
						<div class="text-base-contrast">{parseInline(description)}</div>
					</div>
				{/each}
			</div>
		{/each}
	</div>

	<h2 class="H3 mt-4">Now</h2>
	<p>
		Developing skill through doing, guiltlessly exploring passion and interests, imbuing quality.
		Mindful that
		<em>everything around me is someone’s life work.</em>
	</p>
	<p>
		I love building websites. Typography, motion design, copywriting, performance — the web is an
		endless medium of opportunity and creativity of which I’ve only scratched the surface.
	</p>
	<h2 class="H3 mt-4">Connect</h2>
	<p>
		Reach me at <a href="mailto:a@zaki.gg">a@zaki.gg</a> or read more on
		<a href="/resume">my resume.</a>
	</p>
</article>
