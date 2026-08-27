import { FormEvent, useState } from "react";
import { ClipboardList, RefreshCw, Search } from "lucide-react";
import { Card, CardBody, CardHeader } from "../../components/ui/Card";
import { Badge, statusTone } from "../../components/ui/Badge";
import { Alert } from "../../components/ui/Alert";
import { Spinner } from "../../components/ui/Spinner";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { cn } from "../../utils/cn";
import { useAsync } from "../../hooks/useAsync";
import { adminService } from "../../services/adminService";
import { formatDateTime, humanizeMethod, humanizeReason } from "../../utils/format";

const PAGE_SIZE = 50;
const STATUSES = ["", "SUCCESS", "FAILED", "BLOCKED"] as const;
const STATUS_LABELS: Record<string, string> = {
  "": "All",
  SUCCESS: "Success",
  FAILED: "Failed",
  BLOCKED: "Blocked",
};

export default function AdminLogsPage() {
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<string>("");
  const [q, setQ] = useState("");
  const [input, setInput] = useState("");

  const logs = useAsync(() => adminService.logs(page, PAGE_SIZE, status, q), [page, status, q]);

  function onSearch(e: FormEvent) {
    e.preventDefault();
    setPage(1);
    setQ(input.trim());
  }

  const totalPages = logs.data ? Math.max(1, Math.ceil(logs.data.total / PAGE_SIZE)) : 1;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Authentication logs</h1>
          <p className="mt-1 text-sm text-slate-500">
            Every authentication event, recorded server-side.
          </p>
        </div>
        <form onSubmit={onSearch} className="flex items-center gap-2">
          <Input
            name="q"
            placeholder="Search email"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            className="w-56"
          />
          <Button type="submit" variant="secondary">
            <Search className="h-4 w-4" /> Search
          </Button>
        </form>
      </div>

      <div className="flex flex-wrap gap-2">
        {STATUSES.map((s) => (
          <button
            key={s || "all"}
            onClick={() => {
              setPage(1);
              setStatus(s);
            }}
            className={cn(
              "rounded-full px-3 py-1 text-sm font-medium transition-colors",
              status === s
                ? "bg-brand-600 text-white"
                : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"
            )}
          >
            {STATUS_LABELS[s]}
          </button>
        ))}
      </div>

      <Card>
        <CardHeader
          title="Events"
          icon={<ClipboardList className="h-5 w-5" />}
          action={
            <Button variant="ghost" size="sm" onClick={() => logs.reload()}>
              <RefreshCw className="h-4 w-4" /> Refresh
            </Button>
          }
        />
        <CardBody className="p-0">
          {logs.loading ? (
            <div className="flex justify-center py-10">
              <Spinner className="h-6 w-6 text-brand-600" />
            </div>
          ) : logs.error ? (
            <div className="p-5">
              <Alert tone="error">{logs.error}</Alert>
            </div>
          ) : logs.data && logs.data.items.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-slate-100 text-xs uppercase tracking-wide text-slate-400">
                  <tr>
                    <th className="px-5 py-3 font-medium">When</th>
                    <th className="px-5 py-3 font-medium">User</th>
                    <th className="px-5 py-3 font-medium">Method</th>
                    <th className="px-5 py-3 font-medium">Status</th>
                    <th className="px-5 py-3 font-medium">Detail</th>
                    <th className="px-5 py-3 font-medium">IP</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {logs.data.items.map((ev) => (
                    <tr key={ev.id} className="hover:bg-slate-50">
                      <td className="whitespace-nowrap px-5 py-3 text-slate-700">
                        {formatDateTime(ev.created_at)}
                      </td>
                      <td className="px-5 py-3 text-slate-600">{ev.email || "—"}</td>
                      <td className="px-5 py-3 text-slate-700">
                        {humanizeMethod(ev.authentication_method)}
                      </td>
                      <td className="px-5 py-3">
                        <Badge tone={statusTone(ev.status)}>{ev.status}</Badge>
                      </td>
                      <td className="px-5 py-3 text-slate-500">
                        {humanizeReason(ev.failure_reason) || "—"}
                      </td>
                      <td className="px-5 py-3 font-mono text-xs text-slate-500">
                        {ev.ip_address || "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="py-10 text-center text-sm text-slate-500">No matching events.</p>
          )}
        </CardBody>
      </Card>

      {logs.data && logs.data.total > PAGE_SIZE && (
        <div className="flex items-center justify-between text-sm">
          <span className="text-slate-500">
            Page {page} of {totalPages} · {logs.data.total} events
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
