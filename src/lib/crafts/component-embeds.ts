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
	// Games register lazily: their code downloads only when a document
	// actually renders them.
	registerLazyComponentEmbed(() => import('./tic-tac-toe/TicTacToeGame.svelte'), {
		id: 'tic-tac-toe.game',
		label: 'Tic Tac Toe',
		icon: 'mdi:grid',
		props: v.object({
			mode: v.optional(v.picklist(['ai', 'two-player']), 'ai')
		}),
		fields: {
			mode: { label: 'Mode', description: 'Play against the AI or another person.' }
		}
	}),
	registerLazyComponentEmbed(() => import('./rock-paper-scissors/RockPaperScissorsGame.svelte'), {
		id: 'rock-paper-scissors.game',
		label: 'Rock Paper Scissors',
		icon: 'mdi:hand-back-right-outline',
		props: v.object({})
	})
]);
