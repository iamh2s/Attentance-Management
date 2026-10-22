import { useCallback, useEffect, useMemo, useState } from "react";
import { BarChart3, CalendarDays, Download, FileSpreadsheet, MoonStar, UserCheck, Users, UserX, CircleDashed } from "lucide-react";
import { getBackend } from "@/lib/backend";
import type { DailyReport, MonthlyReport } from "@/lib/types";
import {
  STATUS_META,
  addDaysISO,
  downloadCSV,
  fmtDate,
  monthLabel,
  pct,
  todayISO,
} from "@/lib/utils";
import {
  Avatar,
  Button,
  EmptyState,
  PageLoader,
  Pagination,
  SearchInput,
  Select,
  StatusBadge,
  useToast,
} from "@/components/ui";
import { cn } from "@/utils/cn";

type Tab = "daily" | "monthly";

function SegmentedBar({ parts, total }: { parts: Array<{ key: keyof typeof STATUS_META; value: number }>; total: number }) {
  return (
    <div className="flex h-3 w-full overflow-hidden rounded-full bg-slate-100">
      {parts.map((p) => (
        <span
          key={p.key}
          style={{ width: `${total ? (p.value / total) * 100 : 0}%`, background: STATUS_META[p.key].hex }}
          className="h-full transition-all duration-500"
          title={`${STATUS_META[p.key].label}: ${p.value}`}
        />
      ))}
    </div>
  );
}

// ── Daily report ─────────────────────────────────────────────

function DailyTab() {
  const { toast } = useToast();
  const today = todayISO();
  const [date, setDate] = useState(today);
  const [report, setReport] = useState<DailyReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    getBackend()
      .dailyReport(date)
      .then((r) => alive && setReport(r))
      .catch((e) => toast("error", "Could not build daily report", e instanceof Error ? e.message : undefined))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [date, toast]);

  const filtered = useMemo(() => {
    if (!report) return [];
    const s = search.trim().toLowerCase();
    if (!s) return report.rows;
    return report.rows.filter(
      (r) => r.profile.fullName.toLowerCase().includes(s) || r.profile.personnelId.toLowerCase().includes(s)
    );
  }, [report, search]);

  const PAGE = 20;
  const pageRows = filtered.slice((page - 1) * PAGE, page * PAGE);

  async function exportCSV() {
    if (!report) return;
    const rows = filtered.map((r) => [
      r.profile.personnelId,
      r.profile.fullName,
      r.profile.designation.replace(/\s*\(Demo\)/, ""),
      r.profile.unitLabel.replace(/\s*\(Demo\)/, ""),
      STATUS_META[r.status].label,
      r.record?.updatedByName.replace(/\(.*?\)/g, "").trim() ?? "",
      r.record?.correctionReason ?? "",
    ]);
    downloadCSV(
      `apams-daily-report-${date}.csv`,
      ["Personnel ID", "Full Name", "Designation", "Unit", "Status", "Updated By", "Correction Reason"],
      rows
    );
    await getBackend().logExport("attendance", { kind: "daily", date, rows: rows.length, filter: search || null });
    toast("success", "Daily report exported", `${rows.length.toLocaleString()} rows · export recorded in audit log.`);
  }

  const cards = report
    ? [
        { label: "Active Personnel", value: report.totalActive, icon: <Users size={16} />, cls: "text-navy-700 bg-navy-50" },
        { label: "Present", value: report.present, icon: <UserCheck size={16} />, cls: "text-emerald-600 bg-emerald-50" },
        { label: "Absent", value: report.absent, icon: <UserX size={16} />, cls: "text-rose-600 bg-rose-50" },
        { label: "On Leave", value: report.approvedLeave, icon: <MoonStar size={16} />, cls: "text-amber-600 bg-amber-50" },
        { label: "Not Marked", value: report.notMarked, icon: <CircleDashed size={16} />, cls: "text-slate-500 bg-slate-100" },
      ]
    : [];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <CalendarDays size={16} className="text-slate-400" />
          <input
            type="date"
            className="input h-9.5 w-auto text-sm font-bold"
            value={date}
            min={addDaysISO(today, -365)}
            max={today}
            onChange={(e) => e.target.value && setDate(e.target.value)}
          />
          <span className="text-xs font-semibold text-slate-500">{fmtDate(date)}</span>
        </div>
        <Button variant="secondary" size="sm" icon={<Download size={14} />} onClick={exportCSV} disabled={!report}>
          Export CSV
        </Button>
      </div>

      {loading ? (
        <PageLoader label="Building daily report…" />
      ) : !report ? (
        <EmptyState title="No report data" icon={<BarChart3 size={22} />} />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {cards.map((c) => (
              <div key={c.label} className="card flex items-center gap-3 p-3.5">
                <span className={cn("inline-flex h-9 w-9 items-center justify-center rounded-lg", c.cls)}>{c.icon}</span>
                <div>
                  <p className="text-[0.62rem] font-bold uppercase tracking-wider text-slate-500">{c.label}</p>
                  <p className="tnums text-lg font-extrabold leading-tight text-navy-950">{c.value.toLocaleString("en-IN")}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="card space-y-2.5 p-4">
            <div className="flex items-center justify-between text-xs font-bold text-slate-500">
              <span>Status distribution — {fmtDate(date)}</span>
              <span className="tnums text-navy-950">
                Attendance rate: {report.attendancePct.toFixed(1)}%{" "}
                <span className="font-medium text-slate-400">(Present ÷ Present+Absent)</span>
              </span>
            </div>
            <SegmentedBar
              total={report.totalActive}
              parts={[
                { key: "present", value: report.present },
                { key: "absent", value: report.absent },
                { key: "approved_leave", value: report.approvedLeave },
                { key: "not_marked", value: report.notMarked },
              ]}
            />
            <div className="flex flex-wrap gap-3 pt-1">
              {(["present", "absent", "approved_leave", "not_marked"] as const).map((k) => (
                <span key={k} className="flex items-center gap-1.5 text-[0.68rem] font-bold text-slate-500">
                  <span className="h-2 w-2 rounded-full" style={{ background: STATUS_META[k].hex }} />
                  {STATUS_META[k].plural} ·{" "}
                  {pct(
                    k === "present"
                      ? report.present
                      : k === "absent"
                        ? report.absent
                        : k === "approved_leave"
                          ? report.approvedLeave
                          : report.notMarked,
                    report.totalActive
                  )}
                  %
                </span>
              ))}
            </div>
          </div>

          <div className="card overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-4 py-3">
              <p className="text-xs font-bold text-navy-950">
                Personnel breakdown{" "}
                <span className="font-medium text-slate-400">({filtered.length.toLocaleString()} records)</span>
              </p>
              <SearchInput
                value={search}
                onChange={(v) => {
                  setSearch(v);
                  setPage(1);
                }}
                placeholder="Filter by name or ID…"
                className="w-full sm:w-64"
              />
            </div>
            {pageRows.length === 0 ? (
              <EmptyState title="No matching personnel" icon={<Users size={22} />} />
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[720px]">
                    <thead>
                      <tr>
                        <th className="th">Personnel</th>
                        <th className="th">Personnel ID</th>
                        <th className="th">Unit</th>
                        <th className="th text-center">Status</th>
                        <th className="th">Updated by</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pageRows.map((r) => (
                        <tr key={r.profile.id} className="row-hover">
                          <td className="td">
                            <div className="flex items-center gap-2.5">
                              <Avatar name={r.profile.fullName} size="sm" />
                              <span className="font-bold text-navy-950">{r.profile.fullName}</span>
                            </div>
                          </td>
                          <td className="td font-mono text-[0.75rem] font-semibold text-navy-800">
                            {r.profile.personnelId}
                          </td>
                          <td className="td text-slate-600">{r.profile.unitLabel.replace(/\s*\(Demo\)/, "")}</td>
                          <td className="td text-center">
                            <StatusBadge status={r.status} />
                          </td>
                          <td className="td text-slate-500">
                            {r.record ? r.record.updatedByName.replace(/\(.*?\)/g, "").trim() : "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <Pagination page={page} pageSize={PAGE} total={filtered.length} onPage={setPage} />
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}

// ── Monthly report ───────────────────────────────────────────

function MonthlyTab() {
  const { toast } = useToast();
  const [months, setMonths] = useState<string[]>([]);
  const [month, setMonth] = useState(todayISO().slice(0, 7));
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [report, setReport] = useState<MonthlyReport | null>(null);
  const [rows, setRows] = useState<MonthlyReport["rows"]>([]);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    getBackend()
      .coveredMonths()
      .then((m) => {
        setMonths(m);
        if (m.length) setMonth(m[0]);
      });
  }, []);

  useEffect(() => {
    const t = window.setTimeout(() => {
      setDebounced(search.trim());
      setPage(1);
    }, 300);
    return () => window.clearTimeout(t);
  }, [search]);

  const load = useCallback(async () => {
    if (!month) return;
    setLoading(true);
    try {
      const res = await getBackend().monthlyReport(month, debounced, page, 15);
      setReport(res.report);
      setRows(res.paged.rows);
      setTotal(res.paged.total);
    } catch (e) {
      toast("error", "Could not build monthly report", e instanceof Error ? e.message : undefined);
    } finally {
      setLoading(false);
    }
  }, [month, debounced, page, toast]);

  useEffect(() => {
    load();
  }, [load]);

  async function exportCSV() {
    if (!report) return;
    const rows = report.rows.map((r) => [
      r.profile.personnelId,
      r.profile.fullName,
      r.profile.unitLabel.replace(/\s*\(Demo\)/, ""),
      r.scheduledDays,
      r.presentDays,
      r.absentDays,
      r.leaveDays,
      r.unmarkedDays,
      r.attendancePct.toFixed(1) + "%",
    ]);
    downloadCSV(
      `apams-monthly-report-${month}.csv`,
      ["Personnel ID", "Full Name", "Unit", "Scheduled Days", "Present", "Absent", "Leave", "Unmarked", "Attendance %"],
      rows
    );
    await getBackend().logExport("attendance", { kind: "monthly", month, rows: rows.length, filter: debounced || null });
    toast("success", "Monthly report exported", `${rows.length.toLocaleString()} rows · export recorded in audit log.`);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <Select
            value={month}
            onChange={(e) => {
              setMonth(e.target.value);
              setPage(1);
            }}
            className="w-52"
          >
            {(months.length ? months : [month]).map((m) => (
              <option key={m} value={m}>
                {monthLabel(m)}
              </option>
            ))}
          </Select>
          {report && (
            <span className="text-xs font-semibold text-slate-500">
              {report.daysInScope} covered day(s) ·{" "}
              <span className="font-bold text-navy-800">actual records only</span>
            </span>
          )}
        </div>
        <Button variant="secondary" size="sm" icon={<Download size={14} />} onClick={exportCSV} disabled={!report}>
          Export CSV ({total.toLocaleString()})
        </Button>
      </div>

      {report && (
        <div className="card flex flex-wrap items-center gap-x-8 gap-y-2 p-4">
          <p className="text-[0.68rem] font-bold uppercase tracking-[0.12em] text-slate-400">Period totals</p>
          {(
            [
              ["Present", report.totals.present, "text-emerald-600"],
              ["Absent", report.totals.absent, "text-rose-600"],
              ["Leave", report.totals.leave, "text-amber-600"],
              ["Unmarked", report.totals.unmarked, "text-slate-500"],
            ] as const
          ).map(([l, v, c]) => (
            <span key={l} className="text-xs font-bold text-slate-500">
              {l} <span className={cn("tnums text-base font-extrabold", c)}>{v.toLocaleString("en-IN")}</span>
            </span>
          ))}
        </div>
      )}

      <div className="card overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-4 py-3">
          <p className="text-xs font-bold text-navy-950">
            Per-person attendance{" "}
            <span className="font-medium text-slate-400">({total.toLocaleString()} personnel)</span>
          </p>
          <SearchInput value={search} onChange={setSearch} placeholder="Filter by name or ID…" className="w-full sm:w-64" />
        </div>
        {loading ? (
          <PageLoader label="Building monthly report…" />
        ) : rows.length === 0 ? (
          <EmptyState title="No personnel match" body="Adjust the filter or pick another month." icon={<FileSpreadsheet size={22} />} />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[860px]">
                <thead>
                  <tr>
                    <th className="th">Personnel</th>
                    <th className="th">Unit</th>
                    <th className="th text-center">Scheduled</th>
                    <th className="th text-center">Present</th>
                    <th className="th text-center">Absent</th>
                    <th className="th text-center">Leave</th>
                    <th className="th text-center">Unmarked</th>
                    <th className="th w-44">Attendance %</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.profile.id} className="row-hover">
                      <td className="td">
                        <div className="flex items-center gap-2.5">
                          <Avatar name={r.profile.fullName} size="sm" />
                          <div>
                            <p className="font-bold text-navy-950">{r.profile.fullName}</p>
                            <p className="font-mono text-[0.68rem] text-slate-400">{r.profile.personnelId}</p>
                          </div>
                        </div>
                      </td>
                      <td className="td text-slate-600">{r.profile.unitLabel.replace(/\s*\(Demo\)/, "")}</td>
                      <td className="td tnums text-center font-semibold text-slate-500">{r.scheduledDays}</td>
                      <td className="td tnums text-center font-bold text-emerald-700">{r.presentDays}</td>
                      <td className="td tnums text-center font-bold text-rose-700">{r.absentDays}</td>
                      <td className="td tnums text-center font-bold text-amber-700">{r.leaveDays}</td>
                      <td className="td tnums text-center font-bold text-slate-500">{r.unmarkedDays}</td>
                      <td className="td">
                        <div className="flex items-center gap-2.5">
                          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100">
                            <div
                              className={cn(
                                "h-full rounded-full",
                                r.attendancePct >= 90
                                  ? "bg-emerald-500"
                                  : r.attendancePct >= 75
                                    ? "bg-amber-500"
                                    : "bg-rose-500"
                              )}
                              style={{ width: `${r.attendancePct}%` }}
                            />
                          </div>
                          <span className="tnums w-12 text-right text-xs font-extrabold text-navy-950">
                            {r.attendancePct.toFixed(1)}%
                          </span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination page={page} pageSize={15} total={total} onPage={setPage} />
          </>
        )}
      </div>
    </div>
  );
}

// ── Page shell ───────────────────────────────────────────────

export default function ReportsPage() {
  const [tab, setTab] = useState<Tab>("daily");
  return (
    <div className="space-y-5">
      <div className="rise flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-xl font-extrabold tracking-tight text-navy-950 sm:text-2xl">Reports & exports</h2>
          <p className="mt-1 text-xs font-medium text-slate-500 sm:text-sm">
            Calculated from actual records in the selected range · every export is audit-logged
          </p>
        </div>
        <div className="flex rounded-xl border border-slate-200 bg-white p-1 shadow-sm">
          {(
            [
              ["daily", "Daily report"],
              ["monthly", "Monthly report"],
            ] as const
          ).map(([k, label]) => (
            <button
              key={k}
              onClick={() => setTab(k)}
              className={cn(
                "rounded-lg px-4 py-2 text-xs font-bold transition-all",
                tab === k ? "bg-navy-800 text-white shadow-sm" : "text-slate-500 hover:text-navy-900"
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
      <div className="rise rise-1">{tab === "daily" ? <DailyTab /> : <MonthlyTab />}</div>
    </div>
  );
}
