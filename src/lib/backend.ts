import type {
  AttendanceRecord,
  AuditLogEntry,
  DashboardStats,
  DailyReport,
  MonthlyReport,
  Paged,
  PersonnelQuery,
  Profile,
  RecentChange,
  SaveEntry,
  SessionUser,
  SheetRow,
  TrendPoint,
} from "./types";

import { SupabaseBackend } from "./supabaseBackend";
import { BackendError } from "./errors";

export { BackendError };

export interface PersonMonthSummary {
  present: number;
  absent: number;
  leave: number;
  notMarked: number;
  scheduled: number;
  pct: number;
}

export interface AuditQuery {
  search: string;
  action: string;
  page: number;
  pageSize: number;
}

export interface BackendFacade {
  mode: "supabase";

  signIn(email: string, password: string): Promise<SessionUser>;
  signOut(): Promise<void>;
  getSession(): Promise<SessionUser | null>;

  changePassword(current: string, next: string): Promise<void>;
  requestPasswordReset(email: string): Promise<void>;
  completePasswordReset(newPassword: string): Promise<void>;
  adminSetPassword(userId: string, newPassword: string): Promise<void>;

  getDashboardStats(date: string): Promise<DashboardStats>;
  getTrend(days: number): Promise<TrendPoint[]>;
  getRecentChanges(limit: number): Promise<RecentChange[]>;

  listPersonnel(query: PersonnelQuery): Promise<Paged<Profile>>;
  getProfile(id: string): Promise<Profile>;

  createPersonnel(input: {
    fullName: string;
    email: string;
    designation: string;
    unitLabel: string;
  }): Promise<{
    profile: Profile;
    tempPassword: string;
  }>;

  sendPersonnelCredentialsEmail(input: {
    email: string;
    fullName: string;
    password: string;
  }): Promise<void>;

  updatePersonnel(
    id: string,
    patch: Partial<
      Pick<
        Profile,
        "fullName" | "email" | "designation" | "unitLabel"
      >
    >,
  ): Promise<Profile>;

  setPersonnelActive(
    id: string,
    active: boolean,
    reason: string,
  ): Promise<void>;

  getAttendanceSheet(date: string): Promise<SheetRow[]>;

  saveAttendance(entries: SaveEntry[]): Promise<{
    created: number;
    corrected: number;
  }>;

  getPersonMonth(
    personnelId: string,
    month: string,
  ): Promise<{
    records: AttendanceRecord[];
    summary: PersonMonthSummary;
  }>;

  getPersonRecent(
    personnelId: string,
    limit: number,
  ): Promise<AttendanceRecord[]>;

  dailyReport(date: string): Promise<DailyReport>;

  monthlyReport(
    month: string,
    search: string,
    page: number,
    pageSize: number,
  ): Promise<{
    report: MonthlyReport;
    paged: Paged<MonthlyReport["rows"][number]>;
  }>;

  coveredMonths(): Promise<string[]>;

  listAudit(query: AuditQuery): Promise<Paged<AuditLogEntry>>;

  logExport(
    kind: string,
    detail: Record<string, unknown>,
  ): Promise<void>;
}

const SUPABASE_URL =
  import.meta.env.VITE_SUPABASE_URL as string | undefined;

const SUPABASE_KEY =
  import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const isSupabaseConfigured =
  Boolean(SUPABASE_URL && SUPABASE_KEY);

export const supabaseEnvStatus = {
  url: Boolean(SUPABASE_URL),
  anonKey: Boolean(SUPABASE_KEY),
};

// Stored on globalThis so the instance survives Vite hot reloads.
type BackendGlobal = { __apamsBackend?: BackendFacade };

export function getBackend(): BackendFacade {
  if (!isSupabaseConfigured) {
    throw new BackendError(
      "Supabase configuration is missing. " +
        "Check VITE_SUPABASE_URL and " +
        "VITE_SUPABASE_ANON_KEY in .env.local.",
      "setup/not-configured",
    );
  }

  const g = globalThis as unknown as BackendGlobal;
  const existing = g.__apamsBackend;
  if (existing) return existing;

  const created = new SupabaseBackend(
    SUPABASE_URL as string,
    SUPABASE_KEY as string,
  );
  g.__apamsBackend = created;
  return created;
}