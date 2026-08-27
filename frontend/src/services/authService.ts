import { api } from "./apiClient";
import {
  EmailVerifiedResponse,
  MfaStepResponse,
  RegisterResponse,
  SuccessResponse,
  TokenResponse,
} from "../types";

export interface RegisterPayload {
  full_name: string;
  email: string;
  password: string;
  confirm_password: string;
}

export const authService = {
  async register(payload: RegisterPayload): Promise<RegisterResponse> {
    const { data } = await api.post<RegisterResponse>("/auth/register", payload);
    return data;
  },

  async verifyEmail(email: string, code: string): Promise<EmailVerifiedResponse> {
    const { data } = await api.post<EmailVerifiedResponse>("/auth/verify-email", {
      email,
      code,
      purpose: "registration",
    });
    return data;
  },

  async login(email: string, password: string): Promise<MfaStepResponse> {
    const { data } = await api.post<MfaStepResponse>("/auth/login", { email, password });
    return data;
  },

  async verifyOtp(mfaToken: string, code: string): Promise<MfaStepResponse> {
    const { data } = await api.post<MfaStepResponse>("/auth/verify-otp", {
      mfa_token: mfaToken,
      code,
    });
    return data;
  },

  // Resend during registration (email mode) or during login (mfa_token mode).
  async resendOtpByEmail(email: string): Promise<SuccessResponse> {
    const { data } = await api.post<SuccessResponse>("/auth/resend-otp", {
      email,
      purpose: "registration",
    });
    return data;
  },
  async resendOtpByMfaToken(mfaToken: string): Promise<SuccessResponse> {
    const { data } = await api.post<SuccessResponse>("/auth/resend-otp", { mfa_token: mfaToken });
    return data;
  },

  async logout(): Promise<SuccessResponse> {
    const { data } = await api.post<SuccessResponse>("/auth/logout", {});
    return data;
  },

  // Used at app boot to re-mint an access token from the refresh cookie.
  async refresh(): Promise<TokenResponse> {
    const { data } = await api.post<TokenResponse>("/auth/refresh", {});
    return data;
  },
};
