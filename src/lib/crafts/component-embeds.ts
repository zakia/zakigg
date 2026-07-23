import * as v from 'valibot';
import {
	createComponentEmbedRegistry,
	registerComponentEmbed,
	registerLazyComponentEmbed
} from '$lib/editor/component-embeds';
import OverflowToggle, { overflowToggleEmbed } from './carousels/content/OverflowToggle.svelte';
import ScrollingTabs, { scrollingTabsEmbed } from './carousels/content/ScrollingTabs.svelte';
import ScrollingTabsAnchors, {
	scrollingTabsAnchorsEmbed
} from './carousels/content/ScrollingTabsAnchors.svelte';
import Timer, { timerEmbed } from './embeds/Timer.svelte';

export const craftComponentEmbeds = createComponentEmbedRegistry([
	registerComponentEmbed(Timer, timerEmbed),
	registerComponentEmbed(ScrollingTabs, scrollingTabsEmbed),
	registerComponentEmbed(ScrollingTabsAnchors, scrollingTabsAnchorsEmbed),
	registerComponentEmbed(OverflowToggle, overflowToggleEmbed),
	// Lazy embeds: their code downloads only when a document actually
	// renders them.
	registerLazyComponentEmbed(() => import('./embeds/ImageCarousel.svelte'), {
		id: 'core.ImageCarousel',
		label: 'Image Carousel',
		icon: 'mdi:view-carousel-outline',
		props: v.object({
			images: v.optional(v.array(v.string()), [])
		})
	}),
	registerLazyComponentEmbed(() => import('./tic-tac-toe/TicTacToeGame.svelte'), {
		id: 'tic-tac-toe.game',
		label: 'Tic Tac Toe',
		icon: 'mdi:grid',
		props: v.object({})
	}),
	registerLazyComponentEmbed(() => import('./rock-paper-scissors/RockPaperScissorsGame.svelte'), {
		id: 'rock-paper-scissors.game',
		label: 'Rock Paper Scissors',
		icon: 'mdi:hand-back-right-outline',
		props: v.object({})
	})
]);
