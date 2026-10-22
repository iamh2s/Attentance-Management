import { useState, type FormEvent } from "react";
import { Clock, Fingerprint, KeyRound, Lock, LogOut, MonitorSmartphone, ShieldCheck } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { BackendError, getBackend } from "@/lib/backend";
import { Badge, Button, useToast } from "@/components/ui";

export default function SettingsPage() {
  const { user, signOut } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);

  async function changePassword(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    if (next !== confirm) {
      toast("error", "Passwords do not match", "Re-enter the new password in both fields.");
      return;
    }
    setBusy(true);
    try {
      await getBackend().changePassword(current, next);
      toast("success", "Password changed", "Your new password is active for all future sign-ins.");
      setCurrent("");
      setNext("");
      setConfirm("");
    } catch (err) {
      toast("error", "Could not change password", err instanceof BackendError ? err.message : undefined);
    } finally {
      setBusy(false);
    }
  }

  const mismatch = confirm.length > 0 && next !== confirm;

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <div className="rise">
        <h2 className="text-xl font-extrabold tracking-tight text-navy-950 sm:text-2xl">Security & account settings</h2>
        <p className="mt-1 text-xs font-medium text-slate-500 sm:text-sm">
          Manage your credentials and review the protections applied to your account
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Change password */}
        <form onSubmit={changePassword} className="card rise rise-1 space-y-4 p-5">
          <div className="flex items-center gap-3">
            <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-navy-800 text-white">
              <KeyRound size={17} />
            </span>
            <div>
              <h3 className="text-[0.95rem] font-bold text-navy-950">Change password</h3>
              <p className="text-xs text-slate-500">Minimum 8 characters · handled by Supabase Auth</p>
            </div>
          </div>

          <label className="block">
            <span className="mb-1.5 block text-[0.8rem] font-semibold text-navy-900">Current password</span>
            <input
              type="password"
              required
              autoComplete="current-password"
              className="input"
              value={current}
              onChange={(e) => setCurrent(e.target.value)}
            />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-[0.8rem] font-semibold text-navy-900">New password</span>
            <input
              type="password"
              required
              minLength={8}
              autoComplete="new-password"
              className="input"
              value={next}
              onChange={(e) => setNext(e.target.value)}
            />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-[0.8rem] font-semibold text-navy-900">Confirm new password</span>
            <input
              type="password"
              required
              autoComplete="new-password"
              className={`input ${mismatch ? "border-rose-400 focus:border-rose-500" : ""}`}
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
            />
            {mismatch && <span className="mt-1 block text-xs font-semibold text-rose-600">Passwords do not match</span>}
          </label>
          <Button type="submit" loading={busy} disabled={mismatch} className="w-full">
            {busy ? "Updating…" : "Update password"}
          </Button>
        </form>

        {/* Protections overview */}
        <div className="space-y-4">
          <div className="card rise rise-2 p-5">
            <div className="flex items-center gap-3">
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-600 text-white">
                <ShieldCheck size={17} />
              </span>
              <div>
                <h3 className="text-[0.95rem] font-bold text-navy-950">Account protections</h3>
                <p className="text-xs text-slate-500">Enforced by Supabase Auth + Row Level Security</p>
              </div>
            </div>
            <ul className="mt-4 space-y-3">
              {[
                {
                  icon: <Lock size={14} />,
                  title: "Authenticated access only",
                  body: "All private pages and database rows require a valid session — RLS denies anonymous access to every private table.",
                },
                {
                  icon: <Fingerprint size={14} />,
                  title: "Role-based authorisation",
                  body: `Signed in as ${user?.role === "admin" ? "an Administrator" : "Personnel"} — permissions are verified server-side (RLS + SECURITY DEFINER RPCs), never from browser-supplied roles.`,
                },
                {
                  icon: <Clock size={14} />,
                  title: "Session & credential safety",
                  body: "Tokens are handled by Supabase Auth with automatic refresh. Password policies and sign-in rate limiting are configured at the identity provider.",
                },
                {
                  icon: <MonitorSmartphone size={14} />,
                  title: "Admin MFA (where configured)",
                  body: "Multi-factor authentication for admin accounts can be enforced in the Supabase dashboard (TOTP) for deployments that require it.",
                },
              ].map((f) => (
                <li key={f.title} className="flex items-start gap-3">
                  <span className="mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-navy-50 text-navy-700">
                    {f.icon}
                  </span>
                  <div>
                    <p className="text-xs font-bold text-navy-950">{f.title}</p>
                    <p className="mt-0.5 text-[0.7rem] leading-relaxed text-slate-500">{f.body}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>

          <div className="card rise rise-3 p-5">
            <h3 className="text-[0.95rem] font-bold text-navy-950">Session</h3>
            <dl className="mt-3 space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <dt className="font-semibold text-slate-500">Signed in as</dt>
                <dd className="font-bold text-navy-950">{user?.email}</dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="font-semibold text-slate-500">Role</dt>
                <dd>
                  <Badge tone={user?.role === "admin" ? "navy" : "green"}>
                    {user?.role === "admin" ? "Administrator" : "Personnel"}
                  </Badge>
                </dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="font-semibold text-slate-500">Backend</dt>
                <dd className="font-mono text-[0.7rem] font-bold text-navy-900">Supabase</dd>
              </div>
            </dl>
            <div className="mt-4">
              <Button
                variant="secondary"
                size="sm"
                icon={<LogOut size={13} />}
                onClick={async () => {
                  await signOut();
                  navigate("/login");
                }}
              >
                Sign out everywhere
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
