import * as v from 'valibot';
import type { ComponentEmbedConfig } from '$lib/editor/component-embeds';

export const chessPuzzlesEmbed = {
	id: 'chess.puzzles',
	label: 'Chess Puzzles',
	icon: 'mdi:chess-knight',
	props: v.object({})
} satisfies ComponentEmbedConfig;
