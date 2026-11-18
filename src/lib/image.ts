/**
 * Comprime a fotografia no telemóvel antes de enviar:
 *  - lado maior até 1600 px, JPEG qualidade 0,8 (poupa dados móveis);
 *  - ao redesenhar num <canvas> todos os metadados EXIF (incluindo GPS) são removidos.
 */
export async function compressImage(file: Blob, maxSide = 1600, quality = 0.8): Promise<Blob> {
  const source = await loadImage(file);
  const { width, height } = source;
  const scale = Math.min(1, maxSide / Math.max(width, height));
  const w = Math.round(width * scale);
  const h = Math.round(height * scale);

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Não foi possível processar a fotografia neste telemóvel.");
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(source, 0, 0, w, h);
  if ("close" in source && typeof source.close === "function") source.close();

  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
  if (!blob) throw new Error("Não foi possível comprimir a fotografia.");
  return blob;
}

async function loadImage(file: Blob): Promise<ImageBitmap | HTMLImageElement> {
  // createImageBitmap respeita a orientação EXIF (fotos ao alto ficam ao alto).
  if (typeof createImageBitmap === "function") {
    try {
      return await createImageBitmap(file, { imageOrientation: "from-image" });
    } catch {
      /* alguns browsers antigos: usar <img> */
    }
  }
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.decoding = "async";
    img.src = url;
    await img.decode();
    return img;
  } finally {
    URL.revokeObjectURL(url);
  }
}
