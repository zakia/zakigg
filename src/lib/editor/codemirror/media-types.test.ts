import { describe, expect, it } from 'vitest';
import { mediaKindForUrl, mediaUrlForAsset } from './media-types';

describe('local media URLs', () => {
	it('keeps the embedded media kind when a pasted file has no usable extension', () => {
		expect(mediaUrlForAsset('asset_image', 'clipboard', 'image/png')).toBe(
			'/media/asset_image.png'
		);
		expect(mediaUrlForAsset('asset_audio', 'recording.webm', 'audio/webm')).toBe(
			'/media/asset_audio.weba'
		);
		expect(mediaKindForUrl(mediaUrlForAsset('asset_audio', 'recording.webm', 'audio/webm'))).toBe(
			'audio'
		);
		expect(mediaUrlForAsset('asset_file', 'download', '')).toBe('/media/asset_file.bin');
	});
});
