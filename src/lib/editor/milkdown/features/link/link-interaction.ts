import type { EditorView } from '@milkdown/kit/prose/view';
import { $ctx } from '@milkdown/kit/utils';

export type LinkInteractionApi = {
	editSelection: (view: EditorView) => void;
};

const EMPTY_LINK_INTERACTION_API: LinkInteractionApi = {
	editSelection: () => undefined
};

export const linkInteractionApiCtx = $ctx<LinkInteractionApi, 'linkInteractionApi'>(
	EMPTY_LINK_INTERACTION_API,
	'linkInteractionApi'
);
