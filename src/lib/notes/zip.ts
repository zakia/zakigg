import { unzip, zip, type Unzipped, type Zippable } from 'fflate';

export type ZipEntryInput = {
	path: string;
	data: Blob | ArrayBuffer | Uint8Array | string;
	lastModified?: Date;
};

export type UnzippedEntry = {
	path: string;
	bytes: Uint8Array;
};

const textEncoder = new TextEncoder();

export async function createZipBlob(entries: ZipEntryInput[]) {
	const zippable: Zippable = {};

	for (const entry of entries) {
		zippable[normalizeZipPath(entry.path)] = [
			await toUint8Array(entry.data),
			{ mtime: entry.lastModified ?? new Date() }
		];
	}

	const bytes = await new Promise<Uint8Array>((resolve, reject) => {
		zip(zippable, { level: 6 }, (error, data) => (error ? reject(error) : resolve(data)));
	});

	return new Blob([toArrayBuffer(bytes)], { type: 'application/zip' });
}

export async function readZipEntries(
	source: Blob | ArrayBuffer | Uint8Array
): Promise<UnzippedEntry[]> {
	const bytes = await toUint8Array(source);
	const files = await new Promise<Unzipped>((resolve, reject) => {
		unzip(bytes, (error, data) => (error ? reject(error) : resolve(data)));
	});

	return Object.entries(files)
		.filter(([path]) => path && !path.endsWith('/'))
		.map(([path, data]) => ({ path, bytes: data }));
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

async function toUint8Array(data: ZipEntryInput['data']) {
	if (typeof data === 'string') return textEncoder.encode(data);
	if (data instanceof Uint8Array) return data;
	if (data instanceof ArrayBuffer) return new Uint8Array(data);

	return new Uint8Array(await data.arrayBuffer());
}

function toArrayBuffer(bytes: Uint8Array) {
	return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

function normalizeZipPath(path: string) {
	return path
		.replace(/\\/g, '/')
		.split('/')
		.map((part) => part.trim())
		.filter((part) => part && part !== '.' && part !== '..')
		.join('/');
}
