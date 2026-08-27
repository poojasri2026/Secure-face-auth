import { useState } from "react";
import { Activity, Fingerprint, Lock, Mail, RefreshCw, ScanFace, ShieldAlert, ShieldCheck } from "lucide-react";
import { Card, CardBody, CardHeader } from "../components/ui/Card";
import { Badge, statusTone } from "../components/ui/Badge";
import { Alert } from "../components/ui/Alert";
import { Spinner } from "../components/ui/Spinner";
import { Button } from "../components/ui/Button";
import { useAsync } from "../hooks/useAsync";
import { userService } from "../services/userService";
import { formatDateTime, humanizeMethod, humanizeReason, relativeTime } from "../utils/format";

const LIMIT = 50;

function methodIcon(method: string) {
  switch (method) {
    case "FACE":
      return <ScanFace className="h-4 w-4 text-purple-600" />;
    case "EMAIL_OTP":
      return <Mail className="h-4 w-4 text-blue-600" />;
    case "MFA":
      return <ShieldCheck className="h-4 w-4 text-emerald-600" />;
    case "PASSWORD":
      return <Lock className="h-4 w-4 text-slate-600" />;
    default:
      return <Fingerprint className="h-4 w-4 text-indigo-600" />;
  }
}

export default function LoginHistoryPage() {
  const [limit, setLimit] = useState(LIMIT);
  const history = useAsync(() => userService.loginHistory(limit), [limit]);

  return (
    <div className="space-y-7 animate-fade-in pb-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">Authentication Audit Log</h1>
          <p className="mt-1 text-sm text-slate-500">
            Real-time chronological activity across passwords, OTP codes, liveness and face recognition.
          </p>
        </div>
        <Button variant="secondary" size="sm" onClick={() => history.reload()}>
          <RefreshCw className="h-3.5 w-3.5" /> Refresh Audit Trail
        </Button>
      </div>

      <Card>
        <CardHeader
          title="Recent Verification Attempts"
          subtitle="Detailed forensic logs of each stage"
          icon={<Activity className="h-5 w-5" />}
        />
        <CardBody className="p-0">
          {history.loading ? (
            <div className="flex justify-center py-12">
              <Spinner className="h-6 w-6 text-brand-600" />
            </div>
          ) : history.error ? (
            <div className="p-6">
              <Alert tone="error">{history.error}</Alert>
            </div>
          ) : history.data && history.data.items.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-slate-100 bg-slate-50/50 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  <tr>
                    <th className="px-6 py-3.5">Timestamp</th>
                    <th className="px-6 py-3.5">Method</th>
                    <th className="px-6 py-3.5">Outcome</th>
                    <th className="px-6 py-3.5">Forensic Details</th>
                    <th className="px-6 py-3.5">Source IP</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100/80">
                  {history.data.items.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="whitespace-nowrap px-6 py-4 text-xs font-mono text-slate-700">
                        <div>{formatDateTime(item.created_at)}</div>
                        <div className="text-[10px] text-slate-400 font-sans">{relativeTime(item.created_at)}</div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-slate-100 ring-1 ring-slate-200/50">
                            {methodIcon(item.authentication_method)}
                          </div>
                          <span className="text-sm font-semibold text-slate-800">
                            {humanizeMethod(item.authentication_method)}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <Badge tone={statusTone(item.status)}>{item.status}</Badge>
                      </td>
                      <td className="px-6 py-4 text-xs text-slate-500">
                        {humanizeReason(item.failure_reason) ? (
                          <span className="font-medium text-rose-600">
                            {humanizeReason(item.failure_reason)}
                          </span>
                        ) : (
                          <span className="text-slate-400">Normal verification</span>
                        )}
                      </td>
                      <td className="px-6 py-4 font-mono text-xs text-slate-500">
                        {item.ip_address || "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2 py-12 text-center text-sm text-slate-500">
              <ShieldAlert className="h-8 w-8 text-slate-300" />
              No authentication activity recorded yet.
            </div>
          )}
        </CardBody>
      </Card>

      {history.data && history.data.total > history.data.items.length && (
        <div className="flex justify-center pt-2">
          <Button variant="secondary" onClick={() => setLimit((l) => l + LIMIT)}>
            Load More Records
          </Button>
        </div>
      )}
    </div>
  );
}
