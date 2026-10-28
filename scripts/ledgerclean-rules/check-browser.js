/* eslint-disable @typescript-eslint/no-unused-vars */
async function checkLedgerCleanRules(page) {
	await page.waitForFunction(
		() => !document.querySelector('.header-actions button.primary')?.disabled
	);
	const errors = [];
	page.on('pageerror', (error) => errors.push(error.message));
	const assert = (condition, message) => {
		if (!condition) throw new Error(message);
	};
	const nav = (name) =>
		page.getByRole('navigation', { name: 'Workspace views' }).getByRole('button', { name });
	const choose = async (input, name) => {
		await input.scrollIntoViewIfNeeded();
		await input.click();
		await input.fill(name);
		await page.getByRole('listbox').getByRole('option', { name, exact: true }).click();
	};
	const overview = async () => nav('Overview').click();
	const rules = async () => {
		await nav(/^Merchants & rules/).click();
		await page.getByRole('button', { name: /^Rules \d/ }).click();
	};
	const category = (description) =>
		page.getByRole('combobox', {
			name: `Category for ${description} on 2026-10-${description === 'LOCAL COFFEE #123' ? '01' : description === 'LOCAL COFFEE #124' ? '02' : description === 'COFFEE BAR' ? '03' : description === 'STARBUCKS 123' ? '05' : description === 'CORNER RESTAURANT' ? '06' : '10'}`,
			exact: true
		});
	await nav('Settings').click();
	assert(
		(await page.getByRole('button', { name: 'Clear all transactions', exact: true }).count()) === 0,
		'Use a fresh isolated browser; this workspace already contains imports.'
	);
	await page.evaluate(() => {
		const csv =
			'Date,Description,Amount,Account,Account Type\n2026-10-01,LOCAL COFFEE #123,-5,Everyday,Chequing\n2026-10-02,LOCAL COFFEE #124,-6,Everyday,Chequing\n2026-10-03,COFFEE BAR,-10,Everyday,Chequing\n2026-10-04,BARBER SHOP,-25,Everyday,Chequing\n2026-10-05,STARBUCKS 123,-7,Everyday,Chequing\n2026-10-06,CORNER RESTAURANT,-30,Everyday,Chequing\n2026-10-07,MYSTERY MERCHANT,-12,Everyday,Chequing\n2026-10-08,PAYROLL,3000,Everyday,Chequing\n2026-10-09,PAYMENT RECEIVED - THANK YOU,100,Card,Credit card\n2026-10-10,LOCAL COFFEE,5,Card,Credit card';
		const input = document.querySelector('input[aria-label="Import CSV files"]');
		const files = new DataTransfer();
		files.items.add(new File([csv], 'synthetic-rules.csv', { type: 'text/csv' }));
		input.files = files.files;
		input.dispatchEvent(new Event('change', { bubbles: true }));
	});
	await page.getByText('MYSTERY MERCHANT', { exact: true }).first().waitFor();
	assert(
		(await page.getByText(/Local AI ready|Suggest categories|model download/).count()) === 0,
		'Retired AI controls are still present.'
	);
	await overview();
	assert(
		(await category('LOCAL COFFEE #123').inputValue()) === 'Dining / Cafés',
		'Coffee starter did not apply.'
	);
	assert(
		(await category('COFFEE BAR').inputValue()) === 'Dining / Cafés',
		'Initial pattern order is wrong.'
	);
	await choose(category('LOCAL COFFEE #123'), 'Business');
	assert(
		(await category('LOCAL COFFEE #124').inputValue()) === 'Dining / Cafés',
		'A transaction exception modified another transaction.'
	);
	await page.getByRole('button', { name: 'Make merchant rule…', exact: true }).click();
	await page
		.getByRole('region', { name: 'Rule editor', exact: true })
		.getByRole('button', { name: 'Save rule', exact: true })
		.click();
	await overview();
	assert(
		(await category('LOCAL COFFEE #124').inputValue()) === 'Business',
		'A merchant rule did not cover another reference.'
	);
	assert(
		(await category('LOCAL COFFEE').inputValue()) === 'Dining / Cafés',
		'A cash merchant rule incorrectly covered a credit refund.'
	);
	await choose(category('LOCAL COFFEE #123'), 'Shopping and Personal');
	await rules();
	await page.getByRole('checkbox', { name: 'Enable rule LOCAL COFFEE', exact: true }).uncheck();
	await page.getByRole('button', { name: 'Apply change', exact: true }).click();
	await overview();
	assert(
		(await category('LOCAL COFFEE #123').inputValue()) === 'Shopping and Personal',
		'Disabling a rule replaced a transaction exception.'
	);
	assert(
		(await category('LOCAL COFFEE #124').inputValue()) === 'Dining / Cafés',
		'Disabling a merchant rule did not reveal its pattern fallback.'
	);
	await rules();
	await page.getByRole('button', { name: '+ New rule', exact: true }).click();
	let editor = page.getByRole('region', { name: 'Rule editor', exact: true });
	await editor.getByRole('combobox', { name: 'When', exact: true }).selectOption('regex');
	await editor.getByRole('textbox', { name: 'Rule pattern', exact: true }).fill('[');
	assert(
		await editor.getByRole('button', { name: 'Save rule', exact: true }).isDisabled(),
		'Invalid regex can be saved.'
	);
	await editor.getByRole('button', { name: 'Cancel', exact: true }).click();
	await page.getByRole('button', { name: '+ New rule', exact: true }).click();
	editor = page.getByRole('region', { name: 'Rule editor', exact: true });
	await editor.getByRole('textbox', { name: 'Rule pattern', exact: true }).fill('coffee');
	await choose(
		editor.getByRole('combobox', { name: 'Rule category', exact: true }),
		'Dining / Restaurants'
	);
	assert(
		(await editor.innerText()).includes('overlapping match'),
		'Overlapping rules have no explanation.'
	);
	await editor.getByRole('button', { name: 'Save rule', exact: true }).click();
	await page.getByRole('button', { name: 'Move rule COFFEE later', exact: true }).click();
	await page.getByRole('button', { name: 'Apply change', exact: true }).click();
	await overview();
	assert(
		(await category('COFFEE BAR').inputValue()) === 'Dining / Cafés',
		'Moving a pattern did not change its priority.'
	);
	await rules();
	const restaurant = 'restaurant, restaurants, bar, bistro, pub, diner';
	await page.getByRole('checkbox', { name: `Enable rule ${restaurant}`, exact: true }).uncheck();
	await page.getByRole('button', { name: 'Apply change', exact: true }).click();
	await page.getByRole('button', { name: 'Delete rule STARBUCKS', exact: true }).click();
	await page.getByRole('button', { name: 'Apply change', exact: true }).click();
	await page.getByRole('status').filter({ hasText: 'Saved in this browser.' }).waitFor();
	await page.reload();
	await page.waitForFunction(
		() => !document.querySelector('.header-actions button.primary')?.disabled
	);
	await rules();
	assert(
		!(await page
			.getByRole('checkbox', { name: `Enable rule ${restaurant}`, exact: true })
			.isChecked()),
		'Disabled starter was re-enabled after reload.'
	);
	assert(
		(await page.getByRole('button', { name: 'Delete rule STARBUCKS', exact: true }).count()) === 0,
		'Deleted starter reappeared after reload.'
	);
	await nav('Settings').click();
	let downloading = page.waitForEvent('download');
	await page.getByRole('button', { name: 'Back up workspace', exact: true }).click();
	await (await downloading).saveAs('/private/tmp/ledgerclean-rules-backup.json');
	downloading = page.waitForEvent('download');
	await page.getByRole('button', { name: 'Export rules', exact: true }).click();
	await (await downloading).saveAs('/private/tmp/ledgerclean-rules-export.json');
	await page.getByRole('button', { name: 'Restore starter rules…', exact: true }).click();
	await page.getByRole('button', { name: 'Clear all transactions', exact: true }).click();
	await page.getByRole('button', { name: 'Restore starter rules', exact: true }).click();
	assert(
		(await page.getByRole('alert').allTextContents()).some((text) =>
			text.includes('workspace changed')
		),
		'A stale import/reset preview overwrote newer workspace edits.'
	);
	await page
		.locator('input[aria-label="Restore workspace file"]')
		.setInputFiles('/private/tmp/ledgerclean-rules-backup.json');
	await page.getByRole('button', { name: 'Replace workspace', exact: true }).click();
	await page.getByRole('button', { name: 'Restore starter rules…', exact: true }).click();
	await page.getByRole('button', { name: 'Restore starter rules', exact: true }).click();
	await overview();
	assert(
		(await category('STARBUCKS 123').inputValue()) === 'Dining / Cafés',
		'Restoring starters did not update existing transactions immediately.'
	);
	assert(
		(await category('LOCAL COFFEE #123').inputValue()) === 'Shopping and Personal',
		'Restoring starters lost a transaction exception.'
	);
	await nav('Settings').click();
	await page
		.locator('input[aria-label="Import rules file"]')
		.setInputFiles('/private/tmp/ledgerclean-rules-export.json');
	await page.getByRole('button', { name: 'Import rules', exact: true }).click();
	await overview();
	assert(
		(await category('LOCAL COFFEE #123').inputValue()) === 'Shopping and Personal',
		'Rule import lost a transaction exception.'
	);
	await page.context().setOffline(true);
	try {
		await rules();
		await page.getByRole('button', { name: '+ New rule', exact: true }).click();
		editor = page.getByRole('region', { name: 'Rule editor', exact: true });
		await editor.getByRole('textbox', { name: 'Rule pattern', exact: true }).fill('mystery');
		await choose(editor.getByRole('combobox', { name: 'Rule category', exact: true }), 'Business');
		await editor.getByRole('button', { name: 'Save rule', exact: true }).click();
	} finally {
		await page.context().setOffline(false);
	}
	await page
		.getByRole('button', { name: 'Edit rule coffee, cafe, café, espresso', exact: true })
		.click();
	await page.setViewportSize({ width: 1440, height: 1000 });
	const visiblePreview = async () => {
		const preview = page
			.getByRole('region', { name: 'Rule editor', exact: true })
			.getByRole('region', { name: 'Rule change preview', exact: true });
		assert(await preview.isVisible(), 'Rule preview is hidden.');
		assert(
			await preview.evaluate(
				(element) =>
					getComputedStyle(element).position === 'static' &&
					getComputedStyle(element).pointerEvents !== 'none'
			),
			'Rule preview has inherited page-overlay styling.'
		);
	};
	await visiblePreview();
	await page.screenshot({ path: '/private/tmp/ledgerclean-rules-desktop.png' });
	await page.setViewportSize({ width: 390, height: 844 });
	await visiblePreview();
	assert(
		await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
		'Mobile page overflows the viewport.'
	);
	await page.screenshot({ path: '/private/tmp/ledgerclean-rules-mobile.png' });
	await page.setViewportSize({ width: 1440, height: 1000 });
	assert(errors.length === 0, `Browser errors: ${errors.join('; ')}`);
	return {
		starterRules: true,
		transactionExceptions: true,
		merchantScopes: true,
		invalidRegexBlocked: true,
		priorityAndConflicts: true,
		starterPersistence: true,
		backupsAndRuleImport: true,
		stalePreviewProtected: true,
		offlineEditing: true,
		mobileLayout: true,
		browserErrors: errors
	};
}
