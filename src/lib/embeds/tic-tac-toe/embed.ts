import * as v from 'valibot';
import type { ComponentEmbedConfig } from '$lib/editor/core';

export const propsSchema = v.object({});

export const embed = {
	id: 'tic-tac-toe.game',
	label: 'Tic Tac Toe',
	icon: 'mdi:grid',
	props: propsSchema
} satisfies ComponentEmbedConfig<typeof propsSchema>;
