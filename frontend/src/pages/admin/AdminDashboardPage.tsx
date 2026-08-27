import { ReactNode } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  BarChart3,
  Ban,
  CheckCircle2,
  ScanFace,
  ShieldCheck,
  Users,
  XCircle,
} from "lucide-react";
import { Card, CardBody, CardHeader } from "../../components/ui/Card";
import { Badge, statusTone } from "../../components/ui/Badge";
import { Alert } from "../../components/ui/Alert";
import { Spinner } from "../../components/ui/Spinner";
import { Button } from "../../components/ui/Button";
import { useAsync } from "../../hooks/useAsync";
import { adminService } from "../../services/adminService";
import { formatDateTime, humanizeMethod, humanizeReason } from "../../utils/format";
import { DailyActivity } from "../../types";

function Stat({
  label,
  value,
  icon,
}: {
  label: string;
  value: number | string;
  icon: ReactNode;
}) {
  return (
    <Card>
      <CardBody className="flex items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
          {icon}
        </span>
        <div>
          <p className="text-xs text-slate-500">{label}</p>
          <p className="text-lg font-semibold text-slate-900">{value}</p>
        </div>
      </CardBody>
    </Card>
  );
}

// Lightweight inline bar chart so we avoid pulling in a chart dependency.
function ActivityChart({ data }: { data: DailyActivity[] }) {
  const max = Math.max(1, ...data.map((d) => d.success + d.failed + d.blocked));
  return (
    <div className="flex items-end gap-2 pt-2" style={{ height: 160 }}>
      {data.map((d) => {
        const total = d.success + d.failed + d.blocked;
        return (
          <div key={d.date} className="flex flex-1 flex-col items-center gap-1">
            <div
              className="flex w-full flex-col justify-end overflow-hidden rounded-md bg-slate-100"
              style={{ height: 130 }}
              title={`${d.date}: ${d.success} success, ${d.failed} failed, ${d.blocked} blocked`}
            >
              <div className="w-full bg-red-400" style={{ height: `${(d.blocked / max) * 130}px` }} />
              <div className="w-full bg-amber-400" style={{ height: `${(d.failed / max) * 130}px` }} />
              <div
                className="w-full bg-brand-500"
                style={{ height: `${(d.success / max) * 130}px` }}
              />
            </div>
            <span className="text-[10px] text-slate-400">{d.date.slice(5)}</span>
            <span className="text-[10px] font-medium text-slate-500">{total}</span>
          </div>
        );
      })}
    </div>
  );
}

export default function AdminDashboardPage() {
  const dash = useAsync(() => adminService.dashboard(), []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Admin overview</h1>
        <p className="mt-1 text-sm text-slate-500">
          System-wide authentication metrics and recent events.
        </p>
      </div>

      {dash.loading ? (
        <div className="flex justify-center py-10">
          <Spinner className="h-6 w-6 text-brand-600" />
        </div>
      ) : dash.error ? (
        <Alert tone="error">{dash.error}</Alert>
      ) : dash.data ? (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Stat label="Total users" value={dash.data.stats.total_users} icon={<Users className="h-5 w-5" />} />
            <Stat
              label="Verified users"
              value={dash.data.stats.verified_users}
              icon={<ShieldCheck className="h-5 w-5" />}
            />
            <Stat
              label="Face enrolled"
              value={dash.data.stats.face_enrolled_users}
              icon={<ScanFace className="h-5 w-5" />}
            />
            <Stat
              label="Active sessions"
              value={dash.data.stats.active_sessions}
              icon={<BarChart3 className="h-5 w-5" />}
            />
            <Stat
              label="Successful MFA"
              value={dash.data.mfa_success}
              icon={<CheckCircle2 className="h-5 w-5" />}
            />
            <Stat
              label="Failed logins"
              value={dash.data.stats.failed_logins}
              icon={<XCircle className="h-5 w-5" />}
            />
            <Stat
              label="Blocked attempts"
              value={dash.data.stats.blocked_attempts}
              icon={<Ban className="h-5 w-5" />}
            />
            <Stat
              label="Failed MFA"
              value={dash.data.mfa_failed}
              icon={<XCircle className="h-5 w-5" />}
            />
          </div>

          <Card>
            <CardHeader
              title="Authentication activity (last 7 days)"
              subtitle="Successful, failed and blocked attempts per day."
              icon={<BarChart3 className="h-5 w-5" />}
            />
            <CardBody>
              {dash.data.login_activity.length > 0 ? (
                <>
                  <ActivityChart data={dash.data.login_activity} />
                  <div className="mt-4 flex items-center gap-4 text-xs text-slate-500">
                    <span className="flex items-center gap-1">
                      <span className="h-2.5 w-2.5 rounded-sm bg-brand-500" /> Success
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="h-2.5 w-2.5 rounded-sm bg-amber-400" /> Failed
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="h-2.5 w-2.5 rounded-sm bg-red-400" /> Blocked
                    </span>
                  </div>
                </>
              ) : (
                <p className="py-6 text-center text-sm text-slate-500">No activity in this window.</p>
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader
              title="Recent events"
              subtitle="Latest authentication events across all users."
              icon={<ShieldCheck className="h-5 w-5" />}
              action={
                <Link to="/admin/logs">
                  <Button variant="ghost" size="sm">
                    All logs <ArrowRight className="h-4 w-4" />
                  </Button>
                </Link>
              }
            />
            <CardBody className="p-0">
              {dash.data.recent_events.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="border-b border-slate-100 text-xs uppercase tracking-wide text-slate-400">
                      <tr>
                        <th className="px-5 py-3 font-medium">When</th>
                        <th className="px-5 py-3 font-medium">User</th>
                        <th className="px-5 py-3 font-medium">Method</th>
                        <th className="px-5 py-3 font-medium">Status</th>
                        <th className="px-5 py-3 font-medium">Detail</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {dash.data.recent_events.map((ev) => (
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
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="py-6 text-center text-sm text-slate-500">No recent events.</p>
              )}
            </CardBody>
          </Card>
        </>
      ) : null}
    </div>
  );
}
