import { createClient, type SupabaseClient } from "@supabase/supabase-js";

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

import type {
  AuditQuery,
  BackendFacade,
  PersonMonthSummary,
} from "./backend";

import { BackendError } from "./errors";
import { daysInMonth, fmtDateShort, pct, todayISO } from "./utils";

/* eslint-disable @typescript-eslint/no-explicit-any */

type DbRow = Record<string, any>;

// Stored on globalThis so only one Supabase client exists per page load.
type ClientGlobal = { __apamsSupabase?: SupabaseClient };

function mapProfile(row: DbRow): Profile {
  return {
    id: String(row.id),
    personnelId: String(row.personnel_code ?? ""),
    fullName: String(row.full_name ?? ""),
    email: String(row.email ?? ""),
    designation: String(row.designation ?? ""),
    unitLabel: String(row.units?.name ?? row.unit_label ?? row.unit_name ?? ""),
    isActive: Boolean(row.is_active),
    createdAt: String(row.created_at ?? ""),
    updatedAt: String(row.updated_at ?? ""),
  };
}

function mapAttendance(row: DbRow): AttendanceRecord {
  return {
    id: String(row.id),
    personnelProfileId: String(row.personnel_id),
    date: String(row.attendance_date),
    status: row.status,
    markedBy: row.marked_by ?? null,
    markedByName: row.marked_by_name ?? "Administrator",
    updatedBy: row.updated_by ?? null,
    updatedByName: row.updated_by_name ?? "Administrator",
    correctionReason: row.correction_reason ?? null,
    createdAt: String(row.created_at ?? ""),
    updatedAt: String(row.updated_at ?? ""),
  };
}

function mapAudit(row: DbRow): AuditLogEntry {
  return {
    id: String(row.id),
    actorId: row.actor_id ?? null,
    actorName: row.actor_name ?? row.actor_id ?? "System",
    action: String(row.action ?? ""),
    targetTable: String(row.target_table ?? "-"),
    targetRecordId: row.target_record_id ?? null,
    timestamp: String(row.created_at ?? ""),
    reason: row.reason ?? null,
    metadata: row.metadata ?? {},
  };
}

function normaliseStatus(status: string): string {
  if (status === "leave") return "approved_leave";
  return status;
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}

function dateRangeForMonth(month: string, today: string): string[] {
  return daysInMonth(month, today);
}

export class SupabaseBackend implements BackendFacade {
  mode = "supabase" as const;

  private db: SupabaseClient;
  private cachedUser: SessionUser | null = null;
  private recoveryPromise: Promise<void> | null = null;

  constructor(url: string, anonKey: string) {
    const g = globalThis as unknown as ClientGlobal;

    if (!g.__apamsSupabase) {
      g.__apamsSupabase = createClient(url, anonKey, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true,
          flowType: "pkce",
        },
      });

      g.__apamsSupabase.auth.onAuthStateChange(() => {
        this.cachedUser = null;
      });
    }

    this.db = g.__apamsSupabase;
  }

  private async fail(error: any): Promise<never> {
    throw new BackendError(
      error?.message ?? "Unexpected database error.",
      error?.code ?? "supabase",
    );
  }

  private async buildSession(
    userId: string,
    email: string,
  ): Promise<SessionUser> {
    const [
      { data: profile, error: profileError },
      { data: roleRow, error: roleError },
    ] = await Promise.all([
      this.db
        .from("profiles")
        .select("*, units(name)")
        .eq("id", userId)
        .maybeSingle(),
      this.db
        .from("user_roles")
        .select("role")
        .eq("user_id", userId)
        .maybeSingle(),
    ]);

    if (profileError) await this.fail(profileError);
    if (roleError) await this.fail(roleError);

    if (profile && profile.is_active === false) {
      await this.db.auth.signOut();
      throw new BackendError(
        "This account has been deactivated. Contact your administrator.",
        "auth/inactive",
      );
    }

    if (!roleRow) {
      throw new BackendError(
        "No APAMS role is assigned to this account.",
        "auth/role-not-found",
      );
    }

    const role: SessionUser["role"] =
      roleRow.role === "admin" ? "admin" : "personnel";

    if (role === "personnel" && !profile) {
      throw new BackendError(
        "No personnel profile was found for this account.",
        "profile/not-found",
      );
    }

    return {
      id: userId,
      email,
      fullName: profile?.full_name ?? email,
      role,
      profileId: profile?.id ?? null,
    };
  }

  async signIn(email: string, password: string): Promise<SessionUser> {
    const { data, error } = await this.db.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
    });

    if (error) await this.fail(error);
    if (!data.user) {
      throw new BackendError("Sign-in failed.", "auth/invalid");
    }

    this.cachedUser = await this.buildSession(
      data.user.id,
      data.user.email ?? email,
    );

    return this.cachedUser;
  }

  async signOut(): Promise<void> {
    this.cachedUser = null;
    const { error } = await this.db.auth.signOut();
    if (error) await this.fail(error);
  }

  async getSession(): Promise<SessionUser | null> {
    if (this.cachedUser) return this.cachedUser;

    const { data, error } = await this.db.auth.getSession();
    if (error) await this.fail(error);

    const user = data.session?.user;
    if (!user) return null;

    this.cachedUser = await this.buildSession(
      user.id,
      user.email ?? "",
    );

    return this.cachedUser;
  }

  private async actor(): Promise<SessionUser> {
    const user = await this.getSession();

    if (!user) {
      throw new BackendError(
        "Your session has expired. Please sign in again.",
        "auth/session-expired",
      );
    }

    return user;
  }

  private async requireAdmin(): Promise<SessionUser> {
    const user = await this.actor();

    if (user.role !== "admin") {
      throw new BackendError(
        "Administrator access is required.",
        "auth/forbidden",
      );
    }

    return user;
  }

  async changePassword(_current: string, next: string): Promise<void> {
    if (next.length < 8) {
      throw new BackendError(
        "New password must be at least 8 characters.",
        "auth/weak",
      );
    }

    const { error } = await this.db.auth.updateUser({ password: next });
    if (error) await this.fail(error);
  }

  async requestPasswordReset(email: string): Promise<void> {
    // HashRouter routes live in the URL fragment, so the redirect must point
    // at the hash route. This exact URL must also be in Supabase's Redirect URLs.
    const redirect = `${window.location.origin}${window.location.pathname}#/reset-password`;

    const { error } = await this.db.auth.resetPasswordForEmail(
      email.trim().toLowerCase(),
      { redirectTo: redirect },
    );

    if (error) await this.fail(error);
  }

  async completePasswordReset(newPassword: string): Promise<void> {
    if (newPassword.length < 8) {
      throw new BackendError(
        "New password must be at least 8 characters.",
        "auth/weak",
      );
    }

    await this.recoverSessionFromHash();

    const { data, error: sessionError } = await this.db.auth.getSession();
    if (sessionError) await this.fail(sessionError);
    if (!data.session) {
      throw new BackendError(
        "This reset link is invalid or has expired. Request a new one.",
        "auth/recovery-missing",
      );
    }

    const { error } = await this.db.auth.updateUser({ password: newPassword });
    if (error) await this.fail(error);

    // Sign out so the recovery session cannot open the app.
    this.cachedUser = null;
    const { error: signOutError } = await this.db.auth.signOut();
    if (signOutError) await this.fail(signOutError);
  }

  async adminSetPassword(userId: string, newPassword: string): Promise<void> {
    await this.requireAdmin();

    if (!isUuid(userId)) {
      throw new BackendError("Invalid user ID.", "personnel/invalid-id");
    }

    if (newPassword.length < 8) {
      throw new BackendError(
        "Password must be at least 8 characters.",
        "auth/weak",
      );
    }

    const { data, error } = await this.db.functions.invoke(
      "admin-set-password",
      { body: { userId, newPassword } },
    );

    if (error) {
      throw new BackendError(
        `Could not set password: ${error.message}`,
        "setup/admin-set-password",
      );
    }

    if (data?.error) {
      throw new BackendError(data.error, "auth/admin-set-password");
    }
  }

  // The recovery link arrives as #/reset-password?code=... because the
  // redirect URL contains a hash. detectSessionInUrl only reads the normal
  // query string, so the code is read from the hash and exchanged here.
  // The result is memoised so React re-renders cannot reuse a consumed code.
  private recoverSessionFromHash(): Promise<void> {
    if (!this.recoveryPromise) {
      this.recoveryPromise = this.doRecoverSessionFromHash().catch((err) => {
        this.recoveryPromise = null;
        throw err;
      });
    }
    return this.recoveryPromise;
  }

  private async doRecoverSessionFromHash(): Promise<void> {
    const hash = window.location.hash;
    const queryStart = hash.indexOf("?");
    if (queryStart === -1) return;

    const code = new URLSearchParams(hash.slice(queryStart + 1)).get("code");
    if (!code) return;

    const { error } = await this.db.auth.exchangeCodeForSession(code);
    if (error) await this.fail(error);

    // Remove the code from the address bar so a refresh does not reuse it.
    window.history.replaceState(
      null,
      "",
      `${window.location.pathname}#/reset-password`,
    );
  }

  private async resolveUnitId(unitLabel: string): Promise<string> {
    const label = unitLabel.trim();

    if (isUuid(label)) {
      const { data, error } = await this.db
        .from("units")
        .select("id")
        .eq("id", label)
        .eq("is_active", true)
        .maybeSingle();

      if (error) await this.fail(error);
      if (!data) {
        throw new BackendError("The selected unit is not active.", "unit/not-found");
      }
      return data.id;
    }

    const { data, error } = await this.db
      .from("units")
      .select("id, name")
      .eq("name", label)
      .eq("is_active", true)
      .maybeSingle();

    if (error) await this.fail(error);
    if (!data) {
      throw new BackendError(
        `Unit "${label}" was not found. Select an existing active unit.`,
        "unit/not-found",
      );
    }

    return data.id;
  }

  async getDashboardStats(date: string): Promise<DashboardStats> {
    await this.requireAdmin();

    const [
      { data: people, error: peopleError },
      { data: records, error: attendanceError },
    ] = await Promise.all([
      this.db
        .from("profiles")
        .select("id")
        .eq("is_active", true),
      this.db
        .from("attendance")
        .select("personnel_id, status")
        .eq("attendance_date", date),
    ]);

    if (peopleError) await this.fail(peopleError);
    if (attendanceError) await this.fail(attendanceError);

    const activeIds = new Set((people ?? []).map((person) => person.id));
    const attendance = (records ?? []).filter((record) =>
      activeIds.has(record.personnel_id),
    );

    const present = attendance.filter((row) => row.status === "present").length;
    const absent = attendance.filter((row) => row.status === "absent").length;
    const approvedLeave = attendance.filter(
      (row) => row.status === "approved_leave",
    ).length;

    return {
      date,
      totalActive: activeIds.size,
      present,
      absent,
      approvedLeave,
      notMarked: Math.max(
        0,
        activeIds.size - present - absent - approvedLeave,
      ),
      attendancePct: pct(present, present + absent),
    };
  }

  async getTrend(days: number): Promise<TrendPoint[]> {
    await this.requireAdmin();

    const safeDays = Math.max(1, Math.min(90, Math.floor(days)));
    const end = todayISO();
    const start = new Date(`${end}T00:00:00`);
    start.setDate(start.getDate() - safeDays + 1);

    const startDate = [
      start.getFullYear(),
      String(start.getMonth() + 1).padStart(2, "0"),
      String(start.getDate()).padStart(2, "0"),
    ].join("-");

    const [
      { data: people, error: peopleError },
      { data: records, error: attendanceError },
    ] = await Promise.all([
      this.db.from("profiles").select("id").eq("is_active", true),
      this.db
        .from("attendance")
        .select("personnel_id, attendance_date, status")
        .gte("attendance_date", startDate)
        .lte("attendance_date", end),
    ]);

    if (peopleError) await this.fail(peopleError);
    if (attendanceError) await this.fail(attendanceError);

    const activeIds = new Set((people ?? []).map((person) => person.id));
    const byDate = new Map<string, DbRow[]>();

    for (const record of records ?? []) {
      if (!activeIds.has(record.personnel_id)) continue;
      const list = byDate.get(record.attendance_date) ?? [];
      list.push(record);
      byDate.set(record.attendance_date, list);
    }

    const output: TrendPoint[] = [];

    for (let i = 0; i < safeDays; i++) {
      const dateObj = new Date(start);
      dateObj.setDate(start.getDate() + i);

      const date = [
        dateObj.getFullYear(),
        String(dateObj.getMonth() + 1).padStart(2, "0"),
        String(dateObj.getDate()).padStart(2, "0"),
      ].join("-");

      const rows = byDate.get(date) ?? [];
      const present = rows.filter((row) => row.status === "present").length;
      const absent = rows.filter((row) => row.status === "absent").length;
      const approvedLeave = rows.filter(
        (row) => row.status === "approved_leave",
      ).length;

      output.push({
        date,
        label: fmtDateShort(date),
        present,
        absent,
        approvedLeave,
        notMarked: Math.max(
          0,
          activeIds.size - present - absent - approvedLeave,
        ),
      });
    }

    return output;
  }

  async getRecentChanges(limit: number): Promise<RecentChange[]> {
    await this.requireAdmin();

    const safeLimit = Math.max(1, Math.min(100, Math.floor(limit)));

    const { data, error } = await this.db
      .from("attendance")
      .select("id, personnel_id, attendance_date, status, marked_by, updated_by, correction_reason, created_at, updated_at")
      .order("attendance_date", { ascending: false })
      .order("id", { ascending: false })
      .limit(safeLimit);

    if (error) await this.fail(error);

    const rows = data ?? [];
    const ids = [...new Set(rows.map((row) => row.personnel_id))];

    let people: DbRow[] = [];
    if (ids.length > 0) {
      const result = await this.db
        .from("profiles")
        .select("id, personnel_code, full_name")
        .in("id", ids);

      if (result.error) await this.fail(result.error);
      people = result.data ?? [];
    }

    const peopleById = new Map(people.map((person) => [person.id, person]));

    return rows.map((row) => {
      const person = peopleById.get(row.personnel_id);

      return {
        ...mapAttendance(row),
        personnelName: person?.full_name ?? "Unknown",
        personnelCode: person?.personnel_code ?? "—",
      };
    });
  }

  async getProfile(id: string): Promise<Profile> {
    const actor = await this.actor();

    if (actor.role !== "admin" && actor.id !== id) {
      throw new BackendError(
        "You cannot access another person's profile.",
        "auth/forbidden",
      );
    }

    const { data, error } = await this.db
      .from("profiles")
      .select("*, units(name)")
      .eq("id", id)
      .maybeSingle();

    if (error) await this.fail(error);
    if (!data) {
      throw new BackendError("Profile not found.", "profile/not-found");
    }

    return mapProfile(data);
  }

  async listPersonnel(q: PersonnelQuery): Promise<Paged<Profile>> {
    await this.requireAdmin();

    let query = this.db
      .from("profiles")
      .select("*, units(name)", { count: "exact" })
      .order("personnel_code", { ascending: true });

    if (q.status === "active") query = query.eq("is_active", true);
    if (q.status === "inactive") query = query.eq("is_active", false);

    const search = q.search.trim().replace(/[,%()]/g, " ");
    if (search) {
      query = query.or(
        `full_name.ilike.%${search}%,personnel_code.ilike.%${search}%,email.ilike.%${search}%`,
      );
    }

    const page = Math.max(1, q.page);
    const pageSize = Math.max(1, q.pageSize);
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    const { data, error, count } = await query.range(from, to);
    if (error) await this.fail(error);

    return {
      rows: (data ?? []).map(mapProfile),
      total: count ?? 0,
      page,
      pageSize,
    };
  }

  async createPersonnel(input: {
    fullName: string;
    email: string;
    designation: string;
    unitLabel: string;
  }): Promise<{ profile: Profile; tempPassword: string }> {
    await this.requireAdmin();

    const unitId = await this.resolveUnitId(input.unitLabel);

    const { data, error } = await this.db.functions.invoke(
      "admin-create-personnel",
      {
        body: {
          fullName: input.fullName.trim(),
          email: input.email.trim().toLowerCase(),
          designation: input.designation.trim(),
          unitId,
        },
      },
    );

    if (error) {
      throw new BackendError(
        `Personnel creation failed: ${error.message}`,
        "setup/edge-function",
      );
    }

    if (data?.error || !data?.profile) {
      throw new BackendError(
        data?.error ?? "The create function returned no profile.",
        "setup/personnel-create-response",
      );
    }

    return {
      profile: mapProfile(data.profile),
      tempPassword: data.tempPassword ?? data.temp_password ?? "",
    };
  }

  async sendPersonnelCredentialsEmail(input: {
    email: string;
    fullName: string;
    password: string;
  }): Promise<void> {
    await this.requireAdmin();

    const { data, error } = await this.db.functions.invoke(
      "send-personnel-credentials",
      {
        body: {
          email: input.email,
          fullName: input.fullName,
          password: input.password,
        },
      },
    );

    if (error) {
      throw new BackendError(
        `Could not send personnel email: ${error.message}`,
        "setup/email-function",
      );
    }

    if (data?.error) {
      throw new BackendError(data.error, "personnel/email-failed");
    }

    if (!data?.success) {
      throw new BackendError(
        "The email function did not confirm delivery.",
        "personnel/email-response",
      );
    }
  }

  async updatePersonnel(
    id: string,
    patch: Partial<
      Pick<Profile, "fullName" | "email" | "designation" | "unitLabel">
    >,
  ): Promise<Profile> {
    await this.requireAdmin();

    if (!isUuid(id)) {
      throw new BackendError(
        "Invalid personnel profile ID. Refresh the directory and try again.",
        "personnel/invalid-id",
      );
    }

    const body: DbRow = { personnelId: id };

    if (patch.fullName !== undefined) body.fullName = patch.fullName.trim();
    if (patch.email !== undefined) body.email = patch.email.trim().toLowerCase();
    if (patch.designation !== undefined) {
      body.designation = patch.designation.trim();
    }
    if (patch.unitLabel !== undefined) {
      body.unitId = await this.resolveUnitId(patch.unitLabel);
    }

    const { data, error } = await this.db.functions.invoke(
      "admin-update-personnel",
      { body },
    );

    if (error) {
      throw new BackendError(
        `Personnel update failed: ${error.message}`,
        "setup/personnel-update-function",
      );
    }

    if (data?.error || !data?.profile) {
      throw new BackendError(
        data?.error ?? "The update function returned no profile.",
        "setup/personnel-update-response",
      );
    }

    return mapProfile(data.profile);
  }

  async setPersonnelActive(
    id: string,
    active: boolean,
    reason: string,
  ): Promise<void> {
    await this.requireAdmin();

    if (!reason.trim()) {
      throw new BackendError(
        "A reason is required.",
        "personnel/reason-required",
      );
    }

    if (!isUuid(id)) {
      throw new BackendError(
        "Invalid personnel profile ID.",
        "personnel/invalid-id",
      );
    }

    if (active) {
      throw new BackendError(
        "Reactivation is not supported by the current deactivation Edge Function.",
        "personnel/reactivation-unsupported",
      );
    }

    const { data, error } = await this.db.functions.invoke(
      "admin-delete-personnel",
      {
        body: { personnelId: id, reason: reason.trim() },
      },
    );

    if (error) {
      throw new BackendError(
        `Personnel deactivation failed: ${error.message}`,
        "setup/personnel-deactivation",
      );
    }

    if (data?.error) {
      throw new BackendError(data.error, "personnel/deactivation-failed");
    }
  }

  async getAttendanceSheet(date: string): Promise<SheetRow[]> {
    await this.requireAdmin();

    const [
      { data: people, error: peopleError },
      { data: records, error: attendanceError },
    ] = await Promise.all([
      this.db
        .from("profiles")
        .select("*, units(name)")
        .eq("is_active", true)
        .order("personnel_code", { ascending: true }),
      this.db
        .from("attendance")
        .select("*")
        .eq("attendance_date", date),
    ]);

    if (peopleError) await this.fail(peopleError);
    if (attendanceError) await this.fail(attendanceError);

    const recordByPerson = new Map(
      (records ?? []).map((record) => [record.personnel_id, record]),
    );

    return (people ?? []).map((person) => ({
      profile: mapProfile(person),
      record: recordByPerson.has(person.id)
        ? mapAttendance(recordByPerson.get(person.id)!)
        : null,
    }));
  }

  async saveAttendance(
    entries: SaveEntry[],
  ): Promise<{ created: number; corrected: number }> {
    const actor = await this.requireAdmin();

    // attendance.marked_by and attendance.updated_by reference profiles.id,
    // not auth.users.id. buildSession() stores that profile ID in profileId.
    const adminProfileId = actor.profileId;
    if (!adminProfileId || !isUuid(adminProfileId)) {
      throw new BackendError(
        "Your admin account does not have a matching profile in the profiles table. Ask the database administrator to create/fix the admin profile, then sign in again.",
        "attendance/admin-profile-not-found",
      );
    }

    // Verify the profile exists before attempting any attendance writes.
    const { data: adminProfile, error: adminProfileError } = await this.db
      .from("profiles")
      .select("id")
      .eq("id", adminProfileId)
      .maybeSingle();

    if (adminProfileError) await this.fail(adminProfileError);
    if (!adminProfile) {
      throw new BackendError(
        "Your admin profile was not found in the profiles table. Please fix the admin profile before saving attendance.",
        "attendance/admin-profile-not-found",
      );
    }

    let created = 0;
    let corrected = 0;

    for (const entry of entries) {
      if (!isUuid(entry.profileId)) {
        throw new BackendError(
          "Invalid personnel profile ID. Refresh the attendance sheet.",
          "attendance/invalid-personnel",
        );
      }

      if (
        !entry.date ||
        !["present", "absent", "approved_leave"].includes(entry.status)
      ) {
        throw new BackendError(
          "Invalid attendance date or status.",
          "attendance/invalid-entry",
        );
      }

      const { data: existing, error: findError } = await this.db
        .from("attendance")
        .select("id, status")
        .eq("personnel_id", entry.profileId)
        .eq("attendance_date", entry.date)
        .maybeSingle();

      if (findError) await this.fail(findError);

      const { data: person, error: personError } = await this.db
        .from("profiles")
        .select("id")
        .eq("id", entry.profileId)
        .eq("is_active", true)
        .maybeSingle();

      if (personError) await this.fail(personError);
      if (!person) {
        throw new BackendError(
          "Personnel profile not found or inactive.",
          "attendance/personnel-not-found",
        );
      }

      const { error: saveError } = await this.db
        .from("attendance")
        .upsert(
          {
            personnel_id: entry.profileId,
            attendance_date: entry.date,
            status: normaliseStatus(entry.status),
            marked_by: adminProfile.id,
            updated_by: adminProfile.id,
            correction_reason: existing ? entry.correctionReason : null,
          },
          { onConflict: "personnel_id,attendance_date" },
        );

      if (saveError) await this.fail(saveError);

      if (existing) corrected++;
      else created++;
    }

    return { created, corrected };
  }

  async getPersonMonth(
    personnelId: string,
    month: string,
  ): Promise<{ records: AttendanceRecord[]; summary: PersonMonthSummary }> {
    const actor = await this.actor();

    if (actor.role !== "admin" && actor.id !== personnelId) {
      throw new BackendError(
        "You cannot access another person's attendance.",
        "auth/forbidden",
      );
    }

    const days = dateRangeForMonth(month, todayISO());

    if (!days.length) {
      return {
        records: [],
        summary: {
          present: 0,
          absent: 0,
          leave: 0,
          notMarked: 0,
          scheduled: 0,
          pct: 0,
        },
      };
    }

    const { data, error } = await this.db
      .from("attendance")
      .select("*")
      .eq("personnel_id", personnelId)
      .gte("attendance_date", days[0])
      .lte("attendance_date", days[days.length - 1])
      .order("attendance_date", { ascending: true });

    if (error) await this.fail(error);

    const records = (data ?? []).map(mapAttendance);
    const present = records.filter((row) => row.status === "present").length;
    const absent = records.filter((row) => row.status === "absent").length;
    const leave = records.filter(
      (row) => row.status === "approved_leave",
    ).length;
    const scheduled = days.length;

    return {
      records,
      summary: {
        present,
        absent,
        leave,
        notMarked: Math.max(0, scheduled - present - absent - leave),
        scheduled,
        pct: pct(present, present + absent),
      },
    };
  }

  async getPersonRecent(
    personnelId: string,
    limit: number,
  ): Promise<AttendanceRecord[]> {
    const actor = await this.actor();

    if (actor.role !== "admin" && actor.id !== personnelId) {
      throw new BackendError(
        "You cannot access another person's attendance.",
        "auth/forbidden",
      );
    }

    const { data, error } = await this.db
      .from("attendance")
      .select("*")
      .eq("personnel_id", personnelId)
      .order("attendance_date", { ascending: false })
      .limit(Math.max(1, Math.min(100, Math.floor(limit))));

    if (error) await this.fail(error);
    return (data ?? []).map(mapAttendance);
  }

  async dailyReport(date: string): Promise<DailyReport> {
    await this.requireAdmin();

    const [peopleResult, attendanceResult] = await Promise.all([
      this.db
        .from("profiles")
        .select("*, units(name)")
        .eq("is_active", true)
        .order("personnel_code", { ascending: true }),
      this.db.from("attendance").select("*").eq("attendance_date", date),
    ]);

    if (peopleResult.error) await this.fail(peopleResult.error);
    if (attendanceResult.error) await this.fail(attendanceResult.error);

    const records = attendanceResult.data ?? [];
    const recordByPerson = new Map(
      records.map((record) => [record.personnel_id, record]),
    );

    const rows = (peopleResult.data ?? []).map((person) => {
      const rawRecord = recordByPerson.get(person.id);
      const record = rawRecord ? mapAttendance(rawRecord) : null;

      return {
        profile: mapProfile(person),
        status: record?.status ?? "not_marked",
        record,
      } as DailyReport["rows"][number];
    });

    const present = rows.filter((row) => row.status === "present").length;
    const absent = rows.filter((row) => row.status === "absent").length;
    const approvedLeave = rows.filter(
      (row) => row.status === "approved_leave",
    ).length;
    const totalActive = rows.length;
    const notMarked = Math.max(
      0,
      totalActive - present - absent - approvedLeave,
    );

    return {
      date,
      totalActive,
      present,
      absent,
      approvedLeave,
      notMarked,
      attendancePct: pct(present, present + absent),
      rows,
    };
  }

  async monthlyReport(
    month: string,
    search: string,
    page: number,
    pageSize: number,
  ): Promise<{
    report: MonthlyReport;
    paged: Paged<MonthlyReport["rows"][number]>;
  }> {
    await this.requireAdmin();

    if (!/^\d{4}-\d{2}$/.test(month)) {
      throw new BackendError("Invalid month. Use YYYY-MM.", "report/invalid-month");
    }

    const [year, monthNumber] = month.split("-").map(Number);
    const monthStart = `${month}-01`;
    const monthEnd = new Date(year, monthNumber, 0);
    const calendarEnd = [
      year,
      String(monthNumber).padStart(2, "0"),
      String(monthEnd.getDate()).padStart(2, "0"),
    ].join("-");

    const today = todayISO();
    const endDate =
      month > today.slice(0, 7)
        ? monthStart
        : month === today.slice(0, 7)
          ? today
          : calendarEnd;

    const daysInScope =
      month > today.slice(0, 7) ? 0 : Number(endDate.slice(8, 10));

    const [peopleResult, attendanceResult] = await Promise.all([
      this.db
        .from("profiles")
        .select("*, units(name)")
        .eq("is_active", true)
        .order("personnel_code", { ascending: true }),
      this.db
        .from("attendance")
        .select("id, personnel_id, attendance_date, status")
        .gte("attendance_date", monthStart)
        .lte("attendance_date", endDate)
        .order("attendance_date", { ascending: true }),
    ]);

    if (peopleResult.error) await this.fail(peopleResult.error);
    if (attendanceResult.error) await this.fail(attendanceResult.error);

    const recordsByPerson = new Map<string, DbRow[]>();
    for (const record of attendanceResult.data ?? []) {
      const list = recordsByPerson.get(record.personnel_id) ?? [];
      list.push(record);
      recordsByPerson.set(record.personnel_id, list);
    }

    const term = search.trim().toLowerCase();

    const rows: MonthlyReport["rows"] = (peopleResult.data ?? [])
      .map((person) => {
        const personRecords = recordsByPerson.get(person.id) ?? [];
        const presentDays = personRecords.filter(
          (record) => record.status === "present",
        ).length;
        const absentDays = personRecords.filter(
          (record) => record.status === "absent",
        ).length;
        const leaveDays = personRecords.filter(
          (record) => record.status === "approved_leave",
        ).length;

        return {
          profile: mapProfile(person),
          scheduledDays: daysInScope,
          presentDays,
          absentDays,
          leaveDays,
          unmarkedDays: Math.max(
            0,
            daysInScope - presentDays - absentDays - leaveDays,
          ),
          attendancePct: pct(presentDays, presentDays + absentDays),
        };
      })
      .filter(
        (row) =>
          !term ||
          row.profile.fullName.toLowerCase().includes(term) ||
          row.profile.personnelId.toLowerCase().includes(term),
      );

    const totals = rows.reduce(
      (acc, row) => ({
        present: acc.present + row.presentDays,
        absent: acc.absent + row.absentDays,
        leave: acc.leave + row.leaveDays,
        unmarked: acc.unmarked + row.unmarkedDays,
      }),
      { present: 0, absent: 0, leave: 0, unmarked: 0 },
    );

    const safePage = Math.max(1, page);
    const safePageSize = Math.max(1, pageSize);
    const start = (safePage - 1) * safePageSize;

    return {
      report: { month, daysInScope, rows, totals },
      paged: {
        rows: rows.slice(start, start + safePageSize),
        total: rows.length,
        page: safePage,
        pageSize: safePageSize,
      },
    };
  }

  async coveredMonths(): Promise<string[]> {
    await this.actor();

    const months = new Set<string>();
    const today = todayISO();

    for (let i = 0; i < 90; i++) {
      const date = new Date(`${today}T00:00:00`);
      date.setDate(date.getDate() - i);
      months.add(date.toISOString().slice(0, 7));
    }

    return [...months].sort().reverse();
  }

  async listAudit(q: AuditQuery): Promise<Paged<AuditLogEntry>> {
    await this.requireAdmin();

    let query = this.db
      .from("audit_logs")
      .select("*", { count: "exact" })
      .order("created_at", { ascending: false });

    if (q.action !== "all") {
      query = query.like("action", `${q.action}%`);
    }

    const search = q.search.trim().replace(/[,%()]/g, " ");
    if (search) {
      query = query.or(
        `action.ilike.%${search}%,reason.ilike.%${search}%,target_table.ilike.%${search}%`,
      );
    }

    const page = Math.max(1, q.page);
    const pageSize = Math.max(1, q.pageSize);
    const { data, error, count } = await query.range(
      (page - 1) * pageSize,
      page * pageSize - 1,
    );

    if (error) await this.fail(error);

    return {
      rows: (data ?? []).map(mapAudit),
      total: count ?? 0,
      page,
      pageSize,
    };
  }

  async logExport(
    kind: string,
    detail: Record<string, unknown>,
  ): Promise<void> {
    const actor = await this.requireAdmin();

    const { error } = await this.db.from("audit_logs").insert({
      actor_id: actor.id,
      action: "report.exported_csv",
      target_table: kind,
      reason: "Authorised report export",
      metadata: detail,
    });

    if (error) await this.fail(error);
  }
}