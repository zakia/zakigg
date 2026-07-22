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

export type UnzippedEntry = {
	path: string;
	bytes: Uint8Array;
};

const textDecoder = new TextDecoder();

const EOCD_SIGNATURE = 0x06054b50;
const CENTRAL_DIRECTORY_SIGNATURE = 0x02014b50;
const LOCAL_FILE_SIGNATURE = 0x04034b50;

export async function readZipEntries(
	source: Blob | ArrayBuffer | Uint8Array
): Promise<UnzippedEntry[]> {
	const buffer = await toArrayBuffer(source);
	const view = new DataView(buffer);
	const bytes = new Uint8Array(buffer);
	const eocd = findEndOfCentralDirectory(view);

	if (!eocd) throw new Error('Not a valid zip archive.');

	const entries: UnzippedEntry[] = [];
	let pointer = eocd.centralDirectoryOffset;

	for (let index = 0; index < eocd.entryCount; index += 1) {
		if (
			pointer + 46 > view.byteLength ||
			view.getUint32(pointer, true) !== CENTRAL_DIRECTORY_SIGNATURE
		) {
			break;
		}

		const method = view.getUint16(pointer + 10, true);
		const compressedSize = view.getUint32(pointer + 20, true);
		const nameLength = view.getUint16(pointer + 28, true);
		const extraLength = view.getUint16(pointer + 30, true);
		const commentLength = view.getUint16(pointer + 32, true);
		const localOffset = view.getUint32(pointer + 42, true);
		const path = textDecoder.decode(bytes.subarray(pointer + 46, pointer + 46 + nameLength));

		if (path && !path.endsWith('/')) {
			entries.push({
				path,
				bytes: await readLocalEntry(view, bytes, localOffset, method, compressedSize)
			});
		}

		pointer += 46 + nameLength + extraLength + commentLength;
	}

	return entries;
}

async function readLocalEntry(
	view: DataView,
	bytes: Uint8Array,
	localOffset: number,
	method: number,
	compressedSize: number
) {
	if (view.getUint32(localOffset, true) !== LOCAL_FILE_SIGNATURE) {
		throw new Error('Corrupt zip entry.');
	}

	const nameLength = view.getUint16(localOffset + 26, true);
	const extraLength = view.getUint16(localOffset + 28, true);
	const dataStart = localOffset + 30 + nameLength + extraLength;
	const compressed = bytes.subarray(dataStart, dataStart + compressedSize);

	if (method === 0) return compressed.slice();
	if (method === 8) return inflateRaw(compressed);

	throw new Error(`Unsupported zip compression method: ${method}`);
}

async function inflateRaw(data: Uint8Array): Promise<Uint8Array> {
	const stream = new Blob([toBlobPart(data)])
		.stream()
		.pipeThrough(new DecompressionStream('deflate-raw'));

	return new Uint8Array(await new Response(stream).arrayBuffer());
}

function findEndOfCentralDirectory(view: DataView) {
	const minOffset = Math.max(0, view.byteLength - 22 - 0xffff);

	for (let offset = view.byteLength - 22; offset >= minOffset; offset -= 1) {
		if (view.getUint32(offset, true) !== EOCD_SIGNATURE) continue;

		return {
			entryCount: view.getUint16(offset + 10, true),
			centralDirectorySize: view.getUint32(offset + 12, true),
			centralDirectoryOffset: view.getUint32(offset + 16, true)
		};
	}

	return null;
}

async function toArrayBuffer(source: Blob | ArrayBuffer | Uint8Array): Promise<ArrayBuffer> {
	if (source instanceof ArrayBuffer) return source;
	if (source instanceof Uint8Array) {
		return source.buffer.slice(
			source.byteOffset,
			source.byteOffset + source.byteLength
		) as ArrayBuffer;
	}

	return source.arrayBuffer();
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
