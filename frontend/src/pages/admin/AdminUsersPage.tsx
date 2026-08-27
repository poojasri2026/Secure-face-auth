import { FormEvent, useState } from "react";
import { RefreshCw, Search, ShieldCheck, UserCheck, UserX } from "lucide-react";
import { Card, CardBody, CardHeader } from "../../components/ui/Card";
import { Badge } from "../../components/ui/Badge";
import { Alert } from "../../components/ui/Alert";
import { Spinner } from "../../components/ui/Spinner";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { useAsync } from "../../hooks/useAsync";
import { useAuth } from "../../context/AuthContext";
import { adminService } from "../../services/adminService";
import { formatDateTime } from "../../utils/format";
import { errorMessage } from "../../utils/errors";
import { AdminUser } from "../../types";

const PAGE_SIZE = 20;

export default function AdminUsersPage() {
  const { user: me } = useAuth();
  const [page, setPage] = useState(1);
  const [q, setQ] = useState("");
  const [input, setInput] = useState("");
  const [actionError, setActionError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const list = useAsync(() => adminService.users(page, PAGE_SIZE, q), [page, q]);

  function onSearch(e: FormEvent) {
    e.preventDefault();
    setPage(1);
    setQ(input.trim());
  }

  async function toggleActive(u: AdminUser) {
    setActionError(null);
    setBusyId(u.id);
    try {
      const updated = await adminService.setActive(u.id, !u.is_active);
      // Patch the row in place so the table reflects the new state immediately.
      if (list.data) {
        list.setData({
          ...list.data,
          items: list.data.items.map((it) => (it.id === updated.id ? updated : it)),
        });
      }
    } catch (e) {
      setActionError(errorMessage(e, "Could not update that user."));
    } finally {
      setBusyId(null);
    }
  }

  const totalPages = list.data ? Math.max(1, Math.ceil(list.data.total / PAGE_SIZE)) : 1;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Users</h1>
          <p className="mt-1 text-sm text-slate-500">Manage accounts and access.</p>
        </div>
        <form onSubmit={onSearch} className="flex items-center gap-2">
          <Input
            name="q"
            placeholder="Search name or email"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            className="w-64"
          />
          <Button type="submit" variant="secondary">
            <Search className="h-4 w-4" /> Search
          </Button>
        </form>
      </div>

      {actionError && <Alert tone="error">{actionError}</Alert>}

      <Card>
        <CardHeader
          title="All users"
          icon={<ShieldCheck className="h-5 w-5" />}
          action={
            <Button variant="ghost" size="sm" onClick={() => list.reload()}>
              <RefreshCw className="h-4 w-4" /> Refresh
            </Button>
          }
        />
        <CardBody className="p-0">
          {list.loading ? (
            <div className="flex justify-center py-10">
              <Spinner className="h-6 w-6 text-brand-600" />
            </div>
          ) : list.error ? (
            <div className="p-5">
              <Alert tone="error">{list.error}</Alert>
            </div>
          ) : list.data && list.data.items.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-slate-100 text-xs uppercase tracking-wide text-slate-400">
                  <tr>
                    <th className="px-5 py-3 font-medium">User</th>
                    <th className="px-5 py-3 font-medium">Factors</th>
                    <th className="px-5 py-3 font-medium">Role</th>
                    <th className="px-5 py-3 font-medium">Last sign-in</th>
                    <th className="px-5 py-3 font-medium">Status</th>
                    <th className="px-5 py-3 font-medium text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {list.data.items.map((u) => {
                    const isSelf = u.id === me?.id;
                    return (
                      <tr key={u.id} className="hover:bg-slate-50">
                        <td className="px-5 py-3">
                          <div className="font-medium text-slate-800">{u.full_name}</div>
                          <div className="text-xs text-slate-400">{u.email}</div>
                        </td>
                        <td className="px-5 py-3">
                          <div className="flex flex-wrap gap-1">
                            <Badge tone={u.is_email_verified ? "green" : "gray"}>Email</Badge>
                            <Badge tone={u.is_face_enrolled ? "green" : "gray"}>Face</Badge>
                            <Badge tone={u.mfa_enabled ? "brand" : "gray"}>MFA</Badge>
                          </div>
                        </td>
                        <td className="px-5 py-3">
                          {u.is_admin ? <Badge tone="brand">Admin</Badge> : <span className="text-slate-400">User</span>}
                        </td>
                        <td className="whitespace-nowrap px-5 py-3 text-slate-600">
                          {formatDateTime(u.last_login_at)}
                        </td>
                        <td className="px-5 py-3">
                          <Badge tone={u.is_active ? "green" : "red"}>
                            {u.is_active ? "Active" : "Disabled"}
                          </Badge>
                        </td>
                        <td className="px-5 py-3 text-right">
                          <Button
                            size="sm"
                            variant={u.is_active ? "danger" : "secondary"}
                            loading={busyId === u.id}
                            disabled={isSelf || busyId === u.id}
                            title={isSelf ? "You can't disable your own account" : undefined}
                            onClick={() => toggleActive(u)}
                          >
                            {u.is_active ? (
                              <>
                                <UserX className="h-4 w-4" /> Disable
                              </>
                            ) : (
                              <>
                                <UserCheck className="h-4 w-4" /> Enable
                              </>
                            )}
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="py-10 text-center text-sm text-slate-500">No users match your search.</p>
          )}
        </CardBody>
      </Card>

      {list.data && list.data.total > PAGE_SIZE && (
        <div className="flex items-center justify-between text-sm">
          <span className="text-slate-500">
            Page {page} of {totalPages} · {list.data.total} users
          </span>
          <div className="flex gap-2">
            <Button
              variant="secondary"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              Previous
            </Button>
            <Button
              variant="secondary"
              size="sm"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
