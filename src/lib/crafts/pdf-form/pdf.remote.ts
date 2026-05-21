import * as v from 'valibot';
import { form } from '$app/server';
import { PDFDocument } from 'pdf-lib';

export type PdfField = { name: string; type: string; options?: string[] };

export const extractFields = form(
	v.object({
		pdf: v.file()
	}),
	async ({ pdf }): Promise<{ fields: PdfField[] }> => {
		const pdfDoc = await PDFDocument.load(await pdf.arrayBuffer());
		const fields: PdfField[] = [];
		pdfDoc
			.getForm()
			.getFields()
			.forEach((f) => {
				if (f.constructor.name === 'PDFRadioGroup') {
					const radioForm = pdfDoc.getForm().getRadioGroup(f.getName());
					fields.push({
						name: f.getName(),
						type: f.constructor.name,
						options: radioForm.getOptions()
					});
				} else {
					fields.push({ name: f.getName(), type: f.constructor.name });
				}
			});
		return { fields };
	}
);
