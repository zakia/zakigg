import * as v from 'valibot';
import { defineComponentEmbed } from '$lib/editor/components/registry';

export const styleGuideSections = ['colors', 'buttons', 'cards', 'forms'] as const;
export type StyleGuideSection = (typeof styleGuideSections)[number];

export const embed = defineComponentEmbed({
	id: 'style-guide.preview',
	label: 'Style Guide Preview',
	description: 'Live design-system section preview',
	icon: 'mdi:palette-outline',
	keywords: ['design', 'tokens', 'components'],
	fields: [
		{
			name: 'section',
			label: 'Section',
			type: 'select',
			options: styleGuideSections.map((section) => ({ label: section, value: section }))
		}
	],
	props: v.object({
		section: v.picklist(styleGuideSections)
	}),
	initialProps: () => ({ section: 'colors' as const }),
	load: () => import('./StyleGuidePreview.svelte')
});
