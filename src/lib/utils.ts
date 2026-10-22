
import type { AttendanceStatus, MarkStatus } from "./types";

export const STATUS_META = {
  present: {
    label: "Present",
    plural: "Present",
    hex: "#0e9f6e",
    badge: "bg-emerald-50 text-emerald-700 border-emerald-200",
    dot: "bg-emerald-500",
  },
  absent: {
    label: "Absent",
    plural: "Absent",
    hex: "#e02424",
    badge: "bg-rose-50 text-rose-700 border-rose-200",
    dot: "bg-rose-500",
  },
  approved_leave: {
    label: "Approved Leave",
    plural: "On Leave",
    hex: "#d98e04",
    badge: "bg-amber-50 text-amber-700 border-amber-200",
    dot: "bg-amber-500",
  },
  not_marked: {
    label: "Not Marked",
    plural: "Not Marked",
    hex: "#718096",
    badge: "bg-slate-100 text-slate-600 border-slate-200",
    dot: "bg-slate-400",
  },
} as const;

export function todayISO(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function addDaysISO(date: string, days: number): string {
  const parsed = new Date(`${date}T00:00:00`);

  if (Number.isNaN(parsed.getTime())) {
    throw new Error("Invalid date. Expected YYYY-MM-DD.");
  }

  parsed.setDate(parsed.getDate() + days);

  const year = parsed.getFullYear();
  const month = String(parsed.getMonth() + 1).padStart(2, "0");
  const day = String(parsed.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

export function daysInMonth(
  month: string,
  today: string = todayISO(),
): string[] {
  if (!/^\d{4}-\d{2}$/.test(month)) return [];

  const [year, monthNumber] = month.split("-").map(Number);

  if (monthNumber < 1 || monthNumber > 12) return [];
  if (month > today.slice(0, 7)) return [];

  const lastDay =
    month === today.slice(0, 7)
      ? Number(today.slice(8, 10))
      : new Date(year, monthNumber, 0).getDate();

  return Array.from({ length: lastDay }, (_, index) => {
    return `${month}-${String(index + 1).padStart(2, "0")}`;
  });
}

export function pct(numerator: number, denominator: number): number {
  if (
    !Number.isFinite(numerator) ||
    !Number.isFinite(denominator) ||
    denominator <= 0
  ) {
    return 0;
  }

  return Math.round((numerator / denominator) * 1000) / 10;
}

export function fmtDateShort(date: string): string {
  if (!date) return "—";

  const parsed = new Date(`${date}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return date;

  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
  }).format(parsed);
}

export function fmtDate(date: string): string {
  if (!date) return "—";

  const parsed = new Date(`${date}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return date;

  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(parsed);
}

export function fmtWeekday(date: string): string {
  if (!date) return "—";

  const parsed = new Date(`${date}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return date;

  return new Intl.DateTimeFormat("en-IN", {
    weekday: "long",
  }).format(parsed);
}

export function monthLabel(month: string): string {
  if (!/^\d{4}-\d{2}$/.test(month)) return month;

  const parsed = new Date(`${month}-01T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return month;

  return new Intl.DateTimeFormat("en-IN", {
    month: "long",
    year: "numeric",
  }).format(parsed);
}

export function fmtDateTime(value: string): string {
  if (!value) return "—";

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;

  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(parsed);
}

export function timeAgo(value: string): string {
  if (!value) return "—";

  const timestamp = new Date(value).getTime();
  if (Number.isNaN(timestamp)) return value;

  const seconds = Math.floor((Date.now() - timestamp) / 1000);

  if (seconds < 0) return "just now";
  if (seconds < 60) return "just now";

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;

  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;

  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;

  const years = Math.floor(days / 365);
  return `${years}y ago`;
}

export function cn(
  ...classes: Array<string | false | null | undefined>
): string {
  return classes.filter(Boolean).join(" ");
}

export function downloadCSV(
  filename: string,
  headers: string[],
  rows: unknown[][],
): void {
  const escapeCell = (value: unknown): string => {
    const text = String(value ?? "");
    return `"${text.replace(/"/g, '""')}"`;
  };

  const content = [headers, ...rows]
    .map((row) => row.map(escapeCell).join(","))
    .join("\r\n");

  const blob = new Blob(["\uFEFF", content], {
    type: "text/csv;charset=utf-8;",
  });

  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");

  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();

  URL.revokeObjectURL(url);
}

export function getStatusMeta(status: MarkStatus | AttendanceStatus) {
  return STATUS_META[status];
}
