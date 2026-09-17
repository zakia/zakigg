import { sanitizeLinkHref } from '@milkdown/kit/preset/commonmark';
import { Plugin } from '@milkdown/kit/prose/state';
import { $prose } from '@milkdown/kit/utils';

function linkFromEvent(event: MouseEvent) {
	const target = event.target;
	if (!(target instanceof Element)) return '';
	return sanitizeLinkHref(target.closest<HTMLAnchorElement>('a[href]')?.getAttribute('href'));
}

/**
 * Contenteditable owns an ordinary click so links remain editable. Modified
 * clicks follow the browser/editor convention and open the destination.
 */
export const linkNavigationFeature = $prose(
	() =>
		new Plugin({
			props: {
				handleClick: (_view, _position, event) => {
					if (!event.metaKey && !event.ctrlKey) return false;
					const href = linkFromEvent(event);
					if (!href) return false;

					event.preventDefault();
					window.open(href, '_blank', 'noopener,noreferrer');
					return true;
				}
			}
		})
);
