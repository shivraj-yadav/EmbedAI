const PRIVATE_KEY = process.env.IMAGEKIT_PRIVATE_KEY!;

/**
 * Upload a file buffer to ImageKit.
 * Returns the CDN URL and fileId (needed for deletion).
 */
export async function uploadToImageKit(
  buffer: Buffer,
  fileName: string,
  folder = "/embedai"
): Promise<{ url: string; fileId: string }> {
  const auth = Buffer.from(`${PRIVATE_KEY}:`).toString("base64");

  // ImageKit upload expects multipart/form-data
  const form = new FormData();
  form.append("file", new Blob([new Uint8Array(buffer)]), fileName);
  form.append("fileName", fileName);
  form.append("folder", folder);
  form.append("useUniqueFileName", "true");

  const res = await fetch("https://upload.imagekit.io/api/v1/files/upload", {
    method: "POST",
    headers: { Authorization: `Basic ${auth}` },
    body: form,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`ImageKit upload failed (${res.status}): ${text}`);
  }

  const data = await res.json();
  return { url: data.url as string, fileId: data.fileId as string };
}

/**
 * Delete a file from ImageKit by its fileId.
 */
export async function deleteFromImageKit(fileId: string): Promise<void> {
  const auth = Buffer.from(`${PRIVATE_KEY}:`).toString("base64");

  const res = await fetch(`https://api.imagekit.io/v1/files/${fileId}`, {
    method: "DELETE",
    headers: { Authorization: `Basic ${auth}` },
  });

  // 404 is fine — file already gone
  if (!res.ok && res.status !== 404) {
    throw new Error(`ImageKit delete failed (${res.status})`);
  }
}
