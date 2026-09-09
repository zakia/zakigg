export type SelectionToolbarSnapshot = {
	bold: boolean;
	italic: boolean;
	strike: boolean;
	code: boolean;
	link: boolean;
	linkHref: string;
};

const EMPTY_SNAPSHOT: SelectionToolbarSnapshot = {
	bold: false,
	italic: false,
	strike: false,
	code: false,
	link: false,
	linkHref: ''
};

export class SelectionToolbarState {
	visible = $state(false);
	bold = $state(false);
	italic = $state(false);
	strike = $state(false);
	code = $state(false);
	link = $state(false);
	linkHref = $state('');

	update(snapshot: SelectionToolbarSnapshot) {
		this.bold = snapshot.bold;
		this.italic = snapshot.italic;
		this.strike = snapshot.strike;
		this.code = snapshot.code;
		this.link = snapshot.link;
		this.linkHref = snapshot.linkHref;
	}

	reset() {
		this.update(EMPTY_SNAPSHOT);
	}
}
