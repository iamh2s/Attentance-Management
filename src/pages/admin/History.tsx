import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { History as HistoryIcon, Search, UserRound, X } from "lucide-react";
import { getBackend } from "@/lib/backend";
import type { Profile } from "@/lib/types";
import AttendanceHistory from "@/components/AttendanceHistory";
import { Avatar, Badge, Button, EmptyState, Input } from "@/components/ui";


export default function AdminHistoryPage() {
  const [params, setParams] = useSearchParams();
  const [selected, setSelected] = useState<Profile | null>(null);
  const [search, setSearch] = useState("");
  const [matches, setMatches] = useState<Profile[]>([]);
  const [searching, setSearching] = useState(false);
  const [loadingSelected, setLoadingSelected] = useState(false);

  // Deep-link support: /history?personnel=<id> — the directory links here.
  useEffect(() => {
    const id = params.get("personnel");
    if (!id) return;
    setLoadingSelected(true);
    getBackend()
      .listPersonnel({ search: "", status: "all", page: 1, pageSize: 1000 })
      .then((res) => {
        const found = res.rows.find((p) => p.id === id) ?? null;
        if (found) setSelected(found);
      })
      .finally(() => setLoadingSelected(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const q = search.trim();
    if (q.length < 2) {
      setMatches([]);
      return;
    }
    setSearching(true);
    const t = window.setTimeout(async () => {
      const res = await getBackend().listPersonnel({ search: q, status: "all", page: 1, pageSize: 8 });
      setMatches(res.rows);
      setSearching(false);
    }, 250);
    return () => window.clearTimeout(t);
  }, [search]);

  return (
    <div className="space-y-5">
      <div className="rise flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-xl font-extrabold tracking-tight text-navy-950 sm:text-2xl">Attendance history</h2>
          <p className="mt-1 text-xs font-medium text-slate-500 sm:text-sm">
            Look up any personnel record — read-only, audit-friendly view
          </p>
        </div>
        {selected && (
          <Button variant="secondary" size="sm" icon={<X size={14} />} onClick={() => { setSelected(null); setParams({}); }}>
            Clear selection
          </Button>
        )}
      </div>

      {!selected && (
        <div className="card rise rise-1 p-5">
          <label className="block">
            <span className="mb-1.5 block text-[0.8rem] font-semibold text-navy-900">
              Search personnel by name or ID
            </span>
            <div className="relative">
              <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Type at least 2 characters…"
                className="pl-9"
              />
            </div>
          </label>

          {searching && <p className="mt-3 text-xs font-semibold text-slate-400">Searching…</p>}
          {matches.length > 0 && (
            <div className="mt-3 overflow-hidden rounded-xl border border-slate-200">
              {matches.map((p) => (
                <button
                  key={p.id}
                  className="flex w-full items-center gap-3 border-b border-slate-100 px-4 py-2.5 text-left transition-colors last:border-0 hover:bg-navy-50/60"
                  onClick={() => {
                    setSelected(p);
                    setMatches([]);
                    setSearch("");
                  }}
                >
                  <Avatar name={p.fullName} size="sm" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-bold text-navy-950">{p.fullName}</span>
                    <span className="block font-mono text-[0.68rem] text-slate-400">{p.personnelId}</span>
                  </span>
                  {p.isActive ? <Badge tone="green">Active</Badge> : <Badge tone="red">Inactive</Badge>}
                </button>
              ))}
            </div>
          )}
          {search.trim().length >= 2 && !searching && matches.length === 0 && (
            <p className="mt-3 text-xs font-semibold text-slate-400">No matches — try a name or full DEMO-ID.</p>
          )}

          {matches.length === 0 && search.trim().length < 2 && (
            <EmptyState
              title="Select a personnel record"
              body="Search above, or open a history directly from the Personnel Directory using the history icon on any row."
              icon={<UserRound size={22} />}
            />
          )}
        </div>
      )}

      {selected && (
        <div className="card rise rise-1 p-5">
          <div className="mb-4 flex flex-wrap items-center gap-3 border-b border-slate-100 pb-4">
            <Avatar name={selected.fullName} size="lg" />
            <div>
              <p className="flex items-center gap-2 text-[0.95rem] font-extrabold text-navy-950">
                {selected.fullName}
                {!selected.isActive && <Badge tone="red">Deactivated</Badge>}
              </p>
              <p className="mt-0.5 font-mono text-[0.7rem] text-slate-400">
                {selected.personnelId} · {selected.designation.replace(/\s*\(Demo\)/, "")} ·{" "}
                {selected.unitLabel.replace(/\s*\(Demo\)/, "")}
              </p>
            </div>
            <HistoryIcon size={18} className="ml-auto text-slate-300" />
          </div>
          <AttendanceHistory personnelId={selected.id} />
        </div>
      )}

      {loadingSelected && <p className="text-xs font-semibold text-slate-400">Loading record…</p>}
    </div>
  );
}
