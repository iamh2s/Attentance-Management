import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  CalendarCheck,
  CircleDashed,
  ClipboardPen,
  Download,
  MoonStar,
  RefreshCw,
  UserCheck,
  Users,
  UserX,
} from "lucide-react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { getBackend } from "@/lib/backend";
import type { DashboardStats, RecentChange, TrendPoint } from "@/lib/types";
import { STATUS_META, addDaysISO, fmtDate, pct, timeAgo, todayISO } from "@/lib/utils";
import { EmptyState, PageLoader, ProgressRing, StatusBadge, useToast } from "@/components/ui";

function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-slate-200 bg-white/95 px-3.5 py-2.5 text-xs shadow-pop backdrop-blur">
      <p className="mb-1.5 font-extrabold text-navy-950">{label}</p>
      {payload.map((p: any) => (
        <p key={p.dataKey} className="flex items-center gap-2 font-semibold text-slate-600">
          <span className="h-2 w-2 rounded-full" style={{ background: p.color || p.fill }} />
          {STATUS_META[p.dataKey as keyof typeof STATUS_META]?.plural ?? p.dataKey}:{" "}
          <span className="tnums font-extrabold text-navy-950">{p.value}</span>
        </p>
      ))}
    </div>
  );
}

export default function AdminDashboard() {
  const { toast } = useToast();
  const [date, setDate] = useState(todayISO());
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [trendDays, setTrendDays] = useState(14);
  const [trend, setTrend] = useState<TrendPoint[]>([]);
  const [recent, setRecent] = useState<RecentChange[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const backend = useMemo(() => getBackend(), []);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    Promise.all([backend.getDashboardStats(date), backend.getTrend(trendDays), backend.getRecentChanges(8)])
      .then(([s, t, r]) => {
        if (!alive) return;
        setStats(s);
        setTrend(t);
        setRecent(r);
      })
      .catch((e) => toast("error", "Could not load dashboard", e instanceof Error ? e.message : undefined))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date, trendDays]);

  async function refresh() {
    setRefreshing(true);
    try {
      const [s, t, r] = await Promise.all([
        backend.getDashboardStats(date),
        backend.getTrend(trendDays),
        backend.getRecentChanges(8),
      ]);
      setStats(s);
      setTrend(t);
      setRecent(r);
      toast("success", "Dashboard refreshed");
    } finally {
      setRefreshing(false);
    }
  }

  const donut = stats
    ? [
        { name: "Present", key: "present", value: stats.present },
        { name: "Absent", key: "absent", value: stats.absent },
        { name: "Approved Leave", key: "approved_leave", value: stats.approvedLeave },
        { name: "Not Marked", key: "not_marked", value: stats.notMarked },
      ]
    : [];

  if (loading && !stats) return <PageLoader label="Loading dashboard…" />;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="rise flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-xl font-extrabold tracking-tight text-navy-950 sm:text-2xl">Attendance overview</h2>
          <p className="mt-1 text-xs font-medium text-slate-500 sm:text-sm">
            All figures are computed live from attendance records for{" "}
            <span className="font-bold text-navy-800">{fmtDate(date)}</span>
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="date"
            className="input h-9.5 w-auto text-sm"
            value={date}
            max={todayISO()}
            min={addDaysISO(todayISO(), -365)}
            onChange={(e) => e.target.value && setDate(e.target.value)}
          />
          <button
            onClick={refresh}
            className="inline-flex h-9.5 w-9.5 items-center justify-center rounded-lg border border-slate-300 bg-white text-navy-800 shadow-sm transition-colors hover:border-navy-400"
            title="Refresh"
          >
            <RefreshCw size={15} className={refreshing ? "animate-spin" : ""} />
          </button>
          <Link to="/attendance">
            <span className="inline-flex h-9.5 items-center gap-2 rounded-lg bg-navy-800 px-4 text-sm font-bold text-white shadow-sm transition-colors hover:bg-navy-700">
              <ClipboardPen size={15} /> Mark attendance
            </span>
          </Link>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-3.5 sm:grid-cols-3 xl:grid-cols-5">
        {[
          {
            label: "Total Personnel",
            value: stats?.totalActive ?? "—",
            sub: "Active accounts",
            icon: <Users size={19} />,
            accent: "linear-gradient(135deg,#255184,#16305b)",
          },
          {
            label: "Present",
            value: stats?.present ?? "—",
            sub: stats ? `${pct(stats.present, stats.totalActive)}% of active` : "",
            icon: <UserCheck size={19} />,
            accent: "linear-gradient(135deg,#10b981,#047857)",
          },
          {
            label: "Absent",
            value: stats?.absent ?? "—",
            sub: stats ? `${pct(stats.absent, stats.totalActive)}% of active` : "",
            icon: <UserX size={19} />,
            accent: "linear-gradient(135deg,#f43f5e,#be123c)",
          },
          {
            label: "On Leave",
            value: stats?.approvedLeave ?? "—",
            sub: "Approved leave",
            icon: <MoonStar size={19} />,
            accent: "linear-gradient(135deg,#f59e0b,#b45309)",
          },
          {
            label: "Not Marked",
            value: stats?.notMarked ?? "—",
            sub: stats?.notMarked ? "Action required" : "All marked",
            icon: <CircleDashed size={19} />,
            accent: "linear-gradient(135deg,#64748b,#334155)",
          },
        ].map((c, i) => (
          <div key={c.label} className={`rise rise-${Math.min(i + 1, 4)}`}>
            <div className="card flex h-full items-center gap-3.5 p-4 sm:p-5">
              <span
                className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-white shadow-sm sm:h-11 sm:w-11"
                style={{ background: c.accent }}
              >
                {c.icon}
              </span>
              <div className="min-w-0">
                <p className="text-[0.66rem] font-bold uppercase tracking-[0.09em] text-slate-500 sm:text-[0.7rem]">
                  {c.label}
                </p>
                <p className="tnums mt-0.5 text-xl font-extrabold leading-none text-navy-950 sm:text-2xl">
                  {typeof c.value === "number" ? c.value.toLocaleString("en-IN") : c.value}
                </p>
                <p className="mt-1 truncate text-[0.68rem] font-medium text-slate-500">{c.sub}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 gap-3.5 lg:grid-cols-3">
        <div className="card rise rise-2 p-5 lg:col-span-2">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-[0.95rem] font-bold text-navy-950">Attendance trend</h3>
              <p className="text-xs text-slate-500">Daily status distribution across active personnel</p>
            </div>
            <div className="flex rounded-lg bg-slate-100 p-0.5">
              {[7, 14, 30].map((d) => (
                <button
                  key={d}
                  onClick={() => setTrendDays(d)}
                  className={`rounded-md px-3 py-1 text-xs font-bold transition-colors ${
                    trendDays === d ? "bg-white text-navy-900 shadow-sm" : "text-slate-500 hover:text-navy-800"
                  }`}
                >
                  {d}d
                </button>
              ))}
            </div>
          </div>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trend} margin={{ top: 4, right: 6, bottom: 0, left: -14 }}>
                <defs>
                  <linearGradient id="gP" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#0e9f6e" stopOpacity={0.5} />
                    <stop offset="100%" stopColor="#0e9f6e" stopOpacity={0.04} />
                  </linearGradient>
                  <linearGradient id="gA" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#e02424" stopOpacity={0.4} />
                    <stop offset="100%" stopColor="#e02424" stopOpacity={0.03} />
                  </linearGradient>
                  <linearGradient id="gL" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#d98e04" stopOpacity={0.4} />
                    <stop offset="100%" stopColor="#d98e04" stopOpacity={0.03} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e6ecf4" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 10.5, fill: "#71809a" }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 10.5, fill: "#71809a" }} tickLine={false} axisLine={false} />
                <Tooltip content={<ChartTooltip />} />
                <Area type="monotone" dataKey="present" stroke="#0e9f6e" strokeWidth={2.2} fill="url(#gP)" name="Present" />
                <Area type="monotone" dataKey="absent" stroke="#e02424" strokeWidth={1.8} fill="url(#gA)" name="Absent" />
                <Area
                  type="monotone"
                  dataKey="approved_leave"
                  stroke="#d98e04"
                  strokeWidth={1.8}
                  fill="url(#gL)"
                  name="Approved leave"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-4 border-t border-slate-100 pt-3">
            {(["present", "absent", "approved_leave"] as const).map((k) => (
              <span key={k} className="flex items-center gap-1.5 text-[0.7rem] font-bold text-slate-500">
                <span className="h-2 w-2 rounded-full" style={{ background: STATUS_META[k].hex }} />
                {STATUS_META[k].plural}
              </span>
            ))}
          </div>
        </div>

        {/* Percentage + donut */}
        <div className="card rise rise-3 flex flex-col p-5">
          <h3 className="text-[0.95rem] font-bold text-navy-950">Attendance rate</h3>
          <p className="text-xs text-slate-500">Present ÷ (Present + Absent) for {fmtDate(date)}</p>
          <div className="flex flex-1 items-center justify-around gap-2 py-4">
            <ProgressRing value={stats?.attendancePct ?? 0} label="Rate" />
            <div className="relative h-28 w-28">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={donut} dataKey="value" innerRadius={30} outerRadius={52} paddingAngle={2} strokeWidth={0}>
                    {donut.map((d) => (
                      <Cell key={d.key} fill={STATUS_META[d.key as keyof typeof STATUS_META].hex} />
                    ))}
                  </Pie>
                  <Tooltip content={<ChartTooltip />} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
          <div className="space-y-1.5 border-t border-slate-100 pt-3">
            {donut.map((d) => (
              <div key={d.key} className="flex items-center gap-2 text-xs">
                <span
                  className="h-2 w-2 rounded-full"
                  style={{ background: STATUS_META[d.key as keyof typeof STATUS_META].hex }}
                />
                <span className="flex-1 font-semibold text-slate-600">{STATUS_META[d.key as keyof typeof STATUS_META].plural}</span>
                <span className="tnums font-extrabold text-navy-950">{d.value.toLocaleString("en-IN")}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Recent changes */}
      <div className="card rise rise-4 overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
          <div>
            <h3 className="text-[0.95rem] font-bold text-navy-950">Recent attendance changes</h3>
            <p className="text-xs text-slate-500">Latest records created or corrected by administrators</p>
          </div>
          <div className="flex items-center gap-2">
            <Link
              to="/reports"
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-bold text-navy-800 shadow-sm transition-colors hover:border-navy-400"
            >
              <Download size={13} /> Reports
            </Link>
            <Link to="/attendance" className="inline-flex items-center gap-1 text-xs font-bold text-navy-700 hover:text-navy-500">
              Open marking sheet <ArrowRight size={13} />
            </Link>
          </div>
        </div>
        {recent.length === 0 ? (
          <EmptyState title="No attendance changes yet" body="Marked records will appear here." icon={<CalendarCheck size={22} />} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px]">
              <thead>
                <tr>
                  <th className="th">Personnel</th>
                  <th className="th">Date</th>
                  <th className="th text-center">Status</th>
                  <th className="th">Modified by</th>
                  <th className="th">When</th>
                  <th className="th">Note</th>
                </tr>
              </thead>
              <tbody>
                {recent.map((r) => (
                  <tr key={r.id} className="row-hover">
                    <td className="td">
                      <p className="font-bold text-navy-950">{r.personnelName}</p>
                      <p className="font-mono text-[0.68rem] text-slate-400">{r.personnelCode}</p>
                    </td>
                    <td className="td whitespace-nowrap font-semibold text-slate-600">{fmtDate(r.date)}</td>
                    <td className="td text-center">
                      <StatusBadge status={r.status} />
                    </td>
                    <td className="td text-slate-600">{r.updatedByName.replace(/\(.*?\)/g, "").trim()}</td>
                    <td className="td whitespace-nowrap text-slate-500">{timeAgo(r.updatedAt)}</td>
                    <td className="td max-w-56">
                      {r.correctionReason ? (
                        <span className="line-clamp-1 text-xs font-medium text-amber-700" title={r.correctionReason}>
                          Corrected: {r.correctionReason}
                        </span>
                      ) : (
                        <span className="text-xs text-slate-400">Initial marking</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
