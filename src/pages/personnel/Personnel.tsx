import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  CalendarDays,
  CircleDashed,
  History,
  Mail,
  MoonStar,
  ShieldCheck,
  UserCheck,
  UserRound,
  UserX,
  Users,
  Fingerprint,
  Building2,
  BadgeCheck,
  Info,
} from "lucide-react";

import { useAuth } from "@/context/AuthContext";
import {
  getBackend,
  type PersonMonthSummary,
} from "@/lib/backend";
import type {
  AttendanceRecord,
  Profile,
} from "@/lib/types";
import {
  fmtDate,
  fmtWeekday,
  todayISO,
} from "@/lib/utils";
import AttendanceHistory from "@/components/AttendanceHistory";
import {
  Avatar,
  Badge,
  EmptyState,
  PageLoader,
  ProgressRing,
  StatusBadge,
} from "@/components/ui";

const cleanLabel = (value?: string | null) =>
  (value ?? "").replace(/\s*\([^)]*\)/g, "").trim();

export function PersonnelDashboard() {
  const { user } = useAuth();

  const [profile, setProfile] = useState<Profile | null>(null);
  const [summary, setSummary] =
    useState<PersonMonthSummary | null>(null);
  const [recent, setRecent] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let alive = true;

    if (!user?.profileId) {
      setLoading(false);
      return;
    }

    setLoading(true);

    Promise.all([
      getBackend().getProfile(user.profileId),
      getBackend().getPersonMonth(
        user.profileId,
        todayISO().slice(0, 7),
      ),
      getBackend().getPersonRecent(user.profileId, 10),
    ])
      .then(([person, month, records]) => {
        if (!alive) return;

        setProfile(person);
        setSummary(month.summary);
        setRecent(records);
        setError("");
      })
      .catch((e) => {
        if (alive) {
          setError(
            e instanceof Error
              ? e.message
              : "Could not load dashboard.",
          );
        }
      })
      .finally(() => {
        if (alive) setLoading(false);
      });

    return () => {
      alive = false;
    };
  }, [user?.profileId]);

  if (loading) {
    return <PageLoader label="Loading your dashboard…" />;
  }

  const firstName = (
    profile?.fullName ??
    user?.fullName ??
    ""
  ).split(" ")[0];

  const monthName = new Date().toLocaleDateString("en-GB", {
    month: "long",
    year: "numeric",
  });

  const cards = summary
    ? [
        {
          label: "Present",
          value: summary.present,
          icon: <UserCheck size={17} />,
          cls: "text-emerald-600 bg-emerald-50",
        },
        {
          label: "Absent",
          value: summary.absent,
          icon: <UserX size={17} />,
          cls: "text-rose-600 bg-rose-50",
        },
        {
          label: "Approved leave",
          value: summary.leave,
          icon: <MoonStar size={17} />,
          cls: "text-amber-600 bg-amber-50",
        },
        {
          label: "Not marked",
          value: summary.notMarked,
          icon: <CircleDashed size={17} />,
          cls: "text-slate-500 bg-slate-100",
        },
      ]
    : [];

  return (
    <div className="space-y-5">
      {error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
          {error}
        </div>
      )}

      <section className="card relative overflow-hidden">
        <div className="flex flex-wrap items-center gap-4 p-6">
          <Avatar
            name={profile?.fullName ?? "?"}
            size="lg"
            className="h-14 w-14 text-base"
          />

          <div className="min-w-0 flex-1">
            <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
              {fmtDate(todayISO())} · {monthName} summary
            </p>

            <h2 className="mt-1 text-2xl font-extrabold text-navy-950">
              Welcome, {firstName}
            </h2>

            <p className="mt-1 text-xs font-semibold text-slate-500">
              {profile?.personnelId ?? ""} ·{" "}
              {cleanLabel(profile?.designation)} ·{" "}
              {cleanLabel(profile?.unitLabel)}
            </p>
          </div>

          <div className="flex flex-col items-center gap-1">
            <ProgressRing
              value={summary?.pct ?? 0}
              size={92}
              stroke={8}
              label="My rate"
            />
            <p className="text-[0.62rem] text-slate-400">
              Present ÷ (Present + Absent)
            </p>
          </div>
        </div>
      </section>

      <div className="grid grid-cols-2 gap-3.5 lg:grid-cols-4">
        {cards.map((card) => (
          <div
            key={card.label}
            className="card flex items-center gap-3 p-4"
          >
            <span
              className={`inline-flex h-10 w-10 items-center justify-center rounded-xl ${card.cls}`}
            >
              {card.icon}
            </span>

            <div>
              <p className="text-xs font-bold uppercase text-slate-500">
                {card.label}
              </p>
              <p className="text-xl font-extrabold text-navy-950">
                {card.value}
              </p>
            </div>
          </div>
        ))}
      </div>

      <section className="card overflow-hidden">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <div>
            <h3 className="font-bold text-navy-950">
              My recent attendance
            </h3>
            <p className="text-xs text-slate-500">
              Read-only attendance records
            </p>
          </div>

          <Link
            to="/my/attendance"
            className="inline-flex items-center gap-1 text-xs font-bold text-navy-700"
          >
            <History size={14} />
            Full history
          </Link>
        </div>

        {recent.length === 0 ? (
          <EmptyState
            title="No records yet"
            body="Your attendance will appear here once an administrator marks it."
            icon={<CalendarDays size={22} />}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[620px]">
              <thead>
                <tr>
                  <th className="th">Date</th>
                  <th className="th text-center">Status</th>
                  <th className="th">Marked by</th>
                  <th className="th">Note</th>
                </tr>
              </thead>

              <tbody>
                {recent.map((record) => (
                  <tr key={record.id} className="row-hover">
                    <td className="td font-bold">
                      {fmtDate(record.date)}
                      <span className="ml-2 text-xs font-normal text-slate-400">
                        {fmtWeekday(record.date)}
                      </span>
                    </td>

                    <td className="td text-center">
                      <StatusBadge status={record.status} />
                    </td>

                    <td className="td">
                      {(record.updatedByName ?? "Administrator")
                        .replace(/\([^)]*\)/g, "")
                        .trim()}
                    </td>

                    <td className="td">
                      {record.correctionReason || "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <p className="flex items-start gap-2 text-xs text-slate-400">
        <ShieldCheck size={14} />
        Read-only view: report discrepancies to your administrator.
      </p>
    </div>
  );
}

export function MyAttendancePage() {
  const { user } = useAuth();

  return (
    <div className="space-y-5">
      <header>
        <h2 className="text-2xl font-extrabold text-navy-950">
          My attendance
        </h2>
        <p className="mt-1 text-sm text-slate-500">
          Month-by-month view of your attendance records.
        </p>
      </header>

      <div className="card p-5">
        {user?.profileId ? (
          <AttendanceHistory personnelId={user.profileId} />
        ) : (
          <EmptyState
            title="Profile unavailable"
            icon={<UserRound size={22} />}
          />
        )}
      </div>
    </div>
  );
}

export function MyProfilePage() {
  const { user } = useAuth();

  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let alive = true;

    if (!user?.profileId) {
      setLoading(false);
      return;
    }

    getBackend()
      .getProfile(user.profileId)
      .then((person) => {
        if (alive) setProfile(person);
      })
      .catch((e) => {
        if (alive) {
          setError(
            e instanceof Error
              ? e.message
              : "Could not load profile.",
          );
        }
      })
      .finally(() => {
        if (alive) setLoading(false);
      });

    return () => {
      alive = false;
    };
  }, [user?.profileId]);

  if (loading) {
    return <PageLoader label="Loading your profile…" />;
  }

  if (!profile) {
    return (
      <div className="space-y-3">
        {error && (
          <p className="text-sm text-rose-600">{error}</p>
        )}
        <EmptyState
          title="Profile not found"
          body="Contact your administrator to verify your account."
          icon={<UserRound size={22} />}
        />
      </div>
    );
  }

  const fields = [
    {
      label: "Full name",
      value: profile.fullName,
      icon: <UserRound size={15} />,
    },
    {
      label: "Personnel ID",
      value: profile.personnelId,
      icon: <Fingerprint size={15} />,
    },
    {
      label: "Email",
      value: profile.email,
      icon: <Mail size={15} />,
    },
    {
      label: "Designation",
      value: cleanLabel(profile.designation),
      icon: <BadgeCheck size={15} />,
    },
    {
      label: "Unit",
      value: cleanLabel(profile.unitLabel),
      icon: <Building2 size={15} />,
    },
    {
      label: "Member since",
      value: profile.createdAt
        ? fmtDate(profile.createdAt.slice(0, 10))
        : "—",
      icon: <CalendarDays size={15} />,
    },
  ];

  return (
    <div className="space-y-5">
      <header>
        <h2 className="text-2xl font-extrabold text-navy-950">
          My profile
        </h2>
        <p className="mt-1 text-sm text-slate-500">
          Your details are maintained by the administration.
        </p>
      </header>

      <section className="card overflow-hidden">
        <div className="flex flex-wrap items-center gap-4 border-b border-slate-100 bg-navy-50/50 p-6">
          <Avatar
            name={profile.fullName}
            size="lg"
            className="h-16 w-16 text-lg"
          />

          <div>
            <h3 className="text-lg font-extrabold">
              {profile.fullName}
            </h3>
            <p className="font-mono text-xs text-slate-500">
              {profile.personnelId}
            </p>

            <div className="mt-2 flex gap-2">
              <Badge tone={profile.isActive ? "green" : "red"}>
                {profile.isActive ? "Active account" : "Deactivated"}
              </Badge>
              <Badge tone="navy">Personnel</Badge>
            </div>
          </div>

          <Users
            size={36}
            className="ml-auto hidden text-navy-200 sm:block"
          />
        </div>

        <dl className="grid grid-cols-1 gap-px bg-slate-100 sm:grid-cols-2">
          {fields.map((field) => (
            <div
              key={field.label}
              className="flex items-center gap-3 bg-white px-5 py-4"
            >
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-navy-50 text-navy-700">
                {field.icon}
              </span>

              <div className="min-w-0">
                <dt className="text-xs font-bold uppercase text-slate-400">
                  {field.label}
                </dt>
                <dd className="truncate text-sm font-bold text-navy-950">
                  {field.value || "—"}
                </dd>
              </div>
            </div>
          ))}
        </dl>
      </section>

      <p className="flex items-start gap-2 rounded-xl bg-navy-50 p-4 text-xs text-navy-800">
        <Info size={14} />
        Contact your administrator to request profile corrections.
      </p>
    </div>
  );
}