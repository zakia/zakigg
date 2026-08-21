import {
	createComponentEmbedRegistry,
	registerLazyComponentEmbed
} from '$lib/editor/component-embeds';
import { embed as attachment } from './attachment/embed';
import { embed as chessPuzzles } from './chess-puzzles/embed';
import { embed as imageCarousel } from './carousel/embed';
import { embed as quoteShuffle } from './quote-shuffle/embed';
import { embed as rockPaperScissors } from './rock-paper-scissors/embed';
import { embed as styleGuidePreview } from './style-guide-preview/embed';
import { embed as ticTacToe } from './tic-tac-toe/embed';
import { embed as timer } from './timer/embed';

export const componentEmbeds = createComponentEmbedRegistry([
	registerLazyComponentEmbed(() => import('./timer/Timer.svelte'), timer),
	registerLazyComponentEmbed(() => import('./attachment/Attachment.svelte'), attachment),
	registerLazyComponentEmbed(() => import('./carousel/Carousel.svelte'), imageCarousel),
	registerLazyComponentEmbed(() => import('./tic-tac-toe/TicTacToeGame.svelte'), ticTacToe),
	registerLazyComponentEmbed(
		() => import('./rock-paper-scissors/RockPaperScissorsGame.svelte'),
		rockPaperScissors
	),
	registerLazyComponentEmbed(() => import('./chess-puzzles/ChessPuzzles.svelte'), chessPuzzles),
	registerLazyComponentEmbed(() => import('./quote-shuffle/QuoteShuffle.svelte'), quoteShuffle),
	registerLazyComponentEmbed(
		() => import('./style-guide-preview/StyleGuidePreview.svelte'),
		styleGuidePreview
	)
]);
