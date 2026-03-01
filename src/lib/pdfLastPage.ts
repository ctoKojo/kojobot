import * as pdfjsLib from 'pdfjs-dist';

// Use the bundled worker
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;

/**
 * Extracts the last page of a PDF file as a PNG blob.
 * Uses pdf.js to render the page on a canvas.
 */
export async function extractLastPageAsImage(file: File, scale = 2): Promise<{ blob: Blob; pageNumber: number; totalPages: number }> {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const totalPages = pdf.numPages;
  const page = await pdf.getPage(totalPages);

  const viewport = page.getViewport({ scale });
  const canvas = document.createElement('canvas');
  canvas.width = viewport.width;
  canvas.height = viewport.height;

  const ctx = canvas.getContext('2d')!;
  await page.render({ canvasContext: ctx, viewport }).promise;

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(b => (b ? resolve(b) : reject(new Error('Failed to create blob'))), 'image/png', 0.92);
  });

  // Cleanup
  page.cleanup();
  pdf.destroy();

  return { blob, pageNumber: totalPages, totalPages };
}
