import { RefObject, useCallback, useEffect, useRef, useState } from "react";

export interface UseCamera {
  videoRef: RefObject<HTMLVideoElement>;
  ready: boolean;
  error: string | null;
  start: () => Promise<void>;
  stop: () => void;
}

// Manages a getUserMedia stream bound to a <video> element. Cleans up the
// stream on unmount so the camera light turns off when leaving the page.
export function useCamera(autoStart = true): UseCamera {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const stop = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setReady(false);
  }, []);

  const start = useCallback(async () => {
    setError(null);
    if (!navigator.mediaDevices?.getUserMedia) {
      setError("Camera API is not available in this browser.");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: "user" },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        // Some browsers need an explicit play() after setting srcObject.
        await videoRef.current.play().catch(() => undefined);
      }
      setReady(true);
    } catch (e) {
      const name = (e as { name?: string })?.name || "";
      if (name === "NotAllowedError" || name === "SecurityError")
        setError("Camera permission was denied. Allow camera access and try again.");
      else if (name === "NotFoundError" || name === "OverconstrainedError")
        setError("No usable camera was found on this device.");
      else if (name === "NotReadableError")
        setError("The camera is already in use by another application.");
      else setError("Could not start the camera.");
      setReady(false);
    }
  }, []);

  useEffect(() => {
    if (autoStart) void start();
    return () => stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { videoRef, ready, error, start, stop };
}
