import {
  PDFDocument,
  PDFCheckBox,
  PDFDropdown,
  PDFRadioGroup,
  PDFTextField,
  StandardFonts,
} from "pdf-lib";

/**
 * Generic AcroForm-filling helpers built on pdf-lib.
 *
 * These are intentionally form-agnostic: no knowledge of any specific document.
 * Higher-level modules map their own data onto a `PdfFieldValues` object and
 * call `fillPdfForm`.
 */

export type PdfFieldValue = string | boolean | number | null | undefined;

/** Map of PDF form field name -> value to set. */
export type PdfFieldValues = Record<string, PdfFieldValue>;

export interface FillPdfFormOptions {
  /**
   * Flatten the form after filling so values are baked in and no longer
   * editable. Defaults to `true`.
   */
  flatten?: boolean;
  /**
   * Throw if a key in `values` does not correspond to a field in the PDF.
   * Defaults to `false` (unknown fields are collected and returned instead).
   */
  strict?: boolean;
}

export interface FillPdfFormResult {
  bytes: Uint8Array;
  /** Field names present in `values` but not found in the PDF. */
  unknownFields: string[];
}

/**
 * Fill an AcroForm PDF with the given field values.
 *
 * @param templateBytes Raw bytes of the source PDF (e.g. from `fs` or fetch).
 * @param values        Field name -> value.
 */
export async function fillPdfForm(
  templateBytes: Uint8Array | ArrayBuffer,
  values: PdfFieldValues,
  options: FillPdfFormOptions = {},
): Promise<FillPdfFormResult> {
  const { flatten = true, strict = false } = options;

  const pdfDoc = await PDFDocument.load(templateBytes);
  const form = pdfDoc.getForm();

  // Ensures text set on fields renders even if the template lacks a default
  // appearance font.
  const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);

  const fieldNames = new Set(form.getFields().map((f) => f.getName()));
  const unknownFields: string[] = [];

  for (const [name, rawValue] of Object.entries(values)) {
    if (rawValue === null || rawValue === undefined) continue;

    if (!fieldNames.has(name)) {
      unknownFields.push(name);
      if (strict) {
        throw new Error(`PDF form has no field named "${name}"`);
      }
      continue;
    }

    const field = form.getField(name);

    if (field instanceof PDFTextField) {
      field.setText(String(rawValue));
    } else if (field instanceof PDFCheckBox) {
      if (toBoolean(rawValue)) field.check();
      else field.uncheck();
    } else if (field instanceof PDFRadioGroup) {
      field.select(String(rawValue));
    } else if (field instanceof PDFDropdown) {
      field.select(String(rawValue));
    } else {
      throw new Error(
        `Unsupported PDF field type for "${name}": ${field.constructor.name}`,
      );
    }
  }

  if (flatten) {
    form.updateFieldAppearances(helvetica);
    form.flatten();
  } else {
    form.updateFieldAppearances(helvetica);
  }

  const bytes = await pdfDoc.save();
  return { bytes, unknownFields };
}

/**
 * List every fillable field in a PDF with its type and (where relevant) the
 * options it accepts. Useful when mapping a new template.
 */
export async function inspectPdfFields(
  templateBytes: Uint8Array | ArrayBuffer,
): Promise<Array<{ name: string; type: string; options?: string[] }>> {
  const pdfDoc = await PDFDocument.load(templateBytes);
  const form = pdfDoc.getForm();

  return form.getFields().map((field) => {
    const name = field.getName();
    const type = field.constructor.name;
    if (field instanceof PDFRadioGroup || field instanceof PDFDropdown) {
      return { name, type, options: field.getOptions() };
    }
    return { name, type };
  });
}

function toBoolean(value: PdfFieldValue): boolean {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;
  if (typeof value === "string") {
    return ["true", "yes", "on", "1", "x", "checked"].includes(
      value.trim().toLowerCase(),
    );
  }
  return false;
}
