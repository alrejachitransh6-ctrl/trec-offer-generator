/**
 * Dump every AcroForm field in a PDF: page number, type, name, and (for
 * radio/dropdown/option-list) the accepted option values.
 *
 * Usage:
 *   node scripts/inspect-pdf-fields.mjs <path-to.pdf>
 *   node scripts/inspect-pdf-fields.mjs public/templates/trec-20-19.pdf > docs/trec-field-inventory.txt
 *
 * Used when mapping a new PDF template onto the fill spec (docs/spec.md §7).
 */
import { readFile } from "node:fs/promises";
import {
  PDFDocument,
  PDFDropdown,
  PDFOptionList,
  PDFRadioGroup,
} from "pdf-lib";

const path = process.argv[2];
if (!path) {
  console.error("Usage: node scripts/inspect-pdf-fields.mjs <path-to.pdf>");
  process.exit(1);
}

const doc = await PDFDocument.load(await readFile(path));
const form = doc.getForm();

const pageNumberByRef = new Map();
doc.getPages().forEach((page, i) => pageNumberByRef.set(page.ref, i + 1));

const rows = form.getFields().map((field) => {
  const pages = new Set();
  for (const widget of field.acroField.getWidgets()) {
    const ref = widget.P();
    if (ref && pageNumberByRef.has(ref)) pages.add(pageNumberByRef.get(ref));
  }
  let options = "";
  if (
    field instanceof PDFRadioGroup ||
    field instanceof PDFDropdown ||
    field instanceof PDFOptionList
  ) {
    options = " OPTIONS=" + JSON.stringify(field.getOptions());
  }
  return {
    page: [...pages].sort((a, b) => a - b).join(",") || "?",
    type: field.constructor.name.replace("PDF", ""),
    label: field.getName() + options,
  };
});

rows.sort((a, b) => (parseInt(a.page) || 99) - (parseInt(b.page) || 99));

console.log(`TOTAL FIELDS: ${rows.length}, PAGES: ${doc.getPageCount()}\n`);
for (const r of rows) {
  console.log(`p${String(r.page).padEnd(5)} ${r.type.padEnd(10)} | ${r.label}`);
}
