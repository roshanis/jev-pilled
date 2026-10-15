// An optional image sent along with the state. The page resizes it to a
// JPEG or PNG before upload, so the server only checks it and hands it to
// each provider in that provider's own format.

const FORMATS = { png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg" };
// Vercel caps a function's request body at 4.5 MB, so stay well under it.
export const MAX_IMAGE_BASE64_CHARS = 4_000_000;
// The name the image goes by in Jev's assets map and in the state.
export const JEV_IMAGE_REF = "attached_image";

// Returns { format, mediaType, data } or null when no image was sent.
export function readImage(image) {
  if (image == null) return null;
  if (typeof image !== "object") throw new Error("image must be { format, data_base64 }");
  const format = String(image.format || "").toLowerCase();
  if (!FORMATS[format]) throw new Error("image must be a PNG or JPEG");
  const data = image.data_base64;
  if (typeof data !== "string" || !data || !/^[A-Za-z0-9+/]+={0,2}$/.test(data)) {
    throw new Error("image data must be plain base64 (no data: prefix)");
  }
  if (data.length > MAX_IMAGE_BASE64_CHARS) throw new Error("image is too large; use one under about 3 MB");
  return { format: format === "jpeg" ? "jpg" : format, mediaType: FORMATS[format], data };
}

export const dataUrl = (img) => `data:${img.mediaType};base64,${img.data}`;

// Jev 1.14 takes images through a top-level assets map; the state names the
// asset by its key and Jev puts the image in its place.
export function jevImageRequest(state, img) {
  return {
    state: { image: JEV_IMAGE_REF, ...(state === "" || state == null ? {} : { notes: state }) },
    assets: { [JEV_IMAGE_REF]: { type: "image", format: img.format, data_base64: img.data } },
  };
}
