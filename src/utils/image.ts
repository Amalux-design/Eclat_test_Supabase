// Shrinks photos on the phone before upload: a full view (~1600px, ~300 KB)
// and a small preview (~360px, ~25 KB). A 4 MB camera photo becomes ~1/12 the
// size, which keeps storage and download use far inside the free tier.

async function load(file: File): Promise<ImageBitmap | HTMLImageElement> {
  if ("createImageBitmap" in window) {
    try {
      // Honours the photo's EXIF rotation where supported.
      return await createImageBitmap(file, { imageOrientation: "from-image" } as ImageBitmapOptions);
    } catch {
      // fall back to <img> below
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

function render(src: ImageBitmap | HTMLImageElement, maxSide: number, quality: number): Promise<Blob> {
  const w = "naturalWidth" in src ? src.naturalWidth : src.width;
  const h = "naturalHeight" in src ? src.naturalHeight : src.height;
  const scale = Math.min(1, maxSide / Math.max(w, h));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(w * scale);
  canvas.height = Math.round(h * scale);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("This device can't process photos.");
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(src, 0, 0, canvas.width, canvas.height);
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Couldn't process the photo."))), "image/jpeg", quality)
  );
}

export async function compressPhoto(file: File): Promise<{ full: Blob; thumb: Blob }> {
  const src = await load(file);
  const [full, thumb] = await Promise.all([render(src, 1600, 0.82), render(src, 360, 0.72)]);
  if ("close" in src) src.close();
  return { full, thumb };
}
