/* eslint-disable @typescript-eslint/no-unused-vars */
async function checkEditorBrowser(page) {
	const { origin, hostname, pathname, editing } = await page.evaluate(() => ({
		origin: location.origin,
		hostname: location.hostname,
		pathname: location.pathname,
		editing: new URL(location.href).searchParams.has('edit')
	}));
	if (!['localhost', '127.0.0.1', '[::1]'].includes(hostname)) {
		throw new Error('Run this check against a local Vite development server.');
	}
	if (pathname !== '/crafts/style-guide' || !editing) {
		throw new Error('Open /crafts/style-guide?edit before running the editor browser check.');
	}
	const assert = (condition, message) => {
		if (!condition) throw new Error(message);
	};
	const handle = '__editorCssBrowserCheck';
	const viewport =
		page.viewportSize() ??
		(await page.evaluate(() => ({ width: innerWidth, height: innerHeight })));
	const imageUrl = `${origin}/__editor_css_browser_check__.png`;
	const imageRoute = (route) =>
		route.fulfill({
			contentType: 'image/svg+xml',
			body: '<svg xmlns="http://www.w3.org/2000/svg" width="120" height="80"><rect width="120" height="80" fill="#888"/></svg>'
		});
	const errors = [];
	const onPageError = (error) => errors.push(error.message);
	let originalSourceMode = false;
	let captured = false;
	const checks = [];
	const fixture = [
		'---',
		'id: page_editor_css_browser_check',
		'title: Editor CSS browser check',
		'slug: editor-css-browser-check',
		'date: 2026-01-01',
		'tags: [regression]',
		'published: false',
		'---',
		'',
		'Paragraph before widgets.',
		'',
		'<Callout kind="note" markdown="### Nested heading&#10;&#10;Nested paragraph." />',
		'',
		'## Heading after component',
		'',
		'Paragraph after component.',
		'',
		'| Name | Value |',
		'| --- | --- |',
		'| Browser | CSS |',
		'',
		'Paragraph after table.',
		'',
		'---',
		'',
		'Paragraph after rule.',
		'',
		'```js title="Fixture code"',
		'const browserProbe = true;',
		'```',
		'',
		'Paragraph after code.',
		'',
		'- Parent list item.',
		'    - Nested list item after widgets.',
		'- [ ] Task list item after widgets.',
		'',
		`![Browser regression image](${imageUrl})`,
		'',
		'## Heading after media',
		'',
		'Paragraph after media.',
		'',
		'> Quoted paragraph after widgets.',
		'',
		'Final paragraph after widgets.'
	].join('\n');
	const targets = [
		'Paragraph before widgets.',
		'Heading after component',
		'Paragraph after component.',
		'Paragraph after table.',
		'Paragraph after rule.',
		'const browserProbe = true;',
		'Paragraph after code.',
		'Nested list item after widgets.',
		'Task list item after widgets.',
		'Heading after media',
		'Paragraph after media.',
		'Quoted paragraph after widgets.',
		'Final paragraph after widgets.'
	];
	const settle = () =>
		page.evaluate(
			() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)))
		);
	const reset = async () => {
		await page.evaluate(
			({ handle, fixture }) => {
				const { view } = window[handle];
				view.dispatch({
					changes: { from: 0, to: view.state.doc.length, insert: fixture },
					selection: { anchor: fixture.length }
				});
				window.scrollTo(0, 0);
				view.requestMeasure();
			},
			{ handle, fixture }
		);
		await settle();
		await page.locator('.editor-prose .callout-content').waitFor({ state: 'visible' });
	};
	try {
		await page.locator('.cm-editor .editor-prose').waitFor({ state: 'visible' });
		page.on('pageerror', onPageError);
		await page.route(imageUrl, imageRoute);
		originalSourceMode =
			(await page.getByRole('button', { name: 'Show live preview', exact: true }).count()) > 0;
		await page.evaluate(async (handle) => {
			if (window[handle]) throw new Error('An editor browser check is already running.');
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
				scroll: { x: scrollX, y: scrollY }
			};
		}, handle);
		captured = true;
		if (originalSourceMode) {
			await page.getByRole('button', { name: 'Show live preview', exact: true }).click();
		}
		for (const size of [
			{ width: 1440, height: 900 },
			{ width: 390, height: 844 }
		]) {
			await page.setViewportSize(size);
			for (const target of targets) {
				await reset();
				const offset = 4;
				const expected = fixture.indexOf(target) + offset;
				await page.evaluate(
					({ handle, expected }) => {
						const { view, EditorView } = window[handle];
						view.dispatch({ effects: EditorView.scrollIntoView(expected, { y: 'center' }) });
					},
					{ handle, expected }
				);
				await settle();
				const line = page.locator('.editor-prose > .cm-line').filter({ hasText: target });
				assert((await line.count()) === 1, `Expected one editor line containing ${target}`);
				await line.scrollIntoViewIfNeeded();
				await page.waitForFunction(() =>
					[...document.querySelectorAll('.editor-prose .media-embed img')].every(
						(image) => image.complete && image.naturalWidth > 0
					)
				);
				await settle();
				const point = await line.evaluate(
					(element, { target, offset }) => {
						const textOffset = element.textContent.indexOf(target) + offset;
						const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
						let consumed = 0;
						for (let node = walker.nextNode(); node; node = walker.nextNode()) {
							if (consumed + node.textContent.length > textOffset) {
								const range = document.createRange();
								range.setStart(node, textOffset - consumed);
								range.setEnd(node, textOffset - consumed + 1);
								const rect = range.getBoundingClientRect();
								if (!rect.width || !rect.height) throw new Error('Target text has no bounds.');
								return { x: rect.left + rect.width * 0.1, y: rect.top + rect.height / 2 };
							}
							consumed += node.textContent.length;
						}
						throw new Error(`Could not locate target text: ${target}`);
					},
					{ target, offset }
				);
				await page.mouse.click(point.x, point.y);
				const selection = await page.evaluate((handle) => {
					const { view } = window[handle];
					const { from, to, head } = view.state.selection.main;
					return { from, to, line: view.state.doc.lineAt(head).text };
				}, handle);
				assert(
					selection.from === expected && selection.to === expected,
					`${size.width}px click on ${target} selected ${selection.from}:${selection.to} (${selection.line}); expected ${expected}`
				);
				const marker = '[typed]';
				await page.keyboard.insertText(marker);
				const actual = await page.evaluate(
					(handle) => window[handle].view.state.doc.toString(),
					handle
				);
				assert(
					actual === fixture.slice(0, expected) + marker + fixture.slice(expected),
					`${size.width}px typing changed the wrong source location after ${target}`
				);
				checks.push({ width: size.width, target });
			}
		}
		assert(errors.length === 0, `Browser errors: ${errors.join('; ')}`);
	} finally {
		if (captured) {
			await page.evaluate((handle) => {
				const { view, original, selection } = window[handle];
				view.dispatch({
					changes: { from: 0, to: view.state.doc.length, insert: original },
					selection
				});
			}, handle);
			const sourceMode =
				(await page.getByRole('button', { name: 'Show live preview', exact: true }).count()) > 0;
			if (sourceMode !== originalSourceMode) {
				await page
					.getByRole('button', {
						name: sourceMode ? 'Show live preview' : 'Show Markdown source (</>)',
						exact: true
					})
					.click();
			}
			await page.setViewportSize(viewport);
			await settle();
			await page.evaluate((handle) => {
				const saved = window[handle];
				if (saved.view.state.doc.toString() !== saved.original) {
					throw new Error('The browser check did not restore the original Markdown.');
				}
				if (saved.focused) saved.view.focus();
				window.scrollTo(saved.scroll.x, saved.scroll.y);
				delete window[handle];
			}, handle);
		}
		await page.unroute(imageUrl, imageRoute);
		page.off('pageerror', onPageError);
	}
	return { clicksAndEdits: checks.length, viewports: [1440, 390], sourceRestored: true };
}
