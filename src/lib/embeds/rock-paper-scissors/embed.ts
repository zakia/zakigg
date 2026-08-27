import * as v from 'valibot';
import { defineComponentEmbed } from '$lib/editor/components/registry';

export const propsSchema = v.object({});

export const embed = defineComponentEmbed({
	id: 'rock-paper-scissors.game',
	label: 'Rock Paper Scissors',
	description: 'Interactive rock paper scissors game',
	icon: 'mdi:hand-back-right-outline',
	keywords: ['game'],
	fields: [],
	props: propsSchema,
	load: () => import('./RockPaperScissorsGame.svelte')
});
