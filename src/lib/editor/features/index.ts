import { Prec } from '@codemirror/state';
import { keymap } from '@codemirror/view';
import * as frontmatter from './frontmatter';
import * as code from './code';
import * as link from './link';
import * as list from './list';
import * as media from './media';
import * as table from './table';
import * as rule from './rule';
import * as heading from './heading';
import * as format from './format';
import * as quote from './quote';
import * as embed from './embed';

/** Visual features are removed in source mode; the document and history stay intact. */
export const preview = [
	frontmatter.preview,
	code.preview,
	link.preview,
	list.preview,
	media.preview,
	table.preview,
	rule.preview,
	heading.preview,
	format.preview,
	quote.preview,
	embed.preview,
	Prec.highest(keymap.of(list.navigation))
];

/** Commands and styles shared by live and source modes. */
export const editing = [
	frontmatter.theme,
	code.theme,
	link.theme,
	list.theme,
	media.theme,
	table.theme,
	rule.theme,
	heading.theme,
	format.theme,
	quote.theme,
	embed.theme,
	link.events,
	Prec.highest(keymap.of([...link.keys, ...frontmatter.keys, ...code.keys, ...list.keys]))
];
