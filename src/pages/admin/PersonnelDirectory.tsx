import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Copy,
  History,
  KeyRound,
  Mail,
  Pencil,
  Plus,
  RefreshCw,
  ShieldCheck,
  UserCheck,
  UserPlus,
  UserX,
  Users,
} from "lucide-react";

import { getBackend } from "@/lib/backend";
import { DESIGNATIONS, UNIT_LABELS } from "@/lib/options";
import type { Profile } from "@/lib/types";
import { fmtDate } from "@/lib/utils";
import {
  Avatar,
  Badge,
  Button,
  EmptyState,
  Field,
  Input,
  Modal,
  PageLoader,
  Pagination,
  SearchInput,
  Select,
  useToast,
} from "@/components/ui";

const PAGE_SIZE = 15;

interface FormState {
  fullName: string;
  email: string;
  designation: string;
  unitLabel: string;
}

const EMPTY_FORM: FormState = {
  fullName: "",
  email: "",
  designation: DESIGNATIONS[0],
  unitLabel: UNIT_LABELS[0],
};

// Character groups. Each generated password contains at least one character
// from every group, which satisfies the Supabase password policy.
// Ambiguous characters (0/O, 1/l/I) are left out so passwords are easy to read.
const LOWER = "abcdefghijkmnpqrstuvwxyz";
const UPPER = "ABCDEFGHJKLMNPQRSTUVWXYZ";
const DIGIT = "23456789";
const SYMBOL = "!@#$%^&*";
const ALL = LOWER + UPPER + DIGIT + SYMBOL;

function randomIndex(max: number): number {
  const b = new Uint32Array(1);
  crypto.getRandomValues(b);
  return b[0] % max;
}

function pick(set: string): string {
  return set[randomIndex(set.length)];
}

/** Generates a 12-character password with all four character types. */
function generateTempPassword(length = 12): string {
  const chars = [pick(LOWER), pick(UPPER), pick(DIGIT), pick(SYMBOL)];
  while (chars.length < length) chars.push(pick(ALL));

  // Shuffle so the required characters are not always at the start.
  for (let i = chars.length - 1; i > 0; i--) {
    const j = randomIndex(i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }

  return chars.join("");
}

/** Individual rules, used for validation and the live checklist. */
function passwordChecks(password: string) {
  return {
    length: password.length >= 8,
    upper: /[A-Z]/.test(password),
    lower: /[a-z]/.test(password),
    digit: /[0-9]/.test(password),
    symbol: /[!@#$%^&*()_+\-=[\]{};':"\\|<>?,./`~]/.test(password),
  };
}

/** Matches the Supabase password policy. */
function meetsPasswordPolicy(password: string): boolean {
  const c = passwordChecks(password);
  return c.length && c.upper && c.lower && c.digit && c.symbol;
}

const PASSWORD_RULES: Array<{
  key: keyof ReturnType<typeof passwordChecks>;
  label: string;
}> = [
  { key: "length", label: "8+ characters" },
  { key: "upper", label: "Uppercase letter" },
  { key: "lower", label: "Lowercase letter" },
  { key: "digit", label: "Number" },
  { key: "symbol", label: "Symbol (!@#$%^&*)" },
];

export default function PersonnelDirectory() {
  const { toast } = useToast();
  const navigate = useNavigate();

  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [status, setStatus] = useState<"all" | "active" | "inactive">("all");
  const [page, setPage] = useState(1);
  const [rows, setRows] = useState<Profile[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Profile | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const [toggleTarget, setToggleTarget] = useState<Profile | null>(null);
  const [reason, setReason] = useState("");
  const [toggling, setToggling] = useState(false);

  const [provisioned, setProvisioned] = useState<{
    profile: Profile;
    tempPassword: string;
  } | null>(null);

  const [passwordTarget, setPasswordTarget] = useState<Profile | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [passwordSet, setPasswordSet] = useState(false);
  const [settingPassword, setSettingPassword] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebounced(search.trim());
    }, 300);

    return () => window.clearTimeout(timer);
  }, [search]);

  const load = useCallback(async () => {
    setLoading(true);

    try {
      const result = await getBackend().listPersonnel({
        search: debounced,
        status,
        page,
        pageSize: PAGE_SIZE,
      });

      setRows(result.rows);
      setTotal(result.total);
    } catch (error) {
      toast(
        "error",
        "Could not load personnel",
        error instanceof Error ? error.message : undefined,
      );
    } finally {
      setLoading(false);
    }
  }, [debounced, status, page, toast]);

  useEffect(() => {
    void load();
  }, [load]);

  function openAdd() {
    setEditing(null);
    setForm(EMPTY_FORM);
    setFormOpen(true);
  }

  function openEdit(profile: Profile) {
    setEditing(profile);
    setForm({
      fullName: profile.fullName,
      email: profile.email,
      designation: profile.designation,
      unitLabel: profile.unitLabel,
    });
    setFormOpen(true);
  }

  function openSetPassword(profile: Profile) {
    setPasswordTarget(profile);
    setNewPassword(generateTempPassword());
    setPasswordSet(false);
    setPasswordError(null);
  }

  async function saveForm() {
    setSaving(true);

    try {
      if (editing) {
        await getBackend().updatePersonnel(editing.id, { ...form });

        toast(
          "success",
          "Profile updated",
          `${form.fullName} (${editing.personnelId}) was updated and audited.`,
        );

        setFormOpen(false);
      } else {
        const result = await getBackend().createPersonnel({ ...form });

        setFormOpen(false);
        setProvisioned(result);
      }

      await load();
    } catch (error) {
      toast(
        "error",
        "Save failed",
        error instanceof Error ? error.message : undefined,
      );
    } finally {
      setSaving(false);
    }
  }

  async function confirmToggle() {
    if (!toggleTarget) return;

    setToggling(true);

    try {
      await getBackend().setPersonnelActive(
        toggleTarget.id,
        !toggleTarget.isActive,
        reason,
      );

      toast(
        "success",
        toggleTarget.isActive ? "Account deactivated" : "Account activated",
        `${toggleTarget.fullName} — ${
          toggleTarget.isActive
            ? "access revoked immediately"
            : "access restored"
        }.`,
      );

      setToggleTarget(null);
      setReason("");
      await load();
    } catch (error) {
      toast(
        "error",
        "Status change failed",
        error instanceof Error ? error.message : undefined,
      );
    } finally {
      setToggling(false);
    }
  }

  async function confirmSetPassword() {
    if (!passwordTarget) return;

    setPasswordError(null);

    if (!meetsPasswordPolicy(newPassword)) {
      setPasswordError(
        "Password must be at least 8 characters and include an uppercase letter, a lowercase letter, a number and a symbol.",
      );
      return;
    }

    setSettingPassword(true);

    try {
      await getBackend().adminSetPassword(passwordTarget.id, newPassword);
      setPasswordSet(true);
      toast(
        "success",
        "Password updated",
        `${passwordTarget.fullName} can now sign in with the new password.`,
      );
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Could not set password.";
      setPasswordError(message);
    } finally {
      setSettingPassword(false);
    }
  }

  function closeSetPassword() {
    setPasswordTarget(null);
    setNewPassword("");
    setPasswordSet(false);
    setPasswordError(null);
  }

  function openGmail() {
    if (!provisioned) return;

    const { profile, tempPassword } = provisioned;

    const subject = "Your APAMS Login Credentials";

    const body = [
      `Hello ${profile.fullName},`,
      "",
      "Your APAMS personnel account has been created.",
      "",
      `Login Email: ${profile.email}`,
      `Temporary Password: ${tempPassword}`,
      "",
      "Please sign in and change your password immediately.",
      "",
      "Regards,",
      "APAMS Administration",
    ].join("\n");

    const gmailUrl =
      "https://mail.google.com/mail/?view=cm&fs=1" +
      `&to=${encodeURIComponent(profile.email)}` +
      `&su=${encodeURIComponent(subject)}` +
      `&body=${encodeURIComponent(body)}`;

    const gmailWindow = window.open(gmailUrl, "_blank", "noopener,noreferrer");

    if (!gmailWindow) {
      window.location.assign(gmailUrl);
    }
  }

  return (
    <div className="space-y-5">
      {/* Page heading */}
      <div className="rise flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-xl font-extrabold tracking-tight text-navy-950 sm:text-2xl">
            Personnel directory
          </h2>

          <p className="mt-1 text-xs font-medium text-slate-500 sm:text-sm">
            {total.toLocaleString("en-IN")} personnel records ·
            server-side pagination · role-guarded writes
          </p>
        </div>

        <Button icon={<Plus size={15} />} onClick={openAdd}>
          Add personnel
        </Button>
      </div>

      {/* Search and filters */}
      <div className="card rise rise-1 flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
        <SearchInput
          value={search}
          onChange={(value) => {
            setSearch(value);
            setPage(1);
          }}
          placeholder="Search by name, personnel ID or email…"
          className="flex-1"
        />

        <Select
          value={status}
          onChange={(event) => {
            setStatus(event.target.value as typeof status);
            setPage(1);
          }}
          className="sm:w-44"
        >
          <option value="all">All statuses</option>
          <option value="active">Active only</option>
          <option value="inactive">Inactive only</option>
        </Select>
      </div>

      {/* Personnel table */}
      <div className="card rise rise-2 overflow-hidden">
        {loading ? (
          <PageLoader label="Loading personnel…" />
        ) : rows.length === 0 ? (
          <EmptyState
            title="No personnel found"
            body="Adjust your search or filters — or add a new personnel record."
            icon={<Users size={22} />}
            action={
              <Button
                size="sm"
                variant="secondary"
                icon={<UserPlus size={14} />}
                onClick={openAdd}
              >
                Add personnel
              </Button>
            }
          />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[880px]">
                <thead>
                  <tr>
                    <th className="th">Personnel</th>
                    <th className="th">Personnel ID</th>
                    <th className="th">Designation</th>
                    <th className="th">Unit</th>
                    <th className="th text-center">Status</th>
                    <th className="th">Created</th>
                    <th className="th text-right">Actions</th>
                  </tr>
                </thead>

                <tbody>
                  {rows.map((profile) => (
                    <tr key={profile.id} className="row-hover">
                      <td className="td">
                        <div className="flex items-center gap-3">
                          <Avatar name={profile.fullName} size="sm" />

                          <div>
                            <p className="font-bold text-navy-950">
                              {profile.fullName}
                            </p>

                            <p className="text-[0.7rem] text-slate-400">
                              {profile.email}
                            </p>
                          </div>
                        </div>
                      </td>

                      <td className="td font-mono text-[0.75rem] font-semibold text-navy-800">
                        {profile.personnelId}
                      </td>

                      <td className="td text-slate-600">
                        {profile.designation.replace(/\s*\(.*\)/, "")}
                      </td>

                      <td className="td text-slate-600">
                        {profile.unitLabel.replace(/\s*\(.*\)/, "")}
                      </td>

                      <td className="td text-center">
                        {profile.isActive ? (
                          <Badge tone="green">Active</Badge>
                        ) : (
                          <Badge tone="red">Deactivated</Badge>
                        )}
                      </td>

                      <td className="td whitespace-nowrap text-slate-500">
                        {fmtDate(profile.createdAt.slice(0, 10))}
                      </td>

                      <td className="td">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-navy-50 hover:text-navy-700"
                            title="View attendance history"
                            onClick={() =>
                              navigate(`/history?personnel=${profile.id}`)
                            }
                          >
                            <History size={15} />
                          </button>

                          <button
                            className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-navy-50 hover:text-navy-700"
                            title="Set temporary password"
                            onClick={() => openSetPassword(profile)}
                          >
                            <KeyRound size={15} />
                          </button>

                          <button
                            className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-navy-50 hover:text-navy-700"
                            title="Edit profile"
                            onClick={() => openEdit(profile)}
                          >
                            <Pencil size={15} />
                          </button>

                          <button
                            className={`rounded-lg p-1.5 transition-colors ${
                              profile.isActive
                                ? "text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                                : "text-slate-400 hover:bg-emerald-50 hover:text-emerald-600"
                            }`}
                            title={
                              profile.isActive
                                ? "Deactivate account"
                                : "Activate account"
                            }
                            onClick={() => {
                              setToggleTarget(profile);
                              setReason("");
                            }}
                          >
                            {profile.isActive ? (
                              <UserX size={15} />
                            ) : (
                              <UserCheck size={15} />
                            )}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <Pagination
              page={page}
              pageSize={PAGE_SIZE}
              total={total}
              onPage={setPage}
            />
          </>
        )}
      </div>

      {/* Add / edit modal */}
      <Modal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title={editing ? `Edit ${editing.fullName}` : "Add personnel"}
        subtitle={
          editing
            ? `Personnel ID ${editing.personnelId} — changes are audit-logged`
            : "Account is provisioned through the trusted admin workflow"
        }
        footer={
          <>
            <Button variant="secondary" onClick={() => setFormOpen(false)}>
              Cancel
            </Button>

            <Button onClick={saveForm} loading={saving}>
              {editing ? "Save changes" : "Create account"}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label="Full name">
            <Input
              value={form.fullName}
              onChange={(event) =>
                setForm({ ...form, fullName: event.target.value })
              }
              placeholder="e.g. Kabir Sharma"
            />
          </Field>

          <Field
            label="Email"
            hint={
              editing
                ? undefined
                : "Used as the sign-in identity for this account"
            }
          >
            <Input
              type="email"
              value={form.email}
              onChange={(event) =>
                setForm({ ...form, email: event.target.value })
              }
              placeholder="name@example.com"
            />
          </Field>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Designation (demo)">
              <Select
                value={form.designation}
                onChange={(event) =>
                  setForm({ ...form, designation: event.target.value })
                }
              >
                {DESIGNATIONS.map((designation) => (
                  <option key={designation} value={designation}>
                    {designation.replace(/\s*\(.*\)/, "")}
                  </option>
                ))}
              </Select>
            </Field>

            <Field label="Unit label (demo)">
              <Select
                value={form.unitLabel}
                onChange={(event) =>
                  setForm({ ...form, unitLabel: event.target.value })
                }
              >
                {UNIT_LABELS.map((unit) => (
                  <option key={unit} value={unit}>
                    {unit.replace(/\s*\(.*\)/, "")}
                  </option>
                ))}
              </Select>
            </Field>
          </div>

          {!editing && (
            <div className="flex items-start gap-2.5 rounded-lg bg-navy-50 px-3.5 py-3 text-[0.72rem] leading-relaxed text-navy-800">
              <ShieldCheck size={15} className="mt-0.5 shrink-0" />
              A unique Personnel ID is assigned automatically. A temporary
              credential is generated by the trusted provisioning workflow and
              shown once — share it over a secure channel only.
            </div>
          )}
        </div>
      </Modal>

      {/* Account provisioned modal */}
      <Modal
        open={!!provisioned}
        onClose={() => setProvisioned(null)}
        title="Account provisioned"
      >
        {provisioned && (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <Avatar name={provisioned.profile.fullName} size="lg" />

              <div>
                <p className="font-bold text-navy-950">
                  {provisioned.profile.fullName}
                </p>

                <p className="font-mono text-xs text-slate-500">
                  {provisioned.profile.personnelId}
                </p>
              </div>

              <Badge tone="green" className="ml-auto">
                Active
              </Badge>
            </div>

            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
              <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-amber-700">
                <KeyRound size={13} />
                Temporary credential — shown once
              </p>

              <div className="mt-2 flex items-center justify-between gap-3 rounded-lg bg-white px-3.5 py-2.5 ring-1 ring-amber-200">
                <code className="break-all font-mono text-sm font-bold text-navy-950">
                  {provisioned.tempPassword}
                </code>

                <button
                  className="inline-flex shrink-0 items-center gap-1 text-xs font-bold text-navy-700 hover:text-navy-500"
                  onClick={() => {
                    void navigator.clipboard?.writeText(
                      provisioned.tempPassword,
                    );
                    toast("info", "Copied to clipboard");
                  }}
                >
                  <Copy size={13} />
                  Copy
                </button>
              </div>

              <p className="mt-2 text-[0.7rem] leading-relaxed text-amber-800">
                {provisioned.profile.email} must change this password after
                first sign-in.
              </p>
            </div>

            <Button className="w-full" onClick={openGmail}>
              <Mail size={15} className="mr-2 inline" />
              Open Gmail
            </Button>

            <Button className="w-full" onClick={() => setProvisioned(null)}>
              Done
            </Button>
          </div>
        )}
      </Modal>

      {/* Set temporary password modal */}
      <Modal
        open={!!passwordTarget}
        onClose={closeSetPassword}
        title="Set temporary password"
        subtitle={
          passwordTarget
            ? `${passwordTarget.fullName} · ${passwordTarget.personnelId}`
            : undefined
        }
        footer={
          passwordSet ? (
            <Button onClick={closeSetPassword}>Done</Button>
          ) : (
            <>
              <Button variant="secondary" onClick={closeSetPassword}>
                Cancel
              </Button>

              <Button
                loading={settingPassword}
                disabled={!meetsPasswordPolicy(newPassword)}
                onClick={confirmSetPassword}
              >
                Set password
              </Button>
            </>
          )
        }
      >
        {passwordTarget && (
          <div className="space-y-4">
            {passwordSet ? (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
                <p className="text-sm font-bold text-emerald-800">
                  Password updated
                </p>
                <p className="mt-1 text-xs leading-relaxed text-emerald-700">
                  Share this temporary password over a secure channel. The
                  person should change it after signing in.
                </p>

                <div className="mt-3 flex items-center justify-between gap-3 rounded-lg bg-white px-3.5 py-2.5 ring-1 ring-emerald-200">
                  <code className="break-all font-mono text-sm font-bold text-navy-950">
                    {newPassword}
                  </code>

                  <button
                    className="inline-flex shrink-0 items-center gap-1 text-xs font-bold text-navy-700 hover:text-navy-500"
                    onClick={() => {
                      void navigator.clipboard?.writeText(newPassword);
                      toast("info", "Copied to clipboard");
                    }}
                  >
                    <Copy size={13} />
                    Copy
                  </button>
                </div>
              </div>
            ) : (
              <>
                {passwordError && (
                  <div
                    role="alert"
                    className="fadein flex items-start gap-2.5 rounded-lg border border-rose-200 bg-rose-50 px-3.5 py-3 text-xs leading-relaxed text-rose-700"
                  >
                    <ShieldCheck size={15} className="mt-0.5 shrink-0" />
                    <div className="min-w-0">
                      <p className="font-bold">Could not set password</p>
                      <p className="mt-1 break-words">{passwordError}</p>
                    </div>
                  </div>
                )}

                <Field label="Temporary password">
                  <div className="flex gap-2">
                    <Input
                      value={newPassword}
                      onChange={(event) => {
                        setNewPassword(event.target.value);
                        setPasswordError(null);
                      }}
                      className="font-mono"
                    />

                    <button
                      type="button"
                      className="inline-flex shrink-0 items-center justify-center rounded-lg border border-slate-200 px-3 text-slate-500 hover:bg-navy-50 hover:text-navy-700"
                      title="Generate a new password"
                      onClick={() => {
                        setNewPassword(generateTempPassword());
                        setPasswordError(null);
                      }}
                    >
                      <RefreshCw size={15} />
                    </button>
                  </div>

                  <ul className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-[0.7rem]">
                    {PASSWORD_RULES.map(({ key, label }) => {
                      const ok = passwordChecks(newPassword)[key];
                      return (
                        <li
                          key={key}
                          className={ok ? "text-emerald-600" : "text-slate-400"}
                        >
                          {ok ? "✓" : "○"} {label}
                        </li>
                      );
                    })}
                  </ul>
                </Field>

                <div className="flex items-start gap-2.5 rounded-lg bg-amber-50 px-3.5 py-3 text-[0.72rem] leading-relaxed text-amber-800">
                  <ShieldCheck size={15} className="mt-0.5 shrink-0" />
                  This replaces the person&apos;s current password immediately.
                  Their existing sessions are not ended by this action.
                </div>
              </>
            )}
          </div>
        )}
      </Modal>

      {/* Activate / deactivate modal */}
      <Modal
        open={!!toggleTarget}
        onClose={() => setToggleTarget(null)}
        title={toggleTarget?.isActive ? "Deactivate account" : "Activate account"}
        subtitle={
          toggleTarget
            ? `${toggleTarget.fullName} · ${toggleTarget.personnelId}`
            : undefined
        }
        footer={
          <>
            <Button variant="secondary" onClick={() => setToggleTarget(null)}>
              Cancel
            </Button>

            <Button
              variant={toggleTarget?.isActive ? "danger" : "primary"}
              loading={toggling}
              disabled={!reason.trim()}
              onClick={confirmToggle}
            >
              {toggleTarget?.isActive ? "Deactivate" : "Activate"}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <p className="text-sm leading-relaxed text-slate-600">
            {toggleTarget?.isActive
              ? "Deactivated accounts lose access immediately and can no longer use any privileged or self-service features. This action and its reason are recorded in the audit log."
              : "The account will regain access to the personnel self-service portal. This action and its reason are recorded in the audit log."}
          </p>

          <Field
            label="Reason (required)"
            error={
              reason.trim() === "" && reason !== ""
                ? "Enter a reason"
                : undefined
            }
          >
            <textarea
              className="input min-h-20 resize-y"
              placeholder="e.g. De-induction processed on transfer order (demo)"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
            />
          </Field>
        </div>
      </Modal>
    </div>
  );
}