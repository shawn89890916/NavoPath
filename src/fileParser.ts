import type { Worker } from "tesseract.js";
import { assertSafeRasterDimensions, boundedCanvasScale } from "./imageSafety";

const MAX_FILE_BYTES = 10 * 1024 * 1024;
const MAX_PDF_PAGES = 30;
const MAX_TEXT_LENGTH = 60_000;
const MAX_DOCX_UNCOMPRESSED_BYTES = 50 * 1024 * 1024;
const MAX_DOCX_ENTRIES = 2_048;
const ACCEPTED_EXTENSIONS = new Set(["pdf", "docx", "txt", "md", "png", "jpg", "jpeg", "webp"]);
const ZIP_CENTRAL_DIRECTORY_SIGNATURE = 0x02014b50;
const ZIP_END_SIGNATURE = 0x06054b50;

export type ParsedAttachment = {
  name: string;
  size: number;
  text: string;
  truncated: boolean;
  pageCount?: number;
};

function extension(name: string) {
  return name.split(".").pop()?.toLowerCase() || "";
}

export function assertSafeDocxArchive(buffer: ArrayBuffer) {
  const view = new DataView(buffer);
  const earliestEndOffset = Math.max(0, view.byteLength - 65_557);
  let endOffset = -1;
  for (let offset = view.byteLength - 22; offset >= earliestEndOffset; offset -= 1) {
    const commentLength = view.getUint16(offset + 20, true);
    if (view.getUint32(offset, true) === ZIP_END_SIGNATURE
      && offset + 22 + commentLength === view.byteLength) {
      endOffset = offset;
      break;
    }
  }
  if (endOffset < 0) throw new Error("DOCX 压缩包结构无效");

  const diskNumber = view.getUint16(endOffset + 4, true);
  const centralDisk = view.getUint16(endOffset + 6, true);
  const diskEntryCount = view.getUint16(endOffset + 8, true);
  const entryCount = view.getUint16(endOffset + 10, true);
  const centralSize = view.getUint32(endOffset + 12, true);
  const centralOffset = view.getUint32(endOffset + 16, true);
  if (diskNumber !== 0 || centralDisk !== 0 || diskEntryCount !== entryCount
    || entryCount === 0xffff || centralSize === 0xffffffff || centralOffset === 0xffffffff) {
    throw new Error("DOCX 压缩包格式不受支持");
  }
  if (entryCount > MAX_DOCX_ENTRIES) throw new Error(`DOCX 包含超过 ${MAX_DOCX_ENTRIES} 个文件`);
  const centralEnd = centralOffset + centralSize;
  if (centralOffset > endOffset || centralEnd > endOffset) throw new Error("DOCX 压缩包目录无效");

  let cursor = centralOffset;
  let totalUncompressedBytes = 0;
  for (let index = 0; index < entryCount; index += 1) {
    if (cursor + 46 > centralEnd || view.getUint32(cursor, true) !== ZIP_CENTRAL_DIRECTORY_SIGNATURE) {
      throw new Error("DOCX 压缩包目录无效");
    }
    const uncompressedBytes = view.getUint32(cursor + 24, true);
    if (uncompressedBytes === 0xffffffff) throw new Error("DOCX 压缩包格式不受支持");
    totalUncompressedBytes += uncompressedBytes;
    if (totalUncompressedBytes > MAX_DOCX_UNCOMPRESSED_BYTES) {
      throw new Error("DOCX 解压后超过 50 MB 限制");
    }
    const nameLength = view.getUint16(cursor + 28, true);
    const extraLength = view.getUint16(cursor + 30, true);
    const commentLength = view.getUint16(cursor + 32, true);
    cursor += 46 + nameLength + extraLength + commentLength;
  }
  if (cursor > centralEnd) throw new Error("DOCX 压缩包目录无效");
}

function trimText(text: string) {
  const normalized = text.replace(/\u0000/g, "").replace(/[ \t]+\n/g, "\n").trim();
  return { text: normalized.slice(0, MAX_TEXT_LENGTH), truncated: normalized.length > MAX_TEXT_LENGTH };
}

function isUsefulPdfText(text: string) {
  const meaningful = text.match(/[\p{L}\p{N}]/gu)?.length || 0;
  return meaningful >= 32 && meaningful / Math.max(text.length, 1) >= 0.35;
}

function enhanceCanvas(source: HTMLCanvasElement) {
  const requestedScale = Math.min(2, Math.max(1, 2400 / source.width));
  const scale = boundedCanvasScale(source.width, source.height, requestedScale);
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(source.width * scale));
  canvas.height = Math.max(1, Math.round(source.height * scale));
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) return source;
  context.imageSmoothingEnabled = true;
  context.drawImage(source, 0, 0, canvas.width, canvas.height);
  const image = context.getImageData(0, 0, canvas.width, canvas.height);
  for (let index = 0; index < image.data.length; index += 4) {
    const grey = image.data[index] * 0.299 + image.data[index + 1] * 0.587 + image.data[index + 2] * 0.114;
    const contrasted = Math.max(0, Math.min(255, (grey - 128) * 1.35 + 128));
    image.data[index] = contrasted;
    image.data[index + 1] = contrasted;
    image.data[index + 2] = contrasted;
  }
  context.putImageData(image, 0, 0);
  return canvas;
}

async function blobToCanvas(source: Blob) {
  assertSafeRasterDimensions(await source.arrayBuffer());
  const bitmap = await createImageBitmap(source);
  try {
    const canvas = document.createElement("canvas");
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    canvas.getContext("2d")?.drawImage(bitmap, 0, 0);
    return canvas;
  } finally {
    bitmap.close();
  }
}

async function createOcrSession() {
  let worker: Worker | null = null;
  return {
    async recognize(source: Blob | HTMLCanvasElement) {
      const canvas = source instanceof Blob ? await blobToCanvas(source) : source;
      if (!worker) {
        const { createWorker } = await import("tesseract.js");
        worker = await createWorker("eng+chi_sim");
        await worker.setParameters({ preserve_interword_spaces: "1", user_defined_dpi: "300" });
      }
      return (await worker.recognize(enhanceCanvas(canvas))).data.text;
    },
    async terminate() {
      await worker?.terminate();
    },
  };
}

async function loadPdfJs() {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  pdfjs.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/legacy/build/pdf.worker.min.mjs", import.meta.url).toString();
  return pdfjs;
}

async function parsePdf(file: File, ocr: Awaited<ReturnType<typeof createOcrSession>>) {
  const pdfjs = await loadPdfJs();
  const doc = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise;
  if (doc.numPages > MAX_PDF_PAGES) throw new Error(`PDF 超过 ${MAX_PDF_PAGES} 页限制`);
  const chunks: string[] = [];
  const scanPages: number[] = [];

  for (let pageNumber = 1; pageNumber <= doc.numPages; pageNumber += 1) {
    const page = await doc.getPage(pageNumber);
    const content = await page.getTextContent();
    const text = content.items
      .map((item) => ("str" in item ? `${item.str}${item.hasEOL ? "\n" : " "}` : ""))
      .join("")
      .replace(/[ \t]+\n/g, "\n")
      .trim();
    if (isUsefulPdfText(text)) chunks.push(`[第 ${pageNumber} 页]\n${text}`);
    else scanPages.push(pageNumber);
  }

  for (const pageNumber of scanPages) {
    const page = await doc.getPage(pageNumber);
    const baseViewport = page.getViewport({ scale: 1 });
    const requestedScale = Math.min(2.4, Math.max(1.6, 2200 / baseViewport.width));
    const viewport = page.getViewport({
      scale: boundedCanvasScale(baseViewport.width, baseViewport.height, requestedScale),
    });
    const canvas = document.createElement("canvas");
    canvas.width = Math.ceil(viewport.width);
    canvas.height = Math.ceil(viewport.height);
    const context = canvas.getContext("2d");
    if (!context) continue;
    await page.render({ canvasContext: context, viewport, canvas }).promise;
    chunks.push(`[第 ${pageNumber} 页 OCR]\n${await ocr.recognize(canvas)}`);
  }

  return { text: chunks.join("\n\n"), pageCount: doc.numPages };
}

export async function parseAttachment(file: File): Promise<ParsedAttachment> {
  const ext = extension(file.name);
  if (!ACCEPTED_EXTENSIONS.has(ext)) throw new Error("不支持此文件格式");
  if (file.size > MAX_FILE_BYTES) throw new Error("文件超过 10 MB 限制");

  let rawText = "";
  let pageCount: number | undefined;
  const needsOcr = ext === "pdf" || ["png", "jpg", "jpeg", "webp"].includes(ext);
  const ocr = needsOcr ? await createOcrSession() : null;
  try {
    if (ext === "txt" || ext === "md") {
      rawText = await file.text();
    } else if (ext === "docx") {
      const arrayBuffer = await file.arrayBuffer();
      assertSafeDocxArchive(arrayBuffer);
      const mammoth = await import("mammoth");
      rawText = (await mammoth.extractRawText({ arrayBuffer })).value;
    } else if (ext === "pdf") {
      const parsed = await parsePdf(file, ocr!);
      rawText = parsed.text;
      pageCount = parsed.pageCount;
    } else {
      rawText = await ocr!.recognize(file);
    }
  } finally {
    await ocr?.terminate();
  }

  const result = trimText(rawText);
  if (!result.text) throw new Error("未能从文件中提取文本");
  return { name: file.name, size: file.size, text: result.text, truncated: result.truncated, pageCount };
}

export const ATTACHMENT_ACCEPT = ".pdf,.docx,.txt,.md,.png,.jpg,.jpeg,.webp";
