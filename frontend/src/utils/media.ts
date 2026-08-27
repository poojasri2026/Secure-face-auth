// Capture a still JPEG data URL from a live <video> element. Used for face
// enrollment / verification. We draw the RAW (un-mirrored) frame so the backend
// receives a natural image even though the on-screen preview is mirrored.
export function captureJpegDataUrl(
  video: HTMLVideoElement,
  maxWidth = 480,
  quality = 0.85
): string | null {
  const vw = video.videoWidth;
  const vh = video.videoHeight;
  if (!vw || !vh) return null;
  const scale = Math.min(1, maxWidth / vw);
  const w = Math.round(vw * scale);
  const h = Math.round(vh * scale);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.drawImage(video, 0, 0, w, h);
  return canvas.toDataURL("image/jpeg", quality);
}
