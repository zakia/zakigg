/* eslint-disable @typescript-eslint/no-unused-vars */
async function checkEditorListSelection(page) {
	const validPage = await page.evaluate(
		() =>
			['localhost', '127.0.0.1', '[::1]'].includes(location.hostname) &&
			location.pathname === '/crafts/style-guide' &&
			new URL(location.href).searchParams.has('edit')
	);
	if (!validPage) throw new Error('Open the local Vite /crafts/style-guide?edit page first.');
	const handle = '__editorListSelectionBrowserCheck';
	const viewport =
		page.viewportSize() ??
		(await page.evaluate(() => ({ width: innerWidth, height: innerHeight })));
	const wrapped =
		'Wrapped child alpha has enough words to occupy several visual lines on a narrow screen while its Markdown remains one list item and its selected text stays attached to the pointer.';
	const fixture = [
		'Before list.',
		'',
		'- Alpha list item has several words.',
		'- Beta list item has several words.',
		'    - Nested alpha has several words.',
		'    - Nested beta has several words.',
		'',
		'1. Ordered alpha has several words.',
		'2. Ordered beta has several words.',
		'3. Ordered gamma has several words.',
		'',
		'- [ ] Task alpha has several words.',
		'- [x] Task beta has several words.',
		'',
		'- Parent of wrapped items.',
		`    - ${wrapped}`,
		'    - Wrapped child beta has several words.',
		'',
		'- - Same-line nested text has several words.',
		'',
		'> - Quoted alpha has several words.',
		'> - Quoted beta has several words.',
		'',
		'> > - Nested quoted alpha has several words.',
		'> > - Nested quoted beta has several words.',
		'',
		'After list.'
	].join('\n');
	const dragCases = [
		{ name: 'bullet text forward', from: ['Alpha list', 2], to: ['Alpha list', 17] },
		{ name: 'bullet across forward', from: ['Alpha list', 2], to: ['Beta list', 15] },
		{ name: 'bullet across backward', from: ['Beta list', 15], to: ['Alpha list', 2] },
		{ name: 'nested forward', from: ['Nested alpha', 3], to: ['Nested beta', 15] },
		{ name: 'nested backward', from: ['Nested beta', 15], to: ['Nested alpha', 3] },
		{ name: 'ordered forward', from: ['Ordered alpha', 4], to: ['Ordered gamma', 17] },
		{ name: 'ordered backward', from: ['Ordered gamma', 17], to: ['Ordered alpha', 4] },
		{ name: 'bullet body to text start', from: ['Alpha list', 18], to: ['Alpha list', 0] },
		{ name: 'nested body to text start', from: ['Nested alpha', 18], to: ['Nested alpha', 0] },
		{ name: 'ordered body to text start', from: ['Ordered alpha', 18], to: ['Ordered alpha', 0] },
		{ name: 'task forward', from: ['Task alpha', 3], to: ['Task beta', 15] },
		{ name: 'task backward', from: ['Task beta', 15], to: ['Task alpha', 3] },
		{ name: 'same-line nested body', from: ['Same-line nested', 2], to: ['Same-line nested', 20] }
	];
	const shiftCases = [
		{ name: 'bullet Shift-click forward', from: ['Alpha list', 2], to: ['Beta list', 15] },
		{
			name: 'ordered Shift-click backward',
			from: ['Ordered gamma', 17],
			to: ['Ordered alpha', 4]
		}
	];
	const wrappedCases = [
		{ name: 'wrapped nested forward', from: [wrapped, 80], to: ['Wrapped child beta', 15] },
		{ name: 'wrapped nested backward', from: ['Wrapped child beta', 15], to: [wrapped, 80] }
	];
	const markerCases = [
		{ name: 'bullet Shift-click marker', from: ['Alpha list', 5], to: ['Beta list', 0] },
		{ name: 'nested Shift-click marker', from: ['Nested alpha', 5], to: ['Nested beta', 0] },
		{ name: 'ordered Shift-click marker', from: ['Ordered alpha', 5], to: ['Ordered gamma', 0] }
	];
	const markerDragCases = [
		{ name: 'bullet marker drag forward', from: ['Alpha list', 0], to: ['Beta list', 15] },
		{ name: 'nested marker drag forward', from: ['Nested alpha', 0], to: ['Nested beta', 15] },
		{ name: 'ordered marker drag forward', from: ['Ordered alpha', 0], to: ['Ordered gamma', 17] }
	];
	const prefixCases = [
		{
			name: 'raw bullet prefix selection',
			from: ['- Alpha list', 0],
			to: ['Alpha list', 10],
			reveal: true
		},
		{
			name: 'raw nested prefix selection',
			from: ['    - Nested alpha', 0],
			to: ['Nested alpha', 10],
			reveal: true
		},
		{
			name: 'raw ordered prefix selection',
			from: ['1. Ordered alpha', 0],
			to: ['Ordered alpha', 10],
			reveal: true
		},
		{
			name: 'same-line nested prefix selection',
			from: ['- - Same-line nested', 0],
			to: ['Same-line nested', 10],
			reveal: true
		}
	];
	const quotedCases = [
		{ name: 'quoted list forward', from: ['Quoted alpha', 4], to: ['Quoted beta', 15] },
		{ name: 'quoted list backward', from: ['Quoted beta', 15], to: ['Quoted alpha', 4] },
		{
			name: 'nested quoted list forward',
			from: ['Nested quoted alpha', 4],
			to: ['Nested quoted beta', 15]
		},
		{
			name: 'nested quoted list backward',
			from: ['Nested quoted beta', 15],
			to: ['Nested quoted alpha', 4]
		}
	];
	const settle = () =>
		page.evaluate(
			() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)))
		);
	const setMode = async (source) => {
		const current =
			(await page.getByRole('button', { name: 'Show live preview', exact: true }).count()) > 0;
		if (current !== source) {
			await page
				.getByRole('button', {
					name: current ? 'Show live preview' : 'Show Markdown source (</>)',
					exact: true
				})
				.click();
			await settle();
		}
	};
	const setViewport = async (size) => {
		await page.setViewportSize(size);
		await settle();
	};
	const point = ([phrase, offset]) =>
		page
			.locator('.editor-prose > .cm-line')
			.filter({ hasText: new RegExp(phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')) })
			.evaluate(
				(element, { phrase, offset }) => {
					const wanted = element.textContent.indexOf(phrase) + offset;
					const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
					let consumed = 0;
					for (let node = walker.nextNode(); node; node = walker.nextNode()) {
						if (consumed + node.textContent.length > wanted) {
							const range = document.createRange();
							range.setStart(node, wanted - consumed);
							range.setEnd(node, wanted - consumed + 1);
							const bounds = range.getBoundingClientRect();
							if (!bounds.width || !bounds.height) throw new Error('Text point has no bounds.');
							return { x: bounds.left + bounds.width * 0.1, y: bounds.top + bounds.height / 2 };
						}
						consumed += node.textContent.length;
					}
					throw new Error(`Missing text point: ${phrase} + ${offset}`);
				},
				{ phrase, offset }
			);
	const results = [];
	let captured = false;
	let originalSourceMode = false;
	const runCase = async (item, { source, width, input }) => {
		const expected = {
			anchor: fixture.indexOf(item.from[0]) + item.from[1],
			head: fixture.indexOf(item.to[0]) + item.to[1]
		};
		await page.evaluate(
			({ handle, fixture, expected, reveal }) => {
				const { view, EditorView } = window[handle];
				view.dispatch({
					changes: { from: 0, to: view.state.doc.length, insert: fixture },
					selection: { anchor: reveal ? expected.anchor : fixture.length },
					effects: EditorView.scrollIntoView(Math.floor((expected.anchor + expected.head) / 2), {
						y: 'center'
					})
				});
				view.focus();
				view.requestMeasure();
			},
			{ handle, fixture, expected, reveal: item.reveal ?? false }
		);
		await settle();
		let from;
		let to;
		for (let attempt = 0; attempt < 5; attempt++) {
			from = await point(item.from);
			to = await point(item.to);
			const height = await page.evaluate(() => innerHeight);
			if (Math.min(from.y, to.y) >= 80 && Math.max(from.y, to.y) <= height - 80) break;
			await page.evaluate(
				({ from, to }) => window.scrollBy(0, (from.y + to.y) / 2 - innerHeight / 2),
				{ from, to }
			);
			await settle();
		}
		if (item.name.startsWith('wrapped')) {
			const first = await point([wrapped, 0]);
			const continuation = await point([wrapped, 80]);
			if (continuation.y <= first.y) throw new Error('The mobile fixture did not wrap.');
		}
		if (input === 'marker-drag') {
			from = await page
				.locator('.editor-prose > .cm-line')
				.filter({ hasText: item.from[0] })
				.locator('.list-marker')
				.evaluate((element) => {
					const range = document.createRange();
					range.selectNodeContents(element);
					const bounds = range.getBoundingClientRect();
					return { x: bounds.left + bounds.width * 0.1, y: bounds.top + bounds.height / 2 };
				});
		}
		if (input === 'marker') {
			await page.mouse.click(from.x, from.y);
			await page
				.locator('.editor-prose > .cm-line')
				.filter({ hasText: item.to[0] })
				.locator('.list-marker')
				.click({ modifiers: ['Shift'] });
		} else if (input === 'shift') {
			await page.mouse.click(from.x, from.y);
			await page.keyboard.down('Shift');
			try {
				await page.mouse.click(to.x, to.y);
			} finally {
				await page.keyboard.up('Shift');
			}
		} else {
			await page.mouse.move(from.x, from.y);
			await page.mouse.down();
			try {
				await page.mouse.move(to.x, to.y, { steps: 20 });
				await settle();
			} finally {
				await page.mouse.up();
			}
		}
		await settle();
		const actual = await page.evaluate((handle) => {
			const { view } = window[handle];
			const { anchor, head, from, to } = view.state.selection.main;
			return {
				anchor,
				head,
				text: view.state.sliceDoc(from, to),
				source: view.state.doc.toString()
			};
		}, handle);
		const prefixStart = fixture.lastIndexOf('\n', expected.head - 1) + 1;
		const anchorPrefixStart = fixture.lastIndexOf('\n', expected.anchor - 1) + 1;
		const anchorCorrect =
			input === 'marker-drag'
				? actual.anchor >= anchorPrefixStart &&
					actual.anchor <= expected.anchor &&
					actual.anchor !== actual.head
				: actual.anchor === expected.anchor;
		const headCorrect =
			input === 'marker'
				? actual.head >= prefixStart &&
					actual.head <= expected.head &&
					actual.head !== actual.anchor
				: actual.head === expected.head;
		const desiredHead = input === 'marker' ? actual.head : expected.head;
		const desiredAnchor = input === 'marker-drag' ? actual.anchor : expected.anchor;
		const start = Math.min(desiredAnchor, desiredHead);
		const end = Math.max(desiredAnchor, desiredHead);
		const selectionCorrect =
			anchorCorrect && headCorrect && actual.text === fixture.slice(start, end);
		const sourceUnchanged = actual.source === fixture;
		const marker = '[replacement]';
		await page.keyboard.insertText(marker);
		const replacementCorrect = await page.evaluate(
			({ handle, expected }) => window[handle].view.state.doc.toString() === expected,
			{ handle, expected: fixture.slice(0, start) + marker + fixture.slice(end) }
		);
		results.push({
			name: item.name,
			mode: source ? 'source' : 'live',
			width,
			pass: selectionCorrect && sourceUnchanged && replacementCorrect,
			expected:
				input === 'marker'
					? { anchor: expected.anchor, headRange: [prefixStart, expected.head] }
					: input === 'marker-drag'
						? { anchorRange: [anchorPrefixStart, expected.anchor], head: expected.head }
						: expected,
			actual: { anchor: actual.anchor, head: actual.head, text: actual.text },
			sourceUnchanged,
			replacementCorrect
		});
	};
	try {
		await page.locator('.cm-editor .editor-prose').waitFor({ state: 'visible' });
		originalSourceMode =
			(await page.getByRole('button', { name: 'Show live preview', exact: true }).count()) > 0;
		await page.evaluate(async (handle) => {
			if (window[handle]) throw new Error('A list selection check is already running.');
			const moduleUrl = performance
				.getEntriesByType('resource')
				.map((entry) => entry.name)
				.find((url) => new URL(url).pathname.endsWith('/@codemirror_view.js'));
			const { EditorView } = await import(
				moduleUrl ?? '/node_modules/.vite/deps/@codemirror_view.js'
			);
			const view = EditorView.findFromDOM(document.querySelector('.cm-editor'));
			if (!view) throw new Error('Could not find the live CodeMirror EditorView.');
			window[handle] = {
				view,
				EditorView,
				original: view.state.doc.toString(),
				selection: view.state.selection,
				focused: view.hasFocus,
				scroll: { x: scrollX, y: scrollY },
				scrollBehavior: document.documentElement.style.scrollBehavior
			};
			document.documentElement.style.scrollBehavior = 'auto';
		}, handle);
		captured = true;
		await setMode(false);
		await setViewport({ width: 1440, height: 900 });
		for (const item of dragCases)
			await runCase(item, { source: false, width: 1440, input: 'drag' });
		for (const item of shiftCases)
			await runCase(item, { source: false, width: 1440, input: 'shift' });
		for (const item of markerCases)
			await runCase(item, { source: false, width: 1440, input: 'marker' });
		for (const item of markerDragCases)
			await runCase(item, { source: false, width: 1440, input: 'marker-drag' });
		for (const item of prefixCases)
			await runCase(item, { source: false, width: 1440, input: 'drag' });
		for (const item of quotedCases)
			await runCase(item, { source: false, width: 1440, input: 'drag' });
		await setViewport({ width: 390, height: 844 });
		for (const item of wrappedCases)
			await runCase(item, { source: false, width: 390, input: 'drag' });
		await setMode(true);
		for (const item of wrappedCases)
			await runCase(item, { source: true, width: 390, input: 'drag' });
		await setViewport({ width: 1440, height: 900 });
		for (const item of dragCases.filter((item) =>
			['bullet across forward', 'nested forward', 'ordered forward'].includes(item.name)
		)) {
			await runCase(item, { source: true, width: 1440, input: 'drag' });
		}
		const failed = results.filter((result) => !result.pass);
		if (failed.length) {
			throw new Error(
				`${failed.length}/${results.length} list selection checks failed: ${JSON.stringify(failed)}`
			);
		}
	} finally {
		await page.mouse.up();
		await page.keyboard.up('Shift');
		if (captured) {
			await page.evaluate((handle) => {
				const { view, original, selection } = window[handle];
				view.dispatch({
					changes: { from: 0, to: view.state.doc.length, insert: original },
					selection
				});
			}, handle);
			await setMode(originalSourceMode);
			await page.setViewportSize(viewport);
			await settle();
			await page.evaluate((handle) => {
				const saved = window[handle];
				if (saved.view.state.doc.toString() !== saved.original) {
					throw new Error('The list check did not restore the original Markdown.');
				}
				if (saved.focused) saved.view.focus();
				window.scrollTo({ left: saved.scroll.x, top: saved.scroll.y, behavior: 'instant' });
				document.documentElement.style.scrollBehavior = saved.scrollBehavior;
				delete window[handle];
			}, handle);
		}
	}
	return {
		selectionAndReplacementCases: results.length,
		viewports: [1440, 390],
		sourceRestored: true
	};
}
