import { api } from "./apiClient";
import {
  AdminDashboardResponse,
  AdminLogsResponse,
  AdminUser,
  AdminUsersResponse,
} from "../types";

export const adminService = {
  async dashboard(): Promise<AdminDashboardResponse> {
    const { data } = await api.get<AdminDashboardResponse>("/admin/dashboard");
    return data;
  },
  async users(page = 1, pageSize = 20, q?: string): Promise<AdminUsersResponse> {
    const { data } = await api.get<AdminUsersResponse>("/admin/users", {
      params: { page, page_size: pageSize, q: q || undefined },
    });
    return data;
  },
  async logs(
    page = 1,
    pageSize = 50,
    status?: string,
    q?: string
  ): Promise<AdminLogsResponse> {
    const { data } = await api.get<AdminLogsResponse>("/admin/logs", {
      params: { page, page_size: pageSize, status: status || undefined, q: q || undefined },
    });
    return data;
  },
  async setActive(userId: string, active: boolean): Promise<AdminUser> {
    const { data } = await api.post<AdminUser>(
      `/admin/users/${userId}/set-active`,
      {},
      { params: { active } }
    );
    return data;
  },
};
