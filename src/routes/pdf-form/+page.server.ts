import { PDFDocument, } from "pdf-lib";
import type { Actions } from "@sveltejs/kit";


export const actions: Actions = {

  get: async ({ request }) => {
    const formData = await request.formData();
    const pdf = formData.get("pdf") as File;
    const pdfDoc = await PDFDocument.load(await pdf.arrayBuffer());

    const fields: { name: string, type: string, options?: string[] }[] = []
    pdfDoc.getForm().getFields().forEach(f => {
      if (f.constructor.name === 'PDFRadioGroup') {
        const radioForm = pdfDoc.getForm().getRadioGroup(f.getName());
        fields.push({ name: f.getName(), type: f.constructor.name, options: radioForm.getOptions() })
      } else {
        fields.push({ name: f.getName(), type: f.constructor.name })
      }
    }
    )

    return { fields };
  },
}