import { useCallback, useEffect, useState } from "react";
import { Braces, Lock, ScrollText, ShieldAlert } from "lucide-react";
import { getBackend } from "@/lib/backend";
import type { AuditLogEntry } from "@/lib/types";
import { fmtDateTime, timeAgo } from "@/lib/utils";
import {
  Avatar,
  Badge,
  Button,
  EmptyState,
  Modal,
  PageLoader,
  Pagination,
  SearchInput,
  Select,
  useToast,
} from "@/components/ui";

const PAGE_SIZE = 20;

function actionTone(action: string): "navy" | "green" | "red" | "amber" | "slate" {
  if (action.startsWith("attendance.corrected")) return "amber";
  if (action.startsWith("attendance")) return "navy";
  if (action.startsWith("personnel.deactivated")) return "red";
  if (action.startsWith("personnel")) return "green";
  if (action.startsWith("auth.login_failed") || action.startsWith("authz") || action.startsWith("auth.login_blocked")) return "red";
  if (action.startsWith("auth")) return "slate";
  if (action.startsWith("report")) return "navy";
  return "slate";
}

const ACTION_FILTERS = [
  ["all", "All actions"],
  ["attendance", "Attendance"],
  ["personnel", "Personnel lifecycle"],
  ["auth", "Authentication"],
  ["authz", "Authorisation denials"],
  ["report", "Report exports"],
] as const;

export default function AuditLogsPage() {
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [action, setAction] = useState<string>("all");
  const [page, setPage] = useState(1);
  const [rows, setRows] = useState<AuditLogEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [detail, setDetail] = useState<AuditLogEntry | null>(null);

  useEffect(() => {
    const t = window.setTimeout(() => {
      setDebounced(search.trim());
      setPage(1);
    }, 300);
    return () => window.clearTimeout(t);
  }, [search]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getBackend().listAudit({ search: debounced, action, page, pageSize: PAGE_SIZE });
      setRows(res.rows);
      setTotal(res.total);
    } catch (e) {
      toast("error", "Could not load audit logs", e instanceof Error ? e.message : undefined);
    } finally {
      setLoading(false);
    }
  }, [debounced, action, page, toast]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="space-y-5">
      <div className="rise flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-xl font-extrabold tracking-tight text-navy-950 sm:text-2xl">Audit logs</h2>
          <p className="mt-1 text-xs font-medium text-slate-500 sm:text-sm">
            Immutable record of sensitive changes — admins cannot edit or delete entries
          </p>
        </div>
        <Badge tone="navy" className="gap-1.5 px-3 py-1.5">
          <Lock size={12} /> {total.toLocaleString()} entries
        </Badge>
      </div>

      <div className="card rise rise-1 flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Search actor, action, reason or metadata…"
          className="flex-1"
        />
        <Select
          value={action}
          onChange={(e) => {
            setAction(e.target.value);
            setPage(1);
          }}
          className="sm:w-56"
        >
          {ACTION_FILTERS.map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </Select>
      </div>

      <div className="card rise rise-2 overflow-hidden">
        {loading ? (
          <PageLoader label="Loading audit trail…" />
        ) : rows.length === 0 ? (
          <EmptyState
            title="No audit entries match"
            body="Sensitive actions across the system are recorded here automatically."
            icon={<ScrollText size={22} />}
          />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[880px]">
                <thead>
                  <tr>
                    <th className="th">Timestamp</th>
                    <th className="th">Actor</th>
                    <th className="th text-center">Action</th>
                    <th className="th">Target</th>
                    <th className="th">Reason / detail</th>
                    <th className="th text-right">Data</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((a) => (
                    <tr key={a.id} className="row-hover">
                      <td className="td whitespace-nowrap" title={fmtDateTime(a.timestamp)}>
                        <p className="font-semibold text-navy-950">{timeAgo(a.timestamp)}</p>
                        <p className="text-[0.68rem] text-slate-400">{fmtDateTime(a.timestamp)}</p>
                      </td>
                      <td className="td">
                        {a.actorName === "System" ? (
                          <span className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-500">
                            <ShieldAlert size={13} className="text-slate-400" /> System
                          </span>
                        ) : (
                          <span className="flex items-center gap-2">
                            <Avatar name={a.actorName} size="sm" />
                            <span className="text-xs font-bold text-navy-900">
                              {a.actorName.replace(/\(.*?\)/g, "").trim()}
                            </span>
                          </span>
                        )}
                      </td>
                      <td className="td text-center">
                        <Badge tone={actionTone(a.action)} className="font-mono text-[0.65rem]">
                          {a.action}
                        </Badge>
                      </td>
                      <td className="td">
                        <span className="font-mono text-[0.68rem] text-slate-500">
                          {a.targetTable}
                          {a.targetRecordId ? (
                            <span className="text-slate-400"> · {a.targetRecordId.slice(0, 10)}…</span>
                          ) : null}
                        </span>
                      </td>
                      <td className="td max-w-64">
                        {a.reason ? (
                          <span className="line-clamp-2 text-xs leading-snug text-slate-600" title={a.reason}>
                            {a.reason}
                          </span>
                        ) : (
                          <span className="text-xs text-slate-400">—</span>
                        )}
                      </td>
                      <td className="td text-right">
                        <Button size="sm" variant="ghost" icon={<Braces size={13} />} onClick={() => setDetail(a)}>
                          View
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination page={page} pageSize={PAGE_SIZE} total={total} onPage={setPage} />
          </>
        )}
      </div>

      <p className="rise rise-2 flex items-start gap-2 text-[0.68rem] leading-relaxed text-slate-400">
        <Lock size={12} className="mt-0.5 shrink-0" />
        Audit entries never contain passwords, OTPs or session tokens. Write access is restricted to trusted
        server-side logic; ordinary admin sessions have read-only access (enforced by RLS in the Supabase build).
      </p>

      {/* Metadata detail */}
      <Modal
        open={!!detail}
        onClose={() => setDetail(null)}
        title={detail?.action ?? "Audit entry"}
        subtitle={detail ? fmtDateTime(detail.timestamp) : undefined}
      >
        {detail && (
          <div className="space-y-3">
            <dl className="grid grid-cols-1 gap-2 text-xs sm:grid-cols-2">
              <div className="rounded-lg bg-slate-50 p-3">
                <dt className="font-bold uppercase tracking-wider text-slate-400">Actor</dt>
                <dd className="mt-0.5 font-semibold text-navy-950">{detail.actorName}</dd>
              </div>
              <div className="rounded-lg bg-slate-50 p-3">
                <dt className="font-bold uppercase tracking-wider text-slate-400">Target</dt>
                <dd className="mt-0.5 break-all font-mono font-semibold text-navy-950">
                  {detail.targetTable}
                  {detail.targetRecordId ? ` · ${detail.targetRecordId}` : ""}
                </dd>
              </div>
            </dl>
            {detail.reason && (
              <div className="rounded-lg bg-amber-50 p-3 text-xs ring-1 ring-inset ring-amber-200">
                <p className="font-bold uppercase tracking-wider text-amber-700">Reason</p>
                <p className="mt-0.5 font-medium leading-relaxed text-amber-900">{detail.reason}</p>
              </div>
            )}
            <div>
              <p className="mb-1 text-[0.68rem] font-bold uppercase tracking-wider text-slate-400">Safe metadata</p>
              <pre className="max-h-64 overflow-auto rounded-xl bg-navy-950 p-4 font-mono text-[0.7rem] leading-relaxed text-navy-100">
                {JSON.stringify(detail.metadata, null, 2)}
              </pre>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
