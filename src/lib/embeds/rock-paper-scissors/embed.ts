import * as v from 'valibot';
import type { ComponentEmbedConfig } from '$lib/editor/core';

export const propsSchema = v.object({});

export const embed = {
	id: 'rock-paper-scissors.game',
	label: 'Rock Paper Scissors',
	icon: 'mdi:hand-back-right-outline',
	props: propsSchema
} satisfies ComponentEmbedConfig<typeof propsSchema>;
