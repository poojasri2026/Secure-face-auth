import { RefObject, useCallback, useState } from "react";
import { captureJpegDataUrl } from "../utils/media";
import { UseFaceLandmarker } from "./useFaceLandmarker";

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

export interface CaptureOptions {
  minBoxRatio?: number;
  intervalMs?: number;
  timeoutMs?: number;
}

export interface UseFaceCapture {
  capturing: boolean;
  progress: number; // 0..1
  hint: string | null; // live positioning guidance for the user
  captureSequence: (count?: number, opts?: CaptureOptions) => Promise<string[]>;
  captureOne: () => string | null;
}

// Guided still-frame capture for enrollment. Enforces a single, well-framed
// face client-side for good UX; the backend still performs the real detection,
// embedding and quality checks and remains authoritative.
export function useFaceCapture(
  videoRef: RefObject<HTMLVideoElement>,
  detect: UseFaceLandmarker["detect"]
): UseFaceCapture {
  const [capturing, setCapturing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [hint, setHint] = useState<string | null>(null);

  const captureSequence = useCallback(
    async (count = 5, opts?: CaptureOptions): Promise<string[]> => {
      const minBoxRatio = opts?.minBoxRatio ?? 0.1;
      const intervalMs = opts?.intervalMs ?? 600;
      const timeoutMs = opts?.timeoutMs ?? 20000;
      const images: string[] = [];
      setCapturing(true);
      setProgress(0);
      setHint("Center your face in the frame.");
      const started = performance.now();
      try {
        while (images.length < count) {
          if (performance.now() - started > timeoutMs) {
            throw new Error(
              "Timed out capturing your face. Ensure good lighting and that your face is centered."
            );
          }
          const video = videoRef.current;
          if (!video || video.readyState < 2) {
            await sleep(150);
            continue;
          }
          const m = detect(video, performance.now());
          if (m.faceCount === 0) {
            setHint("No face detected — look at the camera.");
            await sleep(200);
            continue;
          }
          if (m.faceCount > 1) {
            setHint("Multiple faces detected — only you should be in frame.");
            await sleep(250);
            continue;
          }
          if (m.boxRatio < minBoxRatio) {
            setHint("Move a little closer to the camera.");
            await sleep(200);
            continue;
          }
          setHint("Hold still…");
          const img = captureJpegDataUrl(video);
          if (img) {
            images.push(img);
            setProgress(images.length / count);
          }
          await sleep(intervalMs);
        }
        setHint(null);
        return images;
      } finally {
        setCapturing(false);
      }
    },
    [videoRef, detect]
  );

  const captureOne = useCallback((): string | null => {
    const video = videoRef.current;
    if (!video) return null;
    return captureJpegDataUrl(video);
  }, [videoRef]);

  return { capturing, progress, hint, captureSequence, captureOne };
}
