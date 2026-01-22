import type { RequestHandler } from '@sveltejs/kit';
import { PDFDocument } from 'pdf-lib';

export const POST: RequestHandler = async ({ request }) => {
	const formData = await request.formData();
	const pdf = formData.get('pdf') as File;
	const pdfDoc = await PDFDocument.load(await pdf.arrayBuffer());

	// extract field values from formData
	const fieldValues = Object.fromEntries(formData.entries());

	const form = pdfDoc.getForm();
	const fields = form.getFields();
	// const data = Object.fromEntries(formData.entries());
	for (const field of fields) {
		const name = field.getName();
		const type = field.constructor.name;
		const value = fieldValues[name];
		if (value) {
			if (type === 'PDFRadioGroup') {
				const radioForm = form.getRadioGroup(name);
				radioForm.select(value as string);
			} else if (type === 'PDFCheckBox') {
				form.getCheckBox(name).check();
			} else {
				form.getTextField(name).setText(fieldValues[name] as string);
			}
		}
	}

	const pdfBytes = await pdfDoc.save();
	return new Response(pdfBytes, {
		headers: {
			'Content-Type': 'application/pdf',
			'Content-Disposition': 'attachment; filename=filled.pdf'
		}
	});
};
