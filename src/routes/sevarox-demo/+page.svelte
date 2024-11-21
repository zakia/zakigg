<!-- App.svelte -->
<script>
	import { useTheme } from '$lib/theme.svelte';
	import Icon from '@iconify/svelte';

	const pageData = {
		header: {
			logo: 'Sevarox GmbH',
			navigation: ['Über uns', 'Lösungen', 'Erfolgsgeschichten', 'Kontakt']
		},
		hero: {
			headline: 'Werden Sie zum Talentmagneten Ihrer Region',
			subheadline:
				'Mit innovativer HR-Technologie und KI-gestützten Lösungen die besten Talente gewinnen',
			cta: 'Erstgespräch vereinbaren'
		},
		problemSection: {
			headline: 'Der Fachkräftemangel bremst Ihr Wachstum?',
			painPoints: [
				'Traditionelle Recruiting-Methoden funktionieren nicht mehr',
				'Qualifizierte Bewerber sind schwer zu finden',
				'Der Bewerbungsprozess ist ineffizient und zeitaufwendig'
			]
		},
		solutionSection: {
			headline: 'Ihre Lösung für modernes Recruiting',
			benefits: [
				{
					title: 'Datenbasierte Entscheidungen',
					description: 'Nutzen Sie KI und Analytics für bessere Recruiting-Ergebnisse'
				},
				{
					title: 'Effiziente Prozesse',
					description: 'Automatisieren Sie zeitaufwendige HR-Aufgaben'
				},
				{
					title: 'Starke Arbeitgebermarke',
					description: 'Positionieren Sie sich als attraktiver Arbeitgeber'
				}
			]
		},
		processSection: {
			headline: 'In drei Schritten zum Erfolg',
			steps: [
				{
					number: '1',
					title: 'Analyse',
					description: 'Wir analysieren Ihre aktuellen HR-Prozesse und Bedürfnisse'
				},
				{
					number: '2',
					title: 'Strategie',
					description: 'Wir entwickeln Ihre personalisierte Recruiting-Strategie'
				},
				{
					number: '3',
					title: 'Umsetzung',
					description: 'Wir implementieren moderne Lösungen und schulen Ihr Team'
				}
			]
		},
		trustSection: {
			headline: 'Vertrauen Sie dem Experten',
			stats: [
				{
					number: '100+',
					description: 'Zufriedene Unternehmen'
				},
				{
					number: '40%',
					description: 'Durchschnittliche Reduktion der Fluktuation'
				},
				{
					number: '3x',
					description: 'Schnellere Besetzung offener Stellen'
				}
			]
		},
		valuesSection: {
			headline: 'Unsere Werte',
			values: [
				{
					title: 'Professionalität',
					description: 'Höchste Qualität in allem was wir tun'
				},
				{
					title: 'Wachstum',
					description: 'Kontinuierliche Weiterentwicklung für maximale Exzellenz'
				},
				{
					title: 'Datenbasiert',
					description: 'Faktenbasierte Entscheidungen statt Bauchgefühl'
				}
			]
		},
		ctaSection: {
			headline: 'Bereit für den nächsten Schritt?',
			subheadline: 'Vereinbaren Sie jetzt Ihr kostenloses Erstgespräch',
			buttonText: 'Termin vereinbaren'
		}
	};

	let isMenuOpen = false;
	const theme = useTheme();
	const toggleMenu = () => (isMenuOpen = !isMenuOpen);
</script>

<div class="min-h-screen">
	<!-- Header -->
	<header class="sticky top-0 w-full bg-surface-0 bg-opacity-90 shadow-sm z-50">
		<div class="max-w-4xl mx-auto px-4 py-4 flex justify-between items-center">
			<h1 class="text-2xl font-bold text-primary">{pageData.header.logo}</h1>

			<!-- Mobile menu button -->
			<button class="md:hidden p-2" onclick={toggleMenu} aria-label="Toggle menu">
				<svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2"
						d={isMenuOpen ? 'M6 18L18 6M6 6l12 12' : 'M4 6h16M4 12h16M4 18h16'}
					/>
				</svg>
			</button>

			<!-- Desktop navigation -->
			<nav class="hidden md:flex space-x-6">
				{#each pageData.header.navigation as item}
					<a
						href="#{item.toLowerCase()}"
						class="text-content-0 hover:text-primary transition-colors"
					>
						{item}
					</a>
				{/each}
			</nav>

			<!-- Mobile navigation -->
			{#if isMenuOpen}
				<nav class="absolute top-full left-0 w-full bg-surface-0 shadow-lg md:hidden">
					{#each pageData.header.navigation as item}
						<a
							href="#{item.toLowerCase()}"
							class="block px-4 py-2 text-content-1 hover:bg-surface-1"
							onclick={() => (isMenuOpen = false)}
						>
							{item}
						</a>
					{/each}
				</nav>
			{/if}
		</div>
	</header>

	<main>
		<!-- Hero Section -->
		<section class="pt-24 pb-16 bg-gradient-to-r from-primary/10 to-primary/20">
			<div class="max-w-4xl mx-auto px-4 py-16 text-center">
				<h2 class="text-3xl md:text-4xl font-bold text-content-0 mb-6">
					{pageData.hero.headline}
				</h2>
				<p class="text-xl text-content-1 mb-8 max-w-xl mx-auto">
					{pageData.hero.subheadline}
				</p>
				<button
					class="btn variant-primary grid gap-0 px-8 py-3 rounded-lg text-lg font-semibold uppercase mx-auto"
				>
					{pageData.hero.cta}
					<span class="text-sm opacity-60 normal-case">Kostenfrei & unverbindlich</span>
				</button>
			</div>
		</section>

		<!-- Problem Section -->
		<section class="py-16 bg-surface-0">
			<div class="max-w-4xl mx-auto px-4">
				<h2 class="text-3xl font-bold text-center mb-12 text-content-0">
					{pageData.problemSection.headline}
				</h2>
				<div class="grid md:grid-cols-3 gap-8">
					{#each pageData.problemSection.painPoints as point}
						<div class="p-6 bg-surface-1 rounded-lg">
							<p class="text-content-1">{point}</p>
						</div>
					{/each}
				</div>
			</div>
		</section>

		<!-- Solution Section -->
		<section class="py-16 bg-surface-1">
			<div class="max-w-4xl mx-auto px-4">
				<h2 class="text-3xl font-bold text-center mb-12 text-content-0">
					{pageData.solutionSection.headline}
				</h2>
				<div class="grid md:grid-cols-3 gap-8">
					{#each pageData.solutionSection.benefits as benefit}
						<div class="p-6 bg-surface-0 rounded-lg shadow-sm">
							<h3 class="text-xl font-semibold mb-4 text-primary">{benefit.title}</h3>
							<p class="text-content-1">{benefit.description}</p>
						</div>
					{/each}
				</div>
			</div>
		</section>

		<!-- Process Section -->
		<section class="py-16 bg-surface-0">
			<div class="max-w-4xl mx-auto px-4">
				<h2 class="text-3xl font-bold text-center mb-12 text-content-0">
					{pageData.processSection.headline}
				</h2>
				<div class="grid md:grid-cols-3 gap-8">
					{#each pageData.processSection.steps as step}
						<div class="text-center">
							<div
								class="w-12 h-12 bg-primary rounded-full flex items-center justify-center text-primary-on text-xl font-bold mb-4 mx-auto"
							>
								{step.number}
							</div>
							<h3 class="text-xl font-semibold mb-2">{step.title}</h3>
							<p class="text-content-1">{step.description}</p>
						</div>
					{/each}
				</div>
			</div>
		</section>

		<!-- Trust Section -->
		<section class="py-16 bg-primary text-primary-on">
			<div class="max-w-4xl mx-auto px-4">
				<h2 class="text-3xl font-bold text-center mb-12">
					{pageData.trustSection.headline}
				</h2>
				<div class="grid md:grid-cols-3 gap-8">
					{#each pageData.trustSection.stats as stat}
						<div class="text-center">
							<div class="text-4xl font-bold mb-2">{stat.number}</div>
							<p class="text-lg">{stat.description}</p>
						</div>
					{/each}
				</div>
			</div>
		</section>

		<!-- Values Section -->
		<section class="py-16 bg-surface-0">
			<div class="max-w-4xl mx-auto px-4">
				<h2 class="text-3xl font-bold text-center mb-12 text-content-0">
					{pageData.valuesSection.headline}
				</h2>
				<div class="grid md:grid-cols-3 gap-8">
					{#each pageData.valuesSection.values as value}
						<div class="p-6 bg-surface-1 rounded-lg">
							<h3 class="text-xl font-semibold mb-4 text-primary">{value.title}</h3>
							<p class="text-content-1">{value.description}</p>
						</div>
					{/each}
				</div>
			</div>
		</section>

		<!-- CTA Section -->
		<section class="py-16 bg-surface-1">
			<div class="max-w-4xl mx-auto px-4 text-center">
				<h2 class="text-3xl font-bold mb-4 text-content-0">
					{pageData.ctaSection.headline}
				</h2>
				<p class="text-xl text-content-1 mb-8">
					{pageData.ctaSection.subheadline}
				</p>
				<button class="variant-primary btn px-8 py-3 rounded-lg text-lg font-semibold">
					{pageData.ctaSection.buttonText}
				</button>
			</div>
		</section>
	</main>

	<div class="fixed top-3 right-4 flex z-50">
		<button class="btn p-1 w-10 h-10" onclick={theme.toggleHue}>
			<Icon icon="line-md:paint-drop-filled" class="w-full h-full text-primary"></Icon>
		</button>
		<button class="btn p-1 h-10 w-10" onclick={theme.toggle}>
			<Icon
				icon={theme.theme === 'light' ? 'line-md:moon' : 'line-md:sunny'}
				class="w-full h-full"
			/>
		</button>
	</div>
</div>

<style>
	:global(html) {
		scroll-behavior: smooth;
	}
</style>
