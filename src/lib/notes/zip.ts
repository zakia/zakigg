export type ZipEntryInput = {
	path: string;
	data: Blob | ArrayBuffer | Uint8Array | string;
	lastModified?: Date;
};

type PreparedZipEntry = {
	path: string;
	name: Uint8Array;
	data: Uint8Array;
	crc: number;
	time: number;
	date: number;
	offset: number;
};

const textEncoder = new TextEncoder();
const CRC_TABLE = createCrcTable();

export async function createZipBlob(entries: ZipEntryInput[]) {
	const prepared: PreparedZipEntry[] = [];
	const chunks: Uint8Array[] = [];
	let offset = 0;

	for (const entry of entries) {
		const name = textEncoder.encode(normalizeZipPath(entry.path));
		const data = await toUint8Array(entry.data);
		const { time, date } = toDosDateTime(entry.lastModified ?? new Date());
		const preparedEntry: PreparedZipEntry = {
			path: entry.path,
			name,
			data,
			crc: crc32(data),
			time,
			date,
			offset
		};
		const localHeader = createLocalFileHeader(preparedEntry);

		prepared.push(preparedEntry);
		chunks.push(localHeader, data);
		offset += localHeader.byteLength + data.byteLength;
	}

	const centralDirectoryOffset = offset;
	const centralDirectory = prepared.map(createCentralDirectoryHeader);
	const centralDirectorySize = centralDirectory.reduce((size, chunk) => size + chunk.byteLength, 0);
	const end = createEndOfCentralDirectory(
		prepared.length,
		centralDirectorySize,
		centralDirectoryOffset
	);

	return new Blob([...chunks, ...centralDirectory, end].map(toBlobPart), {
		type: 'application/zip'
	});
}

export function downloadBlob(blob: Blob, fileName: string) {
	const url = URL.createObjectURL(blob);
	const anchor = document.createElement('a');

	anchor.href = url;
	anchor.download = fileName;
	document.body.append(anchor);
	anchor.click();
	window.setTimeout(() => {
		anchor.remove();
		URL.revokeObjectURL(url);
	}, 1000);
}

function createLocalFileHeader(entry: PreparedZipEntry) {
	const header = new Uint8Array(30 + entry.name.byteLength);
	const view = new DataView(header.buffer);

	view.setUint32(0, 0x04034b50, true);
	view.setUint16(4, 20, true);
	view.setUint16(6, 0x0800, true);
	view.setUint16(8, 0, true);
	view.setUint16(10, entry.time, true);
	view.setUint16(12, entry.date, true);
	view.setUint32(14, entry.crc, true);
	view.setUint32(18, entry.data.byteLength, true);
	view.setUint32(22, entry.data.byteLength, true);
	view.setUint16(26, entry.name.byteLength, true);
	view.setUint16(28, 0, true);
	header.set(entry.name, 30);

	return header;
}

function createCentralDirectoryHeader(entry: PreparedZipEntry) {
	const header = new Uint8Array(46 + entry.name.byteLength);
	const view = new DataView(header.buffer);

	view.setUint32(0, 0x02014b50, true);
	view.setUint16(4, 20, true);
	view.setUint16(6, 20, true);
	view.setUint16(8, 0x0800, true);
	view.setUint16(10, 0, true);
	view.setUint16(12, entry.time, true);
	view.setUint16(14, entry.date, true);
	view.setUint32(16, entry.crc, true);
	view.setUint32(20, entry.data.byteLength, true);
	view.setUint32(24, entry.data.byteLength, true);
	view.setUint16(28, entry.name.byteLength, true);
	view.setUint16(30, 0, true);
	view.setUint16(32, 0, true);
	view.setUint16(34, 0, true);
	view.setUint16(36, 0, true);
	view.setUint32(38, 0, true);
	view.setUint32(42, entry.offset, true);
	header.set(entry.name, 46);

	return header;
}

function createEndOfCentralDirectory(
	entryCount: number,
	centralDirectorySize: number,
	centralDirectoryOffset: number
) {
	const header = new Uint8Array(22);
	const view = new DataView(header.buffer);

	view.setUint32(0, 0x06054b50, true);
	view.setUint16(4, 0, true);
	view.setUint16(6, 0, true);
	view.setUint16(8, entryCount, true);
	view.setUint16(10, entryCount, true);
	view.setUint32(12, centralDirectorySize, true);
	view.setUint32(16, centralDirectoryOffset, true);
	view.setUint16(20, 0, true);

	return header;
}

async function toUint8Array(data: ZipEntryInput['data']) {
	if (typeof data === 'string') return textEncoder.encode(data);
	if (data instanceof Uint8Array) return data;
	if (data instanceof ArrayBuffer) return new Uint8Array(data);

	return new Uint8Array(await data.arrayBuffer());
}

function toBlobPart(chunk: Uint8Array) {
	const copy = new Uint8Array(chunk.byteLength);
	copy.set(chunk);

	return copy.buffer;
}

function normalizeZipPath(path: string) {
	return path
		.replace(/\\/g, '/')
		.split('/')
		.map((part) => part.trim())
		.filter((part) => part && part !== '.' && part !== '..')
		.join('/');
}

function toDosDateTime(date: Date) {
	const year = Math.min(Math.max(date.getFullYear(), 1980), 2107);
	const month = date.getMonth() + 1;
	const day = date.getDate();
	const hours = date.getHours();
	const minutes = date.getMinutes();
	const seconds = Math.floor(date.getSeconds() / 2);

	return {
		time: (hours << 11) | (minutes << 5) | seconds,
		date: ((year - 1980) << 9) | (month << 5) | day
	};
}

function crc32(data: Uint8Array) {
	let crc = 0xffffffff;

	for (const byte of data) {
		crc = (crc >>> 8) ^ CRC_TABLE[(crc ^ byte) & 0xff];
	}

	return (crc ^ 0xffffffff) >>> 0;
}

function createCrcTable() {
	const table = new Uint32Array(256);

	for (let index = 0; index < table.length; index += 1) {
		let value = index;

		for (let bit = 0; bit < 8; bit += 1) {
			value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
		}

		table[index] = value >>> 0;
	}

	return table;
}
