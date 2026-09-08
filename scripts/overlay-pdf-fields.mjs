/**
 * Overlay every AcroForm field's index (its position in `form.getFields()`) and
 * a red outline onto a PDF, and write a legend. This is how the TREC 20-19
 * field map (`src/lib/trec/field-map.ts`) was built and how it should be
 * re-verified if the template PDF is ever replaced.
 *
 * Usage:
 *   node scripts/overlay-pdf-fields.mjs public/templates/trec-20-19.pdf out.pdf
 *   # then: pdftoppm -png -r 150 out.pdf page   (needs poppler)
 */
import { readFile, writeFile } from "node:fs/promises";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

const src = process.argv[2];
const out = process.argv[3] ?? "field-overlay.pdf";
if (!src) {
  console.error(
    "Usage: node scripts/overlay-pdf-fields.mjs <in.pdf> [out.pdf]",
  );
  process.exit(1);
}

const doc = await PDFDocument.load(await readFile(src));
const font = await doc.embedFont(StandardFonts.HelveticaBold);
const pages = doc.getPages();
const pageIndex = new Map(pages.map((p, i) => [p.ref, i]));
const legend = [];

doc
  .getForm()
  .getFields()
  .forEach((field, i) => {
    const type = field.constructor.name.replace("PDF", "");
    const seen = new Set();
    for (const widget of field.acroField.getWidgets()) {
      const pi = pageIndex.get(widget.P());
      if (pi === undefined) continue;
      seen.add(pi + 1);
      const r = widget.getRectangle();
      const page = pages[pi];
      page.drawText(String(i), {
        x: r.x + 1,
        y: r.y + Math.max(1, r.height / 2 - 3),
        size: 7,
        font,
        color: rgb(0.85, 0, 0),
      });
      page.drawRectangle({
        x: r.x,
        y: r.y,
        width: r.width,
        height: r.height,
        borderColor: rgb(0.85, 0, 0),
        borderWidth: 0.4,
      });
    }
    legend.push(
      `${String(i).padStart(3)} | p${[...seen].sort((a, b) => a - b).join(",") || "?"} | ${type.padEnd(9)} | ${field.getName()}`,
    );
  });

await writeFile(out, await doc.save());
await writeFile(out.replace(/\.pdf$/, ".legend.txt"), legend.join("\n"));
console.log(`wrote ${out} + legend (${legend.length} fields)`);
