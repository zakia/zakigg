import type { Editor, Range } from '@tiptap/core';
import type { BlockCatalog } from '../blocks';
import type { MediaBlockAttrs, MediaBlockKind } from '../media-block';
import { insertTable } from '../tables';

type EditorCommandServiceOptions = {
	getEditor: () => Editor | undefined;
	blockCatalog: BlockCatalog;
	requestMedia: (kind: MediaBlockKind) => void;
};

/**
 * Translates product-level editor commands into Tiptap operations. UI surfaces
 * call this service instead of assembling chains or block service objects.
 */
export class EditorCommandService {
	#getEditor: () => Editor | undefined;
	#blockCatalog: BlockCatalog;
	#requestMedia: (kind: MediaBlockKind) => void;

	constructor({ getEditor, blockCatalog, requestMedia }: EditorCommandServiceOptions) {
		this.#getEditor = getEditor;
		this.#blockCatalog = blockCatalog;
		this.#requestMedia = requestMedia;
	}

	insertBlock(id: string, range?: Range) {
		const editor = this.#getEditor();
		if (!editor) return false;

		return this.#blockCatalog.insert(id, {
			editor,
			range,
			services: {
				insertTable: () => insertTable(editor),
				requestMedia: this.#requestMedia
			}
		});
	}

	insertMedia(attrs: Partial<MediaBlockAttrs> & { kind: MediaBlockKind; src: string }) {
		const editor = this.#getEditor();
		if (!editor || !attrs.src) return false;

		return editor.chain().focus().insertMediaBlock(attrs).run();
	}

	indentListItem() {
		return this.#getEditor()?.chain().focus().sinkListItem('listItem').run() ?? false;
	}

	outdentListItem() {
		return this.#getEditor()?.chain().focus().liftListItem('listItem').run() ?? false;
	}
}
