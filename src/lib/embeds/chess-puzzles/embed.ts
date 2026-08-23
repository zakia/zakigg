import * as v from 'valibot';
import type { ComponentEmbedConfig } from '$lib/editor/core';

export const embed = {
	id: 'chess.puzzles',
	label: 'Chess Puzzles',
	icon: 'mdi:chess-knight',
	props: v.object({})
} satisfies ComponentEmbedConfig;
