import { api } from "./apiClient";
import {
  LoginHistoryResponse,
  SecurityStatus,
  SuccessResponse,
  User,
} from "../types";

export const userService = {
  async me(): Promise<User> {
    const { data } = await api.get<User>("/users/me");
    return data;
  },
  async security(): Promise<SecurityStatus> {
    const { data } = await api.get<SecurityStatus>("/users/security");
    return data;
  },
  async loginHistory(limit = 20): Promise<LoginHistoryResponse> {
    const { data } = await api.get<LoginHistoryResponse>("/users/login-history", {
      params: { limit },
    });
    return data;
  },
  async changePassword(
    current_password: string,
    new_password: string,
    confirm_new_password: string
  ): Promise<SuccessResponse> {
    const { data } = await api.post<SuccessResponse>("/users/change-password", {
      current_password,
      new_password,
      confirm_new_password,
    });
    return data;
  },
  async logoutAll(): Promise<SuccessResponse> {
    const { data } = await api.post<SuccessResponse>("/users/logout-all", {});
    return data;
  },
};
