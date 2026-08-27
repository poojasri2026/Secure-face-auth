import { api } from "./apiClient";
import {
  ChallengeSample,
  LivenessChallengeResponse,
  LivenessCompleteResponse,
  LivenessStartResponse,
} from "../types";

export const livenessService = {
  async start(mfaToken: string): Promise<LivenessStartResponse> {
    const { data } = await api.post<LivenessStartResponse>("/liveness/start", {
      mfa_token: mfaToken,
    });
    return data;
  },

  // Only small numeric signal samples are sent (never video). The server
  // decides whether the challenge was genuinely performed.
  async submitChallenge(
    livenessToken: string,
    challenge: string,
    samples: ChallengeSample[]
  ): Promise<LivenessChallengeResponse> {
    const { data } = await api.post<LivenessChallengeResponse>("/liveness/challenge", {
      liveness_token: livenessToken,
      challenge,
      samples,
    });
    return data;
  },

  async complete(mfaToken: string, livenessToken: string): Promise<LivenessCompleteResponse> {
    const { data } = await api.post<LivenessCompleteResponse>("/liveness/complete", {
      mfa_token: mfaToken,
      liveness_token: livenessToken,
    });
    return data;
  },
};
