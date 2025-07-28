import * as XLSX from 'xlsx';
import { Temporal } from 'temporal-polyfill';

interface WorkerInput {
	fileData: ArrayBuffer;
	fileName: string;
}

interface WorkerResult {
	success: boolean;
	data?: {
		parsedData: any[];
		columns: string[];
		headers: string[];
	};
	error?: string;
	details?: string;
}

self.onmessage = function (e: MessageEvent<WorkerInput>) {
	const { fileData, fileName } = e.data;

	try {
		// Parse the Excel file
		const workbook = XLSX.read(fileData, { cellDates: true });
		const firstSheetName = workbook.SheetNames[0];
		const worksheet = workbook.Sheets[firstSheetName];

		// Convert to JSON
		const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

		if (jsonData.length === 0) {
			const result: WorkerResult = {
				success: false,
				error: 'The file appears to be empty'
			};
			self.postMessage(result);
			return;
		}

		// Get headers (first row)
		const headers = jsonData[0] as string[];
		const columns = headers.map((h) => String(h).toLowerCase().trim());

		// Get data rows
		const dataRows = jsonData.slice(1) as any[][];

		const parsedData = dataRows
			.filter((row) => row.some((cell) => cell !== null && cell !== undefined && cell !== ''))
			.map((row) => {
				const obj: any = {};
				columns.forEach((col, index) => {
					let value = row[index];
					if (value instanceof Date) {
						const plainDateTime = Temporal.PlainDateTime.from({
							year: value.getFullYear(),
							month: value.getMonth() + 1,
							day: value.getDate(),
							hour: value.getHours(),
							minute: value.getMinutes(),
							second: value.getSeconds()
						});
						const zoned = plainDateTime.toZonedDateTime('America/Toronto');
						const offset = zoned.offset;
						const dt = zoned.toPlainDateTime().toString();
						value = `${dt}${offset}`;
					}
					obj[col] = value;
				});
				return obj;
			});

		// Send successful result back to main thread
		const result: WorkerResult = {
			success: true,
			data: {
				parsedData,
				columns,
				headers
			}
		};
		self.postMessage(result);
	} catch (error) {
		// Send error back to main thread
		const result: WorkerResult = {
			success: false,
			error: "Failed to parse the file. Please make sure it's a valid Excel or CSV file.",
			details: error instanceof Error ? error.message : String(error)
		};
		self.postMessage(result);
	}
};
