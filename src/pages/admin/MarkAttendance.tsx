import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  ClipboardCheck,
  MoonStar,
  RotateCcw,
  Save,
  ShieldAlert,
  Users,
  X,
} from "lucide-react";
import { getBackend } from "@/lib/backend";
import type { AttendanceStatus, MarkStatus, SaveEntry, SheetRow } from "@/lib/types";
import { addDaysISO, fmtDate, fmtWeekday, timeAgo, todayISO } from "@/lib/utils";
import {
  Avatar,
  Badge,
  Button,
  ConfirmDialog,
  EmptyState,
  Modal,
  PageLoader,
  Pagination,
  SearchInput,
  StatusBadge,
  useToast,
} from "@/components/ui";
import { cn } from "@/utils/cn";

const PAGE_SIZE = 50;

const STATUS_DEFS: Array<{ key: AttendanceStatus; label: string; short: string; icon: React.ReactNode; cls: string; onCls: string }> = [
  {
    key: "present",
    label: "Present",
    short: "P",
    icon: <Check size={13} />,
    cls: "text-emerald-700 hover:bg-emerald-50",
    onCls: "bg-emerald-600 text-white shadow-sm",
  },
  {
    key: "absent",
    label: "Absent",
    short: "A",
    icon: <X size={13} />,
    cls: "text-rose-700 hover:bg-rose-50",
    onCls: "bg-rose-600 text-white shadow-sm",
  },
  {
    key: "approved_leave",
    label: "Leave",
    short: "L",
    icon: <MoonStar size={13} />,
    cls: "text-amber-700 hover:bg-amber-50",
    onCls: "bg-amber-500 text-white shadow-sm",
  },
];

export default function MarkAttendance() {
  const { toast } = useToast();
  const today = todayISO();
  const minDate = addDaysISO(today, -365);

  const [date, setDate] = useState(today);
  const [sheet, setSheet] = useState<SheetRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState<Record<string, AttendanceStatus>>({});
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  const [bulk, setBulk] = useState<AttendanceStatus | null>(null);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setSheet(await getBackend().getAttendanceSheet(date));
    } catch (e) {
      toast("error", "Could not load the attendance sheet", e instanceof Error ? e.message : undefined);
    } finally {
      setLoading(false);
    }
  }, [date, toast]);

  useEffect(() => {
    load();
    setDraft({});
    setPage(1);
    setSearch("");
  }, [load]);

  const effective = useCallback(
    (row: SheetRow): MarkStatus => draft[row.profile.id] ?? row.record?.status ?? "not_marked",
    [draft]
  );

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    if (!s) return sheet;
    return sheet.filter(
      (r) =>
        r.profile.fullName.toLowerCase().includes(s) ||
        r.profile.personnelId.toLowerCase().includes(s) ||
        r.profile.unitLabel.toLowerCase().includes(s)
    );
  }, [sheet, search]);

  const pageRows = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const counts = useMemo(() => {
    const c = { present: 0, absent: 0, approved_leave: 0, not_marked: 0 };
    for (const r of sheet) c[effective(r)]++;
    return c;
  }, [sheet, effective]);

  const pending = useMemo(
    () =>
      sheet
        .filter((r) => {
          const d = draft[r.profile.id];
          return d !== undefined && d !== r.record?.status;
        })
        .map((r) => ({ row: r, status: draft[r.profile.id] as AttendanceStatus })),
    [sheet, draft]
  );

  const corrections = pending.filter((p) => p.row.record !== null);
  const newMarks = pending.filter((p) => p.row.record === null);

  const unmarkedFiltered = useMemo(
    () => filtered.filter((r) => effective(r) === "not_marked"),
    [filtered, effective]
  );

  function applyBulk(status: AttendanceStatus) {
    setBulk(null);
    if (!unmarkedFiltered.length) return;
    setDraft((prev) => {
      const next = { ...prev };
      for (const r of unmarkedFiltered) next[r.profile.id] = status;
      return next;
    });
    toast(
      "info",
      `${unmarkedFiltered.length.toLocaleString()} unmarked personnel set to “${status === "approved_leave" ? "Approved Leave" : status === "present" ? "Present" : "Absent"}”`,
      "Review the entries below, then save. Nothing is written to the database yet."
    );
  }

  function setOne(profileId: string, status: AttendanceStatus) {
    setDraft((prev) => ({ ...prev, [profileId]: status }));
  }

  function resetDrafts() {
    setDraft({});
    toast("info", "Pending changes discarded");
  }

  async function confirmSave() {
    setSaving(true);
    try {
      const entries: SaveEntry[] = pending.map((p) => ({
        profileId: p.row.profile.id,
        date,
        status: p.status,
        correctionReason: p.row.record ? reason.trim() : null,
      }));
      const res = await getBackend().saveAttendance(entries);
      toast(
        "success",
        "Attendance saved",
        `${res.created.toLocaleString()} new record(s) · ${res.corrected.toLocaleString()} correction(s) — all audit-logged.`
      );
      setReviewOpen(false);
      setReason("");
      setDraft({});
      await load();
    } catch (e) {
      toast("error", "Save failed", e instanceof Error ? e.message : undefined);
    } finally {
      setSaving(false);
    }
  }

  const markedPct = sheet.length ? Math.round(((sheet.length - counts.not_marked) / sheet.length) * 100) : 0;

  return (
    <div className="space-y-5 pb-24">
      {/* Header */}
      <div className="rise flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-xl font-extrabold tracking-tight text-navy-950 sm:text-2xl">Mark attendance</h2>
          <p className="mt-1 text-xs font-medium text-slate-500 sm:text-sm">
            One record per person per date — duplicates are rejected by a database constraint
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            className="inline-flex h-9.5 w-9.5 items-center justify-center rounded-lg border border-slate-300 bg-white text-navy-800 shadow-sm transition-colors hover:border-navy-400 disabled:opacity-40"
            onClick={() => setDate(addDaysISO(date, -1))}
            disabled={date <= minDate}
            aria-label="Previous day"
          >
            <ArrowLeft size={15} />
          </button>
          <div className="text-center">
            <input
              type="date"
              className="input h-9.5 w-auto text-center text-sm font-bold"
              value={date}
              min={minDate}
              max={today}
              onChange={(e) => e.target.value && setDate(e.target.value)}
            />
            <p className="mt-0.5 text-[0.65rem] font-bold uppercase tracking-wider text-slate-400">
              {fmtWeekday(date)}, {fmtDate(date)}
            </p>
          </div>
          <button
            className="inline-flex h-9.5 w-9.5 items-center justify-center rounded-lg border border-slate-300 bg-white text-navy-800 shadow-sm transition-colors hover:border-navy-400 disabled:opacity-40"
            onClick={() => setDate(addDaysISO(date, 1))}
            disabled={date >= today}
            aria-label="Next day"
          >
            <ArrowRight size={15} />
          </button>
        </div>
      </div>

      {/* Progress + bulk actions */}
      <div className="card rise rise-1 space-y-4 p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="min-w-52 flex-1">
            <div className="flex items-center justify-between text-xs font-bold">
              <span className="text-navy-900">
                {(sheet.length - counts.not_marked).toLocaleString()} of {sheet.length.toLocaleString()} marked
              </span>
              <span className="tnums text-slate-500">{markedPct}%</span>
            </div>
            <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full rounded-full bg-gradient-to-r from-navy-600 to-emerald-500 transition-all duration-500"
                style={{ width: `${markedPct}%` }}
              />
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[0.68rem] font-bold uppercase tracking-wider text-slate-400">
              Bulk-set {unmarkedFiltered.length.toLocaleString()} unmarked:
            </span>
            {STATUS_DEFS.map((s) => (
              <Button key={s.key} size="sm" variant="secondary" icon={s.icon} onClick={() => setBulk(s.key)}>
                {s.label}
              </Button>
            ))}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3.5">
          {(["present", "absent", "approved_leave", "not_marked"] as const).map((k) => (
            <span
              key={k}
              className="inline-flex items-center gap-1.5 rounded-lg bg-slate-50 px-2.5 py-1.5 text-xs font-bold text-slate-600 ring-1 ring-inset ring-slate-200"
            >
              <span
                className={cn(
                  "h-2 w-2 rounded-full",
                  k === "present"
                    ? "bg-emerald-500"
                    : k === "absent"
                      ? "bg-rose-500"
                      : k === "approved_leave"
                        ? "bg-amber-500"
                        : "bg-slate-400"
                )}
              />
              {k === "present" ? "Present" : k === "absent" ? "Absent" : k === "approved_leave" ? "On Leave" : "Not Marked"}
              <span className="tnums ml-0.5 font-extrabold text-navy-950">{counts[k].toLocaleString()}</span>
            </span>
          ))}
          <div className="ml-auto w-full sm:w-72">
            <SearchInput
              value={search}
              onChange={(v) => {
                setSearch(v);
                setPage(1);
              }}
              placeholder="Filter by name, ID or unit…"
            />
          </div>
        </div>
      </div>

      {/* Sheet table */}
      <div className="card rise rise-2 overflow-hidden">
        {loading ? (
          <PageLoader label="Loading attendance sheet…" />
        ) : filtered.length === 0 ? (
          <EmptyState
            title="No personnel match this filter"
            body="Clear the search to see the full active roster."
            icon={<Users size={22} />}
          />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[860px]">
                <thead>
                  <tr>
                    <th className="th w-10 text-center">#</th>
                    <th className="th">Personnel</th>
                    <th className="th">Unit</th>
                    <th className="th text-center">Saved status</th>
                    <th className="th text-center">Mark</th>
                    <th className="th">Last modified</th>
                  </tr>
                </thead>
                <tbody>
                  {pageRows.map((row, i) => {
                    const st = effective(row);
                    const isPending = draft[row.profile.id] !== undefined && draft[row.profile.id] !== row.record?.status;
                    return (
                      <tr key={row.profile.id} className={cn("row-hover", isPending && "bg-navy-50/60")}>
                        <td className="td tnums text-center text-xs text-slate-400">{(page - 1) * PAGE_SIZE + i + 1}</td>
                        <td className="td">
                          <div className="flex items-center gap-3">
                            <Avatar name={row.profile.fullName} size="sm" />
                            <div>
                              <p className="font-bold text-navy-950">
                                {row.profile.fullName}
                                {isPending && (
                                  <span className="ml-2 inline-flex items-center rounded-full bg-navy-700 px-1.5 py-px text-[0.6rem] font-bold uppercase tracking-wide text-white">
                                    pending
                                  </span>
                                )}
                              </p>
                              <p className="font-mono text-[0.68rem] text-slate-400">{row.profile.personnelId}</p>
                            </div>
                          </div>
                        </td>
                        <td className="td text-slate-600">{row.profile.unitLabel.replace(/\s*\(Demo\)/, "")}</td>
                        <td className="td text-center">
                          <StatusBadge status={st} />
                        </td>
                        <td className="td text-center">
                          <div className="inline-flex rounded-lg border border-slate-200 bg-white p-0.5">
                            {STATUS_DEFS.map((s) => (
                              <button
                                key={s.key}
                                onClick={() => setOne(row.profile.id, s.key)}
                                title={s.label}
                                className={cn(
                                  "inline-flex h-7 w-8 items-center justify-center rounded-md text-xs font-extrabold transition-all",
                                  st === s.key ? s.onCls : s.cls
                                )}
                              >
                                {s.short}
                              </button>
                            ))}
                          </div>
                        </td>
                        <td className="td max-w-56">
                          {row.record ? (
                            <div className="text-[0.7rem] leading-snug text-slate-500">
                              <span className="font-semibold text-navy-800">
                                {row.record.updatedByName.replace(/\(.*?\)/g, "").trim()}
                              </span>{" "}
                              · {timeAgo(row.record.updatedAt)}
                              {row.record.correctionReason && (
                                <span className="block truncate text-amber-700" title={row.record.correctionReason}>
                                  “{row.record.correctionReason}”
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="text-[0.7rem] text-slate-400">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <Pagination page={page} pageSize={PAGE_SIZE} total={filtered.length} onPage={setPage} />
          </>
        )}
      </div>

      {/* Bulk confirm */}
      <ConfirmDialog
        open={bulk !== null}
        onClose={() => setBulk(null)}
        onConfirm={() => bulk && applyBulk(bulk)}
        title="Confirm bulk update"
        confirmLabel="Apply to sheet"
        body={
          <span>
            This will stage <strong>{unmarkedFiltered.length.toLocaleString()}</strong> currently{" "}
            <strong>unmarked</strong>
            {search.trim() ? " (filtered)" : ""} personnel as{" "}
            <strong>{bulk === "approved_leave" ? "Approved Leave" : bulk === "present" ? "Present" : "Absent"}</strong>{" "}
            for <strong>{fmtDate(date)}</strong>. Entries are only written when you review and save — already-marked
            records are never overwritten silently.
          </span>
        }
      />

      {/* Review modal */}
      <Modal
        open={reviewOpen}
        onClose={() => setReviewOpen(false)}
        title="Review before saving"
        subtitle={`${fmtDate(date)} · ${pending.length.toLocaleString()} pending change(s)`}
        wide
        footer={
          <>
            <Button variant="secondary" onClick={() => setReviewOpen(false)}>
              Back to sheet
            </Button>
            <Button
              icon={<Save size={15} />}
              loading={saving}
              disabled={corrections.length > 0 && !reason.trim()}
              onClick={confirmSave}
            >
              Save {pending.length.toLocaleString()} change(s)
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <div className="rounded-xl bg-emerald-50 p-3.5 ring-1 ring-inset ring-emerald-600/15">
              <p className="text-[0.65rem] font-bold uppercase tracking-wider text-emerald-700">New markings</p>
              <p className="tnums mt-1 text-xl font-extrabold text-emerald-800">{newMarks.length.toLocaleString()}</p>
            </div>
            <div className="rounded-xl bg-amber-50 p-3.5 ring-1 ring-inset ring-amber-600/20">
              <p className="text-[0.65rem] font-bold uppercase tracking-wider text-amber-700">Corrections</p>
              <p className="tnums mt-1 text-xl font-extrabold text-amber-800">{corrections.length.toLocaleString()}</p>
            </div>
            <div className="rounded-xl bg-slate-50 p-3.5 ring-1 ring-inset ring-slate-300">
              <p className="text-[0.65rem] font-bold uppercase tracking-wider text-slate-500">Unchanged</p>
              <p className="tnums mt-1 text-xl font-extrabold text-navy-950">
                {(sheet.length - pending.length).toLocaleString()}
              </p>
            </div>
          </div>

          {pending.length > 0 && pending.length <= 14 ? (
            <div className="max-h-56 overflow-y-auto rounded-xl border border-slate-200">
              <table className="w-full">
                <thead>
                  <tr>
                    <th className="th">Personnel</th>
                    <th className="th text-center">From</th>
                    <th className="th text-center">To</th>
                  </tr>
                </thead>
                <tbody>
                  {pending.map((p) => (
                    <tr key={p.row.profile.id}>
                      <td className="td font-semibold text-navy-950">
                        {p.row.profile.fullName}
                        <span className="ml-2 font-mono text-[0.65rem] text-slate-400">{p.row.profile.personnelId}</span>
                      </td>
                      <td className="td text-center">
                        <StatusBadge status={p.row.record?.status ?? "not_marked"} />
                      </td>
                      <td className="td text-center">
                        <StatusBadge status={p.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="rounded-lg bg-slate-50 px-3.5 py-2.5 text-xs leading-relaxed text-slate-500">
              Large batch — {pending.length.toLocaleString()} entries will be written in a single transactional
              operation. Breakdown:{" "}
              {(["present", "absent", "approved_leave"] as const)
                .map((k) => `${pending.filter((p) => p.status === k).length.toLocaleString()} ${k === "approved_leave" ? "leave" : k}`)
                .join(" · ")}
              .
            </p>
          )}

          {corrections.length > 0 && (
            <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-4">
              <p className="flex items-center gap-2 text-xs font-bold text-amber-800">
                <ShieldAlert size={14} />
                {corrections.length} existing record(s) will be corrected — a reason is mandatory
              </p>
              <textarea
                className="input mt-2.5 min-h-20 resize-y bg-white"
                placeholder="e.g. Status corrected after duty roster verification"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
              <p className="mt-1.5 text-[0.68rem] text-amber-800">
                The previous value, new value, actor and this reason are written to the audit log for each corrected
                record.
              </p>
            </div>
          )}
        </div>
      </Modal>

      {/* Sticky action bar */}
      {pending.length > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-40 lg:left-64">
          <div className="mx-auto max-w-[1400px] px-4 pb-4 sm:px-6">
            <div className="rise flex flex-wrap items-center gap-3 rounded-2xl border border-navy-900/30 bg-navy-950/95 px-4 py-3 shadow-pop backdrop-blur">
              <span className="inline-flex items-center gap-2 text-sm font-bold text-white">
                <ClipboardCheck size={16} className="text-emerald-400" />
                {pending.length.toLocaleString()} pending change(s)
                {corrections.length > 0 && (
                  <Badge tone="amber" className="ml-1">
                    {corrections.length} correction(s)
                  </Badge>
                )}
              </span>
              <div className="ml-auto flex items-center gap-2">
                <button
                  className="inline-flex h-9 items-center gap-1.5 rounded-lg px-3 text-xs font-bold text-navy-200 transition-colors hover:bg-white/10 hover:text-white"
                  onClick={resetDrafts}
                >
                  <RotateCcw size={13} /> Discard
                </button>
                <Button icon={<Save size={15} />} onClick={() => setReviewOpen(true)}>
                  Review & save
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
