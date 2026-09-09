import { parseColumnWidths } from './column-widths';

export class ColumnsViewState {
	value = $state('50:50');

	constructor(value: string) {
		this.value = value;
	}

	get left() {
		return parseColumnWidths(this.value)[0];
	}
}
