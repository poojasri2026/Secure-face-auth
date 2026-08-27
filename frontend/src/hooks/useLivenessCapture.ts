import { RefObject, useCallback, useEffect, useRef, useState } from "react";
import { ChallengeSample } from "../types";
import { LiveMetrics, UseFaceLandmarker } from "./useFaceLandmarker";

// Throttle sampling so payloads stay well under the backend's 600-sample cap
// while keeping enough temporal resolution for blinks and head turns.
const SAMPLE_INTERVAL_MS = 33; // ~30 Hz
const MAX_SAMPLES = 550;

export interface UseLivenessCapture {
  metrics: LiveMetrics | null;
  capturing: boolean;
  begin: () => void;
  end: () => ChallengeSample[];
  cancel: () => void;
}

// Runs a requestAnimationFrame loop that computes per-frame metrics via the
// FaceLandmarker and accumulates ChallengeSample objects. Only these small
// numeric signals are ever sent to the backend — never video frames.
export function useLivenessCapture(
  videoRef: RefObject<HTMLVideoElement>,
  detect: UseFaceLandmarker["detect"],
  onSample?: (samples: ChallengeSample[], latest: LiveMetrics) => void
): UseLivenessCapture {
  const [metrics, setMetrics] = useState<LiveMetrics | null>(null);
  const [capturing, setCapturing] = useState(false);
  const samplesRef = useRef<ChallengeSample[]>([]);
  const rafRef = useRef<number | null>(null);
  const startTsRef = useRef<number>(0);
  const lastSampleRef = useRef<number>(0);
  const onSampleRef = useRef(onSample);

  useEffect(() => {
    onSampleRef.current = onSample;
  }, [onSample]);

  const loop = useCallback(() => {
    const video = videoRef.current;
    if (video && video.readyState >= 2) {
      const now = performance.now();
      const m = detect(video, now);
      setMetrics(m);
      if (
        now - lastSampleRef.current >= SAMPLE_INTERVAL_MS &&
        samplesRef.current.length < MAX_SAMPLES
      ) {
        lastSampleRef.current = now;
        const newSample: ChallengeSample = {
          t: now - startTsRef.current,
          ear: m.ear,
          yaw: m.yaw,
          pitch: m.pitch,
          roll: m.roll,
          face_count: m.faceCount,
          confidence: m.confidence,
          box_ratio: m.boxRatio,
        };
        samplesRef.current.push(newSample);
        if (onSampleRef.current) {
          onSampleRef.current(samplesRef.current, m);
        }
      }
    }
    rafRef.current = requestAnimationFrame(loop);
  }, [videoRef, detect]);

  const stopLoop = useCallback(() => {
    if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    setCapturing(false);
  }, []);

  const begin = useCallback(() => {
    samplesRef.current = [];
    startTsRef.current = performance.now();
    lastSampleRef.current = 0;
    setCapturing(true);
    rafRef.current = requestAnimationFrame(loop);
  }, [loop]);

  const end = useCallback((): ChallengeSample[] => {
    stopLoop();
    return samplesRef.current.slice();
  }, [stopLoop]);

  const cancel = useCallback(() => {
    stopLoop();
    samplesRef.current = [];
  }, [stopLoop]);

  return { metrics, capturing, begin, end, cancel };
}
