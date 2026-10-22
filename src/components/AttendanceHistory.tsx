import { useCallback, useEffect, useMemo, useState } from "react";
import { CalendarDays, CircleDashed, MoonStar, TrendingUp, UserCheck, UserX } from "lucide-react";
import { getBackend, type PersonMonthSummary } from "@/lib/backend";
import type { AttendanceRecord, MarkStatus } from "@/lib/types";
import { fmtDate, fmtDateTime, fmtWeekday, monthLabel, todayISO } from "@/lib/utils";
import { EmptyState, PageLoader, Select, StatusBadge } from "@/components/ui";
import { cn } from "@/utils/cn";

const CELL: Record<MarkStatus, string> = {
  present: "bg-emerald-500 text-white",
  absent: "bg-rose-500 text-white",
  approved_leave: "bg-amber-400 text-white",
  not_marked: "bg-slate-100 text-slate-300",
};

export default function AttendanceHistory({ personnelId }: { personnelId: string }) {
  const [months, setMonths] = useState<string[]>([]);
  const [month, setMonth] = useState<string>(todayISO().slice(0, 7));
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [summary, setSummary] = useState<PersonMonthSummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getBackend()
      .coveredMonths()
      .then((m) => {
        setMonths(m);
        if (m.length && !m.includes(month)) setMonth(m[0]);
      })
      .catch(() => setMonths([month]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getBackend().getPersonMonth(personnelId, month);
      setRecords(res.records);
      setSummary(res.summary);
    } catch {
      setRecords([]);
      setSummary(null);
    } finally {
      setLoading(false);
    }
  }, [personnelId, month]);

  useEffect(() => {
    load();
  }, [load]);

  const byDate = useMemo(() => new Map(records.map((r) => [r.date, r])), [records]);

  const calendar = useMemo(() => {
    const [y, m] = month.split("-").map(Number);
    const dim = new Date(y, m, 0).getDate();
    const firstDow = (new Date(y, m - 1, 1).getDay() + 6) % 7; // Monday-first
    const cells: Array<{ day: number; iso: string } | null> = [];
    for (let i = 0; i < firstDow; i++) cells.push(null);
    for (let d = 1; d <= dim; d++) cells.push({ day: d, iso: `${month}-${String(d).padStart(2, "0")}` });
    return cells;
  }, [month]);

  const today = todayISO();

  const chips = summary
    ? [
        { label: "Present", value: summary.present, icon: <UserCheck size={14} />, cls: "text-emerald-600 bg-emerald-50" },
        { label: "Absent", value: summary.absent, icon: <UserX size={14} />, cls: "text-rose-600 bg-rose-50" },
        { label: "Leave", value: summary.leave, icon: <MoonStar size={14} />, cls: "text-amber-600 bg-amber-50" },
        {
          label: "Not marked",
          value: summary.notMarked,
          icon: <CircleDashed size={14} />,
          cls: "text-slate-500 bg-slate-100",
        },
        {
          label: "Attend. rate",
          value: `${summary.pct.toFixed(1)}%`,
          icon: <TrendingUp size={14} />,
          cls: "text-navy-700 bg-navy-50",
        },
      ]
    : [];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          {chips.map((c) => (
            <span
              key={c.label}
              className={cn("inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-bold", c.cls)}
            >
              {c.icon}
              {c.label}
              <span className="tnums font-extrabold">{c.value}</span>
            </span>
          ))}
        </div>
        <Select value={month} onChange={(e) => setMonth(e.target.value)} className="w-48">
          {(months.length ? months : [month]).map((m) => (
            <option key={m} value={m}>
              {monthLabel(m)}
            </option>
          ))}
        </Select>
      </div>

      {loading ? (
        <PageLoader label="Loading attendance history…" />
      ) : !summary || summary.scheduled === 0 ? (
        <EmptyState
          title="No data coverage for this month"
          body="The demo dataset covers the most recent 60 days."
          icon={<CalendarDays size={22} />}
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(300px,380px)_1fr]">
          {/* Calendar */}
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <p className="mb-3 text-center text-xs font-extrabold uppercase tracking-[0.12em] text-navy-900">
              {monthLabel(month)}
            </p>
            <div className="grid grid-cols-7 gap-1 text-center text-[0.6rem] font-bold uppercase tracking-wide text-slate-400">
              {["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"].map((d) => (
                <span key={d} className="py-1">
                  {d}
                </span>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-1">
              {calendar.map((cell, i) =>
                cell === null ? (
                  <span key={`x${i}`} />
                ) : (
                  <span
                    key={cell.iso}
                    title={
                      cell.iso > today
                        ? "Upcoming"
                        : `${fmtDate(cell.iso)} — ${byDate.get(cell.iso)?.status === "approved_leave" ? "Approved Leave" : byDate.get(cell.iso)?.status ?? "Not Marked"}`
                    }
                    className={cn(
                      "flex aspect-square items-center justify-center rounded-md text-[0.68rem] font-bold",
                      cell.iso > today ? "bg-white text-slate-300" : CELL[byDate.get(cell.iso)?.status ?? "not_marked"],
                      cell.iso === today && "ring-2 ring-navy-700 ring-offset-1"
                    )}
                  >
                    {cell.day}
                  </span>
                )
              )}
            </div>
            <div className="mt-3 flex flex-wrap gap-3 border-t border-slate-100 pt-3">
              {(
                [
                  ["Present", "bg-emerald-500"],
                  ["Absent", "bg-rose-500"],
                  ["Leave", "bg-amber-400"],
                  ["Not marked", "bg-slate-200"],
                ] as const
              ).map(([l, c]) => (
                <span key={l} className="flex items-center gap-1.5 text-[0.65rem] font-bold text-slate-500">
                  <span className={cn("h-2.5 w-2.5 rounded", c)} /> {l}
                </span>
              ))}
            </div>
          </div>

          {/* Records table */}
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
            <div className="max-h-[420px] overflow-y-auto">
              <table className="w-full min-w-[520px]">
                <thead className="sticky top-0 z-10">
                  <tr>
                    <th className="th">Date</th>
                    <th className="th text-center">Status</th>
                    <th className="th">Updated by</th>
                    <th className="th">Note</th>
                  </tr>
                </thead>
                <tbody>
                  {[...byDate.entries()]
                    .sort((a, b) => b[0].localeCompare(a[0]))
                    .map(([iso, rec]) => (
                      <tr key={iso} className="row-hover">
                        <td className="td whitespace-nowrap font-semibold text-navy-950">
                          {fmtDate(iso)}
                          <span className="ml-2 text-[0.68rem] font-medium text-slate-400">{fmtWeekday(iso)}</span>
                        </td>
                        <td className="td text-center">
                          <StatusBadge status={rec.status} />
                        </td>
                        <td className="td text-slate-600" title={fmtDateTime(rec.updatedAt)}>
                          {rec.updatedByName.replace(/\(.*?\)/g, "").trim()}
                        </td>
                        <td className="td max-w-44">
                          {rec.correctionReason ? (
                            <span className="line-clamp-1 text-xs text-amber-700" title={rec.correctionReason}>
                              {rec.correctionReason}
                            </span>
                          ) : (
                            <span className="text-xs text-slate-400">—</span>
                          )}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
              {byDate.size === 0 && (
                <EmptyState title="No records this month" body="No attendance has been marked yet." icon={<CalendarDays size={22} />} />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
