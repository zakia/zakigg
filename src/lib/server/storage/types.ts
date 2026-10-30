/** Provider-independent text values. Keys and their meaning belong to the caller. */
export type TextStore = {
	get(key: string): Promise<string | null>;
	put(key: string, value: string): Promise<void>;
	list(prefix: string): Promise<string[]>;
	delete(key: string): Promise<void>;
};
export type Attachment = { data: Uint8Array; contentType: string; fileName: string };
export type AttachmentStore = {
	read(id: string): Promise<Attachment | null>;
	write(id: string, attachment: Attachment): Promise<void>;
};
export function assertAssetId(id: string) {
	if (!/^asset_[A-Za-z0-9_-]{1,180}$/.test(id)) throw new Error('Invalid attachment ID');
}
