export type Role = "admin" | "personnel";

export type AttendanceStatus =
  | "present"
  | "absent"
  | "approved_leave";

export type MarkStatus = AttendanceStatus | "not_marked";

export interface Profile {
  id: string;
  personnelId: string;
  fullName: string;
  email: string;
  designation: string;
  unitLabel: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AttendanceRecord {
  id: string;
  personnelProfileId: string;
  date: string;
  status: AttendanceStatus;
  markedBy: string | null;
  markedByName: string;
  updatedBy: string | null;
  updatedByName: string;
  correctionReason: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AuditLogEntry {
  id: string;
  actorId: string | null;
  actorName: string;
  action: string;
  targetTable: string;
  targetRecordId: string | null;
  timestamp: string;
  reason: string | null;
  metadata: Record<string, unknown>;
}

export interface SessionUser {
  id: string;
  email: string;
  fullName: string;
  role: Role;
  profileId: string | null;
}

export interface DashboardStats {
  date: string;
  totalActive: number;
  present: number;
  absent: number;
  approvedLeave: number;
  notMarked: number;
  attendancePct: number;
}

export interface TrendPoint {
  date: string;
  label: string;
  present: number;
  absent: number;
  approvedLeave: number;
  notMarked: number;
}

export interface SheetRow {
  profile: Profile;
  record: AttendanceRecord | null;
}

export interface SaveEntry {
  profileId: string;
  date: string;
  status: AttendanceStatus;
  correctionReason: string | null;
}

export interface Paged<T> {
  rows: T[];
  total: number;
  page: number;
  pageSize: number;
}

export interface PersonnelQuery {
  search: string;
  status: "all" | "active" | "inactive";
  page: number;
  pageSize: number;
}

export interface DailyReport {
  date: string;
  totalActive: number;
  present: number;
  absent: number;
  approvedLeave: number;
  notMarked: number;
  attendancePct: number;
  rows: Array<{
    profile: Profile;
    status: MarkStatus;
    record: AttendanceRecord | null;
  }>;
}

export interface MonthlyRow {
  profile: Profile;
  scheduledDays: number;
  presentDays: number;
  absentDays: number;
  leaveDays: number;
  unmarkedDays: number;
  attendancePct: number;
}

export interface MonthlyReport {
  month: string;
  daysInScope: number;
  rows: MonthlyRow[];
  totals: {
    present: number;
    absent: number;
    leave: number;
    unmarked: number;
  };
}

export interface RecentChange extends AttendanceRecord {
  personnelName: string;
  personnelCode: string;
}

export interface LoginResult {
  ok: boolean;
  error?: string;
  lockedUntil?: number;
}