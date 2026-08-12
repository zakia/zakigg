import * as v from 'valibot';
import {
	createComponentEmbedRegistry,
	registerComponentEmbed,
	registerLazyComponentEmbed
} from '$lib/editor/component-embeds';
import OverflowToggle, {
	overflowToggleEmbed
} from '$lib/crafts/carousels/content/OverflowToggle.svelte';
import ScrollingTabs, {
	scrollingTabsEmbed
} from '$lib/crafts/carousels/content/ScrollingTabs.svelte';
import ScrollingTabsAnchors, {
	scrollingTabsAnchorsEmbed
} from '$lib/crafts/carousels/content/ScrollingTabsAnchors.svelte';
import Timer, { timerEmbed } from '$lib/crafts/embeds/Timer.svelte';
import { chessPuzzlesEmbed } from './embeds/chess/embed';
import { quoteShuffleEmbed } from './embeds/quotes/embed';
import { styleGuidePreviewEmbed } from './embeds/style-guide/embed';

export const noteComponentEmbeds = createComponentEmbedRegistry([
	registerComponentEmbed(Timer, timerEmbed),
	registerComponentEmbed(ScrollingTabs, scrollingTabsEmbed),
	registerComponentEmbed(ScrollingTabsAnchors, scrollingTabsAnchorsEmbed),
	registerComponentEmbed(OverflowToggle, overflowToggleEmbed),
	// Lazy embeds: their code downloads only when a document actually
	// renders them.
	registerLazyComponentEmbed(() => import('$lib/crafts/embeds/ImageCarousel.svelte'), {
		id: 'core.ImageCarousel',
		label: 'Image Carousel',
		icon: 'mdi:view-carousel-outline',
		props: v.object({
			images: v.optional(v.array(v.string()), [])
		})
	}),
	registerLazyComponentEmbed(() => import('./embeds/Attachment.svelte'), {
		id: 'core.Attachment',
		label: 'Attachment',
		icon: 'mdi:paperclip',
		insertable: false,
		props: v.object({
			src: v.string(),
			name: v.string(),
			mediaType: v.string(),
			size: v.number()
		})
	}),
	registerLazyComponentEmbed(() => import('$lib/crafts/tic-tac-toe/TicTacToeGame.svelte'), {
		id: 'tic-tac-toe.game',
		label: 'Tic Tac Toe',
		icon: 'mdi:grid',
		props: v.object({})
	}),
	registerLazyComponentEmbed(
		() => import('$lib/crafts/rock-paper-scissors/RockPaperScissorsGame.svelte'),
		{
			id: 'rock-paper-scissors.game',
			label: 'Rock Paper Scissors',
			icon: 'mdi:hand-back-right-outline',
			props: v.object({})
		}
	),
	registerLazyComponentEmbed(() => import('./embeds/chess/ChessPuzzles.svelte'), chessPuzzlesEmbed),
	registerLazyComponentEmbed(
		() => import('./embeds/quotes/QuoteShuffle.svelte'),
		quoteShuffleEmbed
	),
	registerLazyComponentEmbed(
		() => import('./embeds/style-guide/StyleGuidePreview.svelte'),
		styleGuidePreviewEmbed
	)
]);
