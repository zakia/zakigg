export type SelectionToolbarSnapshot = {
	bold: boolean;
	italic: boolean;
	strike: boolean;
	code: boolean;
	link: boolean;
};

const EMPTY_SNAPSHOT: SelectionToolbarSnapshot = {
	bold: false,
	italic: false,
	strike: false,
	code: false,
	link: false
};

export class SelectionToolbarState {
	visible = $state(false);
	bold = $state(false);
	italic = $state(false);
	strike = $state(false);
	code = $state(false);
	link = $state(false);

	update(snapshot: SelectionToolbarSnapshot) {
		this.bold = snapshot.bold;
		this.italic = snapshot.italic;
		this.strike = snapshot.strike;
		this.code = snapshot.code;
		this.link = snapshot.link;
	}

	reset() {
		this.update(EMPTY_SNAPSHOT);
	}
}
