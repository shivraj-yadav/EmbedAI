/**
 * Extract plain text from a file buffer based on MIME type / extension.
 */
export async function extractText(
  buffer: Buffer,
  filename: string
): Promise<string> {
  const ext = filename.split(".").pop()?.toLowerCase() ?? "";

  if (ext === "txt") {
    return buffer.toString("utf-8");
  }

  if (ext === "pdf") {
    // pdf-parse v2.x uses a class-based API: new PDFParse({ data: buffer })
    const pdfModule = await import("pdf-parse");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const PDFParseClass = (pdfModule as any).PDFParse ?? (pdfModule as any).default?.PDFParse;
    if (!PDFParseClass) {
      throw new Error("PDF parser class could not be loaded.");
    }
    const parser = new PDFParseClass({ data: buffer });
    try {
      const result = await parser.getText();
      return result.text;
    } finally {
      await parser.destroy();
    }
  }

  if (ext === "docx") {
    const mammoth = await import("mammoth");
    const result = await mammoth.extractRawText({ buffer });
    return result.value;
  }

  throw new Error(`Unsupported file type: .${ext}`);
}

/**
 * Clean extracted text: normalise whitespace, remove control chars.
 */
export function cleanText(raw: string): string {
  return raw
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    // Remove non-printable control characters except newline/tab
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "")
    // Collapse 3+ blank lines into 2
    .replace(/\n{3,}/g, "\n\n")
    // Collapse multiple spaces/tabs
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}
