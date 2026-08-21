import * as v from 'valibot';
import type { ComponentEmbedConfig } from '$lib/editor/component-embeds';

export const propsSchema = v.object({
	endIsoTimestamp: v.pipe(
		v.string(),
		v.isoTimestamp('Use an ISO timestamp like 2026-06-21T18:00:00.000Z.')
	)
});

export type TimerProps = v.InferOutput<typeof propsSchema>;

export const embed = {
	id: 'core.Timer',
	label: 'Timer',
	icon: 'mdi:timer-outline',
	props: propsSchema,
	initialProps: () => ({
		endIsoTimestamp: new Date(Date.now() + 60 * 60 * 1000).toISOString()
	})
} satisfies ComponentEmbedConfig<typeof propsSchema>;
