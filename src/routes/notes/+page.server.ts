import { error } from '@sveltejs/kit';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import {
	isCraftDocumentContent,
	normalizeCraftDocumentContent
} from '$lib/crafts/document-content';
import type { CraftDocument } from '$lib/crafts/types';
import type { PageServerLoad } from './$types';

const CRAFTS_DIR = 'src/lib/crafts';
const SLUG_RE = /^[a-z0-9-]+$/i;

type EditorTargetData = { kind: 'note' } | { kind: 'craft'; slug: string; document: CraftDocument };

export const load: PageServerLoad = async ({ url }) => {
	const slug = url.searchParams.get('craft');

	if (!slug) {
		return { editorTarget: { kind: 'note' } satisfies EditorTargetData };
	}

	if (!SLUG_RE.test(slug)) {
		error(400, 'Invalid craft slug');
	}

	const document = await readCraftDocument(slug);
	if (!document) {
		error(404, 'Craft document not found');
	}

	return { editorTarget: { kind: 'craft', slug, document } satisfies EditorTargetData };
};

async function readCraftDocument(slug: string): Promise<CraftDocument | null> {
	try {
		const source = await readFile(join(CRAFTS_DIR, slug, 'content.json'), 'utf8');
		const document = JSON.parse(source);
		return parseCraftDocument(document);
	} catch {
		return null;
	}
}

function parseCraftDocument(value: unknown): CraftDocument | null {
	if (!value || typeof value !== 'object') return null;

	const document = value as Partial<CraftDocument>;
	if (
		document.version !== 1 ||
		document.editor !== 'tiptap' ||
		!isCraftDocumentContent(document.content)
	) {
		return null;
	}

	return {
		version: 1,
		editor: 'tiptap',
		content: normalizeCraftDocumentContent(document.content),
		updatedAt: document.updatedAt
	};
}
