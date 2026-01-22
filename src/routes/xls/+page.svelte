<script lang="ts">
	import Icon from '@iconify/svelte';
	import ExcelWorker from './excel-worker.ts?worker';
	import { onMount } from 'svelte';
	import storage from './storage';

	// State variables
	let files = $state<FileList | null>(null);
	let isDragging = $state(false);
	let isProcessingFile = $state(false);
	let error = $state<string | null>(null);
	let parsedData = $state<any[]>([]);
	let columns = $state<string[]>([]);
	let isValidFile = $state(false);
	let fileName = $state<string>('');
	let history = $state<ReturnType<typeof storage.getHistory>>([]);
	let selectedHistoryId = $state<string | null>(null);

	// Editable columns state
	let editableColumns = $state<{ name: string; removed: boolean; original: string }[]>([]);

	// Watch columns and reset editableColumns when new data is loaded
	$effect(() => {
		if (columns && columns.length > 0) {
			editableColumns = columns.map((col, i) => ({ name: col, removed: false, original: col }));
		}
	});

	onMount(() => {
		console.log('🔄 onMount called');
		loadHistoryAndDefault();
	});

	function refreshHistory() {
		history = storage.getHistory();
	}

	async function loadHistoryAndDefault() {
		refreshHistory();
		const mostRecent = storage.getMostRecentEntry();
		if (mostRecent) {
			await loadHistoryEntry(mostRecent.id);
		}
	}

	async function loadHistoryEntry(id: string) {
		const entry = storage.getEntryById(id);
		if (!entry) return;
		selectedHistoryId = id;
		fileName = entry.name;
		isProcessingFile = true;
		error = null;
		if (entry.type === 'file') {
			const file = storage.historyEntryToFile(entry);
			if (file) {
				await parseExcelFile(file);
			}
		} else if (entry.type === 'paste') {
			const parsed = storage.historyEntryToParsedPaste(entry);
			if (parsed) {
				columns = parsed.columns;
				parsedData = parsed.parsedData;
				validateData();
				isProcessingFile = false;
			}
		}
		isProcessingFile = false;
	}

	function clearFiles() {
		console.log('🧹 Clearing all files and data');
		files = new DataTransfer().files;
		parsedData = [];
		columns = [];
		isValidFile = false;
		isProcessingFile = false;
		fileName = '';
		error = null;
		selectedHistoryId = null;
	}

	function handleDragOver(event: DragEvent) {
		event.preventDefault();
		isDragging = true;
	}

	function handleDragLeave(event: DragEvent) {
		event.preventDefault();
		isDragging = false;
	}

	function handleDrop(event: DragEvent) {
		event.preventDefault();
		isDragging = false;
		if (event.dataTransfer?.files) {
			files = event.dataTransfer.files;
			handleFileChange();
		}
	}

	async function handleFileChange() {
		if (files && files.length > 0) {
			const file = files[0];
			fileName = file.name;

			// Validate file type
			const validTypes = [
				'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
				'application/vnd.ms-excel', // .xls
				'text/csv' // .csv
			];

			if (!validTypes.includes(file.type) && !file.name.match(/\.(xlsx|xls|csv)$/i)) {
				error = 'Please upload a valid Excel file (.xlsx, .xls) or CSV file (.csv)';
				return;
			}

			// Start processing
			isProcessingFile = true;
			error = null;

			// Add to history before parsing
			const entry = await storage.fileToHistoryEntry(file);
			storage.addEntry(entry);
			refreshHistory();
			selectedHistoryId = entry.id;

			await parseExcelFile(file);
			isProcessingFile = false;
		}
	}

	async function parseExcelFile(file: File) {
		try {
			const data = await file.arrayBuffer();
			const worker = new ExcelWorker();
			worker.postMessage({
				fileData: data,
				fileName: file.name
			});
			worker.onmessage = function (e) {
				const result = e.data;
				if (result.success) {
					parsedData = result.data.parsedData;
					columns = result.data.columns;
					validateData();
				} else {
					error = result.error;
					console.error('Worker parsing error:', result.details);
				}
				worker.terminate();
				isProcessingFile = false;
			};
			worker.onerror = function (err) {
				console.error('Worker error:', err);
				error = 'Failed to parse the file. Please try again.';
				worker.terminate();
				isProcessingFile = false;
			};
		} catch (err) {
			console.error('Error setting up file parsing:', err);
			error = "Failed to process the file. Please make sure it's a valid Excel or CSV file.";
			isProcessingFile = false;
		}
	}

	function validateData() {
		isValidFile =
			Array.isArray(parsedData) &&
			parsedData.length > 0 &&
			Array.isArray(columns) &&
			columns.length > 0;
		error = isValidFile ? null : 'No data found in the file.';
		console.log('🔄 Data validation complete');
	}

	function handleColumnNameChange(idx: number, event: Event) {
		const input = event.target as HTMLInputElement;
		if (input) {
			editableColumns[idx].name = input.value;
		}
	}

	function handleRemoveColumn(idx: number) {
		editableColumns[idx].removed = true;
	}

	function handleRestoreColumn(idx: number) {
		editableColumns[idx].removed = false;
	}

	// Generic sort options: all columns
	const sortOptions = $derived.by((): Array<{ label: string; value: string }> => {
		if (!isValidFile || parsedData.length === 0) return [];
		return columns.map((col) => ({ label: col, value: col }));
	});

	// For future: derived sorted/filtered data
	// const derivedTableData = $derived.by(() => parsedData);
	$inspect(parsedData, columns);

	// Helper: detect if a column is a date/time column by name
	function isDateTimeColumn(col: string) {
		const lower = col.toLowerCase();
		return lower.includes('date') || lower.includes('time');
	}

	async function exportAsJSON() {
		if (parsedData.length === 0) {
			error = 'No data to export.';
			return;
		}
		const jsonData = JSON.stringify(parsedData, null, 2);
		const blob = new Blob([jsonData], { type: 'application/json' });
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url;
		a.download = `${fileName || 'data'}.json`;
		document.body.appendChild(a);
		a.click();
		document.body.removeChild(a);
		URL.revokeObjectURL(url);
		console.log('✅ JSON data exported successfully.');
	}

	function handlePasteTable() {
		console.log('🧠 Attempting to paste table from clipboard');
		navigator.clipboard
			.readText()
			.then((text) => {
				try {
					const rows = text.split('\n').map((row) => row.split('\t'));
					if (rows.length > 0 && rows[0].length > 0) {
						columns = rows[0];
						parsedData = rows.slice(1).map((row) => {
							const obj: any = {};
							columns.forEach((col, index) => {
								obj[col] = row[index];
							});
							return obj;
						});
						isValidFile = true;
						error = null;
						fileName = 'Clipboard Data';
						// Add to history
						const tsv = text;
						const entry = storage.pasteToHistoryEntry(tsv, columns);
						storage.addEntry(entry);
						refreshHistory();
						selectedHistoryId = entry.id;
						console.log(
							'✅ Table pasted and added to history. Found',
							parsedData.length,
							'rows and',
							columns.length,
							'columns.'
						);
					} else {
						error = 'Clipboard data is not a valid table format.';
						console.warn('⚠️ Clipboard data is not a valid table format.');
					}
				} catch (err) {
					console.error('❌ Failed to paste table from clipboard:', err);
					error = 'Failed to paste table from clipboard. Please try again.';
				}
			})
			.catch((err) => {
				console.error('❌ Failed to read clipboard data:', err);
				error = 'Failed to read clipboard data. Please try again.';
			});
	}

	function handleRemoveHistory(id: string) {
		storage.removeEntry(id);
		refreshHistory();
		if (selectedHistoryId === id) {
			clearFiles();
			// Optionally, load next most recent
			const mostRecent = storage.getMostRecentEntry();
			if (mostRecent) loadHistoryEntry(mostRecent.id);
		}
	}

	function handleRenameHistory(id: string) {
		const newName = prompt('Rename entry:', history.find((e) => e.id === id)?.name || '');
		if (newName) {
			storage.renameEntry(id, newName);
			refreshHistory();
		}
	}
</script>

<div class="relative flex min-h-screen w-full flex-col items-center justify-start">
	<!-- Upload Section - Constrained Width -->
	<div class="mx-auto flex w-full max-w-4xl flex-col justify-center px-4 py-8">
		<div class="mb-6 text-start">
			<h2 class="mb-1 text-center text-2xl font-semibold">Upload Your Data</h2>
			<p class="mb-6 text-center">Upload an Excel or CSV file to preview its contents.</p>
		</div>

		<div class="space-y-6">
			{#if !fileName && !isValidFile}
				<div class="mb-4 flex justify-center">
					<button
						type="button"
						class="rounded bg-blue-500 px-4 py-2 text-sm font-medium text-white shadow hover:bg-blue-600"
						onclick={handlePasteTable}
					>
						<Icon icon="lucide:clipboard" class="mr-1 inline-block h-4 w-4 align-text-bottom" />
						Paste Table
					</button>
				</div>
			{/if}
			<!-- File Upload Area -->
			<div
				role="button"
				tabindex="0"
				class="relative"
				ondragover={handleDragOver}
				ondragleave={handleDragLeave}
				ondrop={handleDrop}
			>
				<input
					type="file"
					bind:files
					onchange={handleFileChange}
					accept=".xlsx,.xls,.csv"
					class="absolute inset-0 h-full w-full cursor-pointer opacity-0"
				/>
				<div
					class="flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed p-12 transition-colors {isDragging
						? 'border-blue-500 bg-blue-50'
						: isProcessingFile
							? 'border-orange-500 bg-orange-50'
							: isValidFile
								? 'border-green-500 bg-green-50'
								: 'border-gray-300 bg-gray-50'}"
				>
					{#if isProcessingFile}
						<Icon icon="lucide:loader" class="mb-4 h-12 w-12 animate-spin text-orange-500" />
					{:else if isValidFile}
						<Icon icon="lucide:check-circle" class="mb-4 h-12 w-12 text-green-500" />
					{:else}
						<Icon icon="lucide:file-spreadsheet" class="mb-4 h-12 w-12 text-gray-400" />
					{/if}

					<div class="text-center">
						{#if isProcessingFile}
							<p class="mb-1 text-sm font-medium text-orange-700">Processing {fileName}...</p>
							<p class="text-sm text-orange-600">Parsing Excel/CSV data, please wait</p>
						{:else if fileName}
							<p class="mb-1 text-sm font-medium text-gray-700">{fileName}</p>
							{#if isValidFile}
								<p class="text-sm text-green-600">
									✓ Found {parsedData.length} rows and {columns.length} columns
								</p>
							{/if}
						{:else}
							<p class="text-sm font-medium text-gray-700">
								Drag and drop your Excel/CSV file here
							</p>
							<p class="mt-1 text-xs text-gray-500">or click to browse files</p>
							<p class="mt-2 text-xs text-gray-400">Supports .xlsx, .xls, and .csv files</p>
						{/if}
					</div>
				</div>
			</div>

			{#if (files?.length && fileName) || (isValidFile && fileName)}
				<div class="flex items-center justify-between rounded-md border bg-white p-4 shadow-sm">
					<div class="flex items-center gap-3">
						{#if isProcessingFile}
							<Icon icon="lucide:loader" class="h-5 w-5 animate-spin text-orange-500" />
						{:else}
							<Icon icon="lucide:file-spreadsheet" class="h-5 w-5 text-blue-500" />
						{/if}
						<div>
							<p class="text-sm font-medium">{fileName}</p>
							{#if isProcessingFile}
								<p class="text-xs text-orange-600">⏳ Processing file...</p>
							{:else if isValidFile}
								<p class="text-xs text-green-600">✓ Valid file with {columns.length} columns</p>
							{:else if error}
								<p class="text-xs text-red-600">✗ {error}</p>
							{/if}
						</div>
					</div>
					<button
						type="button"
						onclick={clearFiles}
						class="flex items-center gap-1 rounded px-2 py-1 text-sm text-red-600 hover:bg-red-50 hover:text-red-800"
					>
						<Icon icon="lucide:x" class="h-4 w-4" />
						Remove
					</button>
				</div>
			{/if}

			{#if isValidFile && parsedData.length > 0}
				<!-- Export as JSON Button -->
				<div class="mb-2 flex justify-end">
					<button
						type="button"
						class="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow hover:bg-blue-700"
						onclick={exportAsJSON}
					>
						<Icon icon="lucide:download" class="mr-1 inline-block h-4 w-4 align-text-bottom" />
						Export as JSON
					</button>
				</div>
				<!-- Data Preview -->
				<div class="rounded-lg border bg-white shadow-sm">
					<div class="border-b p-4">
						<h3 class="font-medium text-gray-900">Data Preview</h3>
						<p class="mt-1 text-sm text-gray-500">
							Showing first 5 rows of {parsedData.length} total rows
						</p>
					</div>
					<div class="overflow-x-auto">
						<table class="min-w-full divide-y divide-gray-200">
							<thead class="bg-gray-50">
								<tr>
									{#each editableColumns as col, idx}
										{#if !col.removed}
											<th
												class="px-4 py-3 text-left text-xs font-medium tracking-wider whitespace-nowrap text-gray-500 uppercase"
											>
												<div class="flex items-center gap-1">
													<input
														type="text"
														class="w-28 rounded border bg-gray-50 px-1 py-0.5 text-xs"
														bind:value={col.name}
														oninput={(e) => handleColumnNameChange(idx, e)}
													/>
													<button
														type="button"
														class="text-red-500 hover:text-red-700"
														onclick={() => handleRemoveColumn(idx)}
														title="Remove column"
													>
														<Icon icon="lucide:x" class="h-3 w-3" />
													</button>
												</div>
											</th>
										{/if}
									{/each}
								</tr>
							</thead>
							<tbody class="divide-y divide-gray-200 bg-white">
								{#each parsedData.slice(0, 20) as row}
									<tr>
										{#each editableColumns as col}
											{#if !col.removed}
												<td
													class="px-4 py-3 text-sm text-gray-900 {isDateTimeColumn(col.original)
														? 'whitespace-nowrap'
														: 'max-w-32 truncate'}"
												>
													{row[col.original] || '-'}
												</td>
											{/if}
										{/each}
									</tr>
								{/each}
							</tbody>
						</table>
					</div>
					<!-- Restore removed columns below the table -->
					{#if editableColumns.some((col) => col.removed)}
						<div class="mt-2 flex flex-wrap items-center gap-2">
							{#each editableColumns as col, idx}
								{#if col.removed}
									<button
										type="button"
										class="text-xs text-blue-500 underline"
										onclick={() => handleRestoreColumn(idx)}
									>
										Restore {col.original}
									</button>
								{/if}
							{/each}
						</div>
					{/if}
				</div>
			{/if}
		</div>
	</div>

	<!-- Add history UI above upload section -->
	{#if history.length > 0}
		<div class="mx-auto mb-4 w-full max-w-4xl">
			<div class="rounded border bg-white p-3 shadow-sm">
				<div class="mb-2 font-semibold">History</div>
				<div class="flex flex-wrap gap-2">
					{#each history as entry}
						<button
							type="button"
							class="rounded border px-2 py-1 text-xs {selectedHistoryId === entry.id
								? 'border-blue-400 bg-blue-100'
								: 'border-gray-200 bg-gray-50'}"
							onclick={() => loadHistoryEntry(entry.id)}
							title={entry.name}
						>
							{entry.name} <span class="ml-1 text-gray-400">({entry.type})</span>
						</button>
						<button
							type="button"
							class="ml-1 text-xs text-red-500"
							onclick={() => handleRemoveHistory(entry.id)}
							title="Remove">✕</button
						>
						<button
							type="button"
							class="ml-1 text-xs text-gray-500"
							onclick={() => handleRenameHistory(entry.id)}
							title="Rename">✎</button
						>
					{/each}
				</div>
			</div>
		</div>
	{/if}
</div>
