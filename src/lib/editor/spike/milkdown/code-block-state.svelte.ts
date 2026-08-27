export class CodeBlockState {
	language = $state('');
	text = $state('');
	selected = $state(false);

	constructor(language: string, text: string) {
		this.language = language;
		this.text = text;
	}
}
