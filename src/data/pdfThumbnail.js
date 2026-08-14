import { GlobalWorkerOptions, getDocument } from "pdfjs-dist";
import pdfWorkerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";

GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

// Rasterizes a PDF File's first page into a JPEG Blob, so it can be
// uploaded and treated exactly like any other image asset. Run against
// the local File at upload time (not the eventual Storage URL) so it
// never needs a cross-origin fetch -- the Storage bucket has no CORS
// config, so pdf.js can't read the PDF back out of Storage client-side
// once it's uploaded.
export async function renderPdfFirstPage(file) {
  const buffer = await file.arrayBuffer();
  const pdf = await getDocument({ data: buffer }).promise;
  const page = await pdf.getPage(1);
  const viewport = page.getViewport({ scale: 2 });
  const canvas = document.createElement("canvas");
  canvas.width = viewport.width;
  canvas.height = viewport.height;
  await page.render({ canvasContext: canvas.getContext("2d"), viewport }).promise;
  return new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.85));
}
