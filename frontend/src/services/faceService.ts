import { api } from "./apiClient";
import { FaceEnrollResponse, FaceVerifyResponse, SuccessResponse } from "../types";

export const faceService = {
  // `images` are base64 JPEG data captured in the browser during enrollment.
  // Pass `enrollToken` for the first-time flow (short-lived enroll-scoped JWT
  // issued after email verification). When re-enrolling while logged in, omit
  // it and the normal access token is attached by the client interceptor.
  async enroll(images: string[], enrollToken?: string): Promise<FaceEnrollResponse> {
    const { data } = await api.post<FaceEnrollResponse>(
      "/face/enroll",
      { images },
      enrollToken
        ? {
            headers: { Authorization: `Bearer ${enrollToken}` },
            // Don't try to silently refresh a scoped token on 401.
            _skipAuthRefresh: true,
          } as never
        : undefined
    );
    return data;
  },

  // Final MFA step. On success the backend sets the refresh cookie and returns
  // the access token. The match decision is made entirely server-side.
  async verify(mfaToken: string, image: string): Promise<FaceVerifyResponse> {
    const { data } = await api.post<FaceVerifyResponse>("/face/verify", {
      mfa_token: mfaToken,
      image,
    });
    return data;
  },

  async remove(): Promise<SuccessResponse> {
    const { data } = await api.delete<SuccessResponse>("/face");
    return data;
  },
};
