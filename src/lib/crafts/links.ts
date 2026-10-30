import { wikiLinkHref } from '#lib/editor/document/markdown-renderer.js';
import { normalizePageSlug } from '#lib/crafts/Page.js';
export const resolveCraftLink = (target: string) =>
	wikiLinkHref(target, (page) => `/crafts/${encodeURIComponent(normalizePageSlug(page))}`);
