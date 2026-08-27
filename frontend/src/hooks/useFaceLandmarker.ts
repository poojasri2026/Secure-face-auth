import { useCallback, useEffect, useRef, useState } from "react";
import {
  FaceLandmarker,
  FilesetResolver,
  type FaceLandmarkerResult,
  type NormalizedLandmark,
} from "@mediapipe/tasks-vision";

// WASM runtime + model. These are fetched by the USER'S browser at runtime
// (not bundled). Override via env to self-host for offline deployments.
const WASM_BASE =
  (import.meta.env.VITE_MEDIAPIPE_WASM as string | undefined) ||
  "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm";
const MODEL_URL =
  (import.meta.env.VITE_FACE_LANDMARKER_MODEL as string | undefined) ||
  "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task";

// ---------------------------------------------------------------------------
// Sign convention (MUST match backend/app/ml/liveness.py):
//   yaw  < 0  => head turned to the user's LEFT ;  yaw  > 0 => user's RIGHT
//   pitch > 0 => looking UP           ;  pitch < 0 => looking DOWN
//   roll       => head tilt (sign not significant; magnitude is used)
// If, on a particular device, "turn left/right" or "look up/down" feel
// reversed, flip the matching constant below (this is a display/geometry
// calibration only — the backend still makes the pass/fail decision).
// ---------------------------------------------------------------------------
export const YAW_SIGN = 1;
export const PITCH_SIGN = 1;

export interface LiveMetrics {
  faceCount: number;
  ear: number | null; // eye aspect ratio (both eyes averaged)
  yaw: number | null; // degrees, backend convention
  pitch: number | null; // degrees, backend convention
  roll: number | null; // degrees
  boxRatio: number; // face bbox area / frame area (0..1)
  confidence: number; // 0..1
}

// MediaPipe FaceMesh landmark indices for the eye-aspect-ratio computation.
const RIGHT_EYE = { p1: 33, p2: 160, p3: 158, p4: 133, p5: 153, p6: 144 };
const LEFT_EYE = { p1: 362, p2: 385, p3: 387, p4: 263, p5: 373, p6: 380 };

function dist(a: NormalizedLandmark, b: NormalizedLandmark): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function eyeAspectRatio(
  lm: NormalizedLandmark[],
  e: { p1: number; p2: number; p3: number; p4: number; p5: number; p6: number }
): number {
  const horizontal = dist(lm[e.p1], lm[e.p4]);
  if (horizontal < 1e-6) return 0;
  const vertical = dist(lm[e.p2], lm[e.p6]) + dist(lm[e.p3], lm[e.p5]);
  return vertical / (2 * horizontal);
}

// Extract yaw/pitch/roll (degrees) from MediaPipe's 4x4 facial transformation
// matrix. MediaPipe returns the data in column-major order.
function eulerFromMatrix(m: number[]): { yaw: number; pitch: number; roll: number } {
  const r00 = m[0];
  const r10 = m[1];
  const r20 = m[2];
  const r11 = m[5];
  const r12 = m[9];
  const r21 = m[6];
  const r22 = m[10];
  const sy = Math.hypot(r00, r10);
  let pitch: number;
  let yaw: number;
  let roll: number;
  if (sy > 1e-6) {
    pitch = Math.atan2(r21, r22);
    yaw = Math.atan2(-r20, sy);
    roll = Math.atan2(r10, r00);
  } else {
    pitch = Math.atan2(-r12, r11);
    yaw = Math.atan2(-r20, sy);
    roll = 0;
  }
  const deg = 180 / Math.PI;
  return { yaw: yaw * deg, pitch: pitch * deg, roll: roll * deg };
}

function boundingBoxRatio(lm: NormalizedLandmark[]): number {
  let minX = 1;
  let minY = 1;
  let maxX = 0;
  let maxY = 0;
  for (const p of lm) {
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
  }
  return Math.max(0, (maxX - minX) * (maxY - minY));
}

export interface UseFaceLandmarker {
  loading: boolean;
  error: string | null;
  ready: boolean;
  detect: (video: HTMLVideoElement, timestampMs: number) => LiveMetrics;
}

export function useFaceLandmarker(): UseFaceLandmarker {
  const landmarkerRef = useRef<FaceLandmarker | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const fileset = await FilesetResolver.forVisionTasks(WASM_BASE);
        // Prefer GPU; fall back to CPU if the GPU delegate fails to init.
        let lm: FaceLandmarker;
        try {
          lm = await FaceLandmarker.createFromOptions(fileset, {
            baseOptions: { modelAssetPath: MODEL_URL, delegate: "GPU" },
            runningMode: "VIDEO",
            numFaces: 2, // detect extra faces so spoof/co-viewer cases are caught
            outputFaceBlendshapes: false,
            outputFacialTransformationMatrixes: true,
            minFaceDetectionConfidence: 0.5,
            minFacePresenceConfidence: 0.5,
            minTrackingConfidence: 0.5,
          });
        } catch {
          lm = await FaceLandmarker.createFromOptions(fileset, {
            baseOptions: { modelAssetPath: MODEL_URL, delegate: "CPU" },
            runningMode: "VIDEO",
            numFaces: 2,
            outputFacialTransformationMatrixes: true,
          });
        }
        if (cancelled) {
          lm.close();
          return;
        }
        landmarkerRef.current = lm;
        setReady(true);
      } catch (e) {
        setError(
          "Could not load the face-analysis model. Check your connection and reload."
        );
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
      landmarkerRef.current?.close();
      landmarkerRef.current = null;
    };
  }, []);

  const detect = useCallback(
    (video: HTMLVideoElement, timestampMs: number): LiveMetrics => {
      const lm = landmarkerRef.current;
      const empty: LiveMetrics = {
        faceCount: 0,
        ear: null,
        yaw: null,
        pitch: null,
        roll: null,
        boxRatio: 0,
        confidence: 0,
      };
      if (!lm || !video.videoWidth) return empty;

      let result: FaceLandmarkerResult;
      try {
        result = lm.detectForVideo(video, timestampMs);
      } catch {
        return empty;
      }

      const faces = result.faceLandmarks ?? [];
      if (faces.length === 0) return { ...empty, faceCount: 0 };

      const lmk = faces[0];
      const ear = (eyeAspectRatio(lmk, RIGHT_EYE) + eyeAspectRatio(lmk, LEFT_EYE)) / 2;
      const boxRatio = boundingBoxRatio(lmk);

      let yaw: number | null = null;
      let pitch: number | null = null;
      let roll: number | null = null;
      const matrix = result.facialTransformationMatrixes?.[0]?.data;
      if (matrix && matrix.length >= 16) {
        const e = eulerFromMatrix(Array.from(matrix));
        yaw = YAW_SIGN * e.yaw;
        pitch = PITCH_SIGN * e.pitch;
        roll = e.roll;
      }

      return {
        faceCount: faces.length,
        ear,
        yaw,
        pitch,
        roll,
        boxRatio,
        confidence: 1, // a detection already passed the model's confidence gate
      };
    },
    []
  );

  return { loading, error, ready, detect };
}
