<script>
	import Icon from '@iconify/svelte';
	import LogoHawe from './hawe.svg';
	import LogoHR from './hr.svg';
	import LogoLehne from './lehne.svg';
	import LogoSevarox from './sevarox.svg';
	import LogoMDpronto from './mdpronto.svg';
	import LogoHalbelf from './halbelf.svg';
	import { inlineSvg } from '@svelte-put/inline-svg';

	const projects = [
		{
			name: 'MD Pronto',
			description:
				'Telemedicine platform connecting patients with top doctors, offering easy appointments and a free health screening tool.',
			link: 'https://mdpronto-beta.com/',
			thumbnail: LogoMDpronto,
			built: ['logos:react', 'logos:nextjs-icon', 'logos:nestjs', 'logos:aws-dynamodb', 'la:aws']
		},
		{
			name: 'HaWe',
			description:
				'Expert tax and business consulting for companies, entrepreneurs, and investors across Germany.',
			link: 'https://www.hawe-tax.de/',
			thumbnail: LogoHawe,
			built: ['logos:vue', 'logos:nuxt-icon', 'la:aws']
		},
		{
			name: 'HR-insider',
			description:
				'HR Consulting platform aimed at empowering internal teams to attract and retain top talent more efficiently without relying on external agencies.',
			link: 'https://hr-insider.consulting',
			thumbnail: LogoHR,
			built: ['logos:vue', 'logos:nuxt-icon', 'la:aws']
		},
		{
			name: 'Halbelf',
			description:
				'Custom chatbot builder that allows businesses to embed AI-powered bots for customer support, lead generation, and user engagement on their websites.',
			link: 'https://halbelf.com',
			thumbnail: LogoHalbelf,
			built: ['logos:vue', 'logos:nuxt-icon', 'logos:postgresql', 'logos:stripe']
		},
		{
			name: 'LEHNE-ing',
			description:
				'German engineering firm offering planning, consulting, and construction management services in traffic, infrastructure, water, and digitalization sectors',
			link: 'https://www.lehne-ing.de/en',
			thumbnail: LogoLehne,
			built: ['tabler:markdown', 'simple-icons:astro', 'la:aws']
		},
		{
			name: 'Sevarox',
			description:
				'Innovative platform for transforming employer branding and talent acquisition with integrated software solutions, trusted by over 100 companies.',
			link: 'https://sevarox.com/',
			thumbnail: LogoSevarox,
			built: ['logos:react', 'logos:nextjs-icon', 'la:aws']
		}
	];
</script>

<section class="layout gap-4">
	<h1 class="text-center mb-4">Client Projects</h1>
	<div class="grid md:grid-cols-3 gap-6">
		{#each projects as project}
			<div class="border border-primary rounded-xl p-3 flex flex-col">
				<a href={project.link} target="_blank" aria-label={project.name} class="btn p-0">
					<svg use:inlineSvg={project.thumbnail} class="max-w-50 h-16 mb-1" />
				</a>
				<p>{project.description}</p>
				<p class="font-bold mt-auto pt-4">Built with:</p>
				<div class="flex gap-3">
					{#each project.built as logo}
						<Icon icon={logo} class="w-7 h-7" />
					{/each}
				</div>
			</div>
		{/each}
	</div>
</section>
