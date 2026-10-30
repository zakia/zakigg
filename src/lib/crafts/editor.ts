import { mount, unmount } from 'svelte';
import Embed from '#lib/editor/components/Embed.svelte';
import { resolveCraftLink } from './links';
import {
	saveNoteAsset,
	resolveNoteAssetObjectUrl
} from '#lib/editor/document/persistence/storage.js';
import { createMediaMarkdown } from '#lib/editor/features/media/insert.js';
import { assetIdFromMediaUrl } from '#lib/editor/features/media/source.js';
import type { EditorOptions } from '#lib/editor/configuration.js';
import { tagColor } from '#lib/components/tag.js';
import { componentEmbeds } from '#lib/embeds/index.js';

export const craftEditorOptions: EditorOptions = {
	resolveWikiLink: resolveCraftLink,
	tagColor,
	insertFile: (file) => createMediaMarkdown(file, saveNoteAsset),
	resolveAttachment: async (source) => {
		const id = assetIdFromMediaUrl(source);
		return id ? resolveNoteAssetObjectUrl(id) : source;
	},
	renderEmbed(target, attrs) {
		const instance = mount(Embed, { target, props: { attrs, registry: componentEmbeds } });
		return () => {
			void unmount(instance);
		};
	}
};
