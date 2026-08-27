import * as v from 'valibot';
import { defineComponentEmbed } from '$lib/editor/components/registry';

export const propsSchema = v.object({});

export const embed = defineComponentEmbed({
	id: 'tic-tac-toe.game',
	label: 'Tic Tac Toe',
	description: 'Interactive tic tac toe game',
	icon: 'mdi:grid',
	keywords: ['game', 'grid'],
	fields: [],
	props: propsSchema,
	load: () => import('./TicTacToeGame.svelte')
});
