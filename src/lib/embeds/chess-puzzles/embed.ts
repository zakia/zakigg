import * as v from 'valibot';
import { defineComponentEmbed } from '$lib/editor/components/registry';

export const embed = defineComponentEmbed({
	id: 'chess.puzzles',
	label: 'Chess Puzzles',
	description: 'Interactive chess puzzle collection',
	icon: 'mdi:chess-knight',
	keywords: ['game', 'board'],
	fields: [],
	props: v.object({}),
	load: () => import('./ChessPuzzles.svelte')
});
