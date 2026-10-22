import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  ClipboardList,
  Database,
  Eye,
  EyeOff,
  Loader2,
  Lock,
  LogIn,
  Mail,
  MailCheck,
  ScrollText,
  Shield,
  UserRound,
  KeyRound,
  CheckCircle2,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/components/ui";
import { BackendError, getBackend } from "@/lib/backend";

/**
 * Clearly identified TEST account for demonstrations.
 * This only works once the same account exists in your Supabase project
 * (Authentication → Add user with identical email + password, then grant
 * the 'admin' role in user_roles). REMOVE before any real deployment.
 */
const TEST_ADMIN = {
  email: "admin.demo@apams.example",
  password: "Admin@12345",
};

/** Seconds the user must wait before requesting another reset email. */
const RESEND_SECONDS = 60;

function BrandPanel() {
  const points: Array<{ icon: ReactNode; title: string; body: string }> = [
    {
      icon: <ClipboardList size={16} />,
      title: "Daily marking in under a minute",
      body: "Bulk and individual marking with duplicate protection across ~1,000 personnel.",
    },
    {
      icon: <Database size={16} />,
      title: "Database-enforced permissions",
      body: "Row Level Security, server-side role checks and mandatory correction reasons.",
    },
    {
      icon: <ScrollText size={16} />,
      title: "Full audit trail",
      body: "Every sensitive change is logged with actor, timestamp and reason.",
    },
  ];
  return (
    <div className="auth-grid relative hidden w-[46%] flex-col justify-between overflow-hidden bg-gradient-to-br from-navy-950 via-navy-900 to-navy-800 p-10 text-white lg:flex xl:w-1/2">
      <div className="pointer-events-none absolute -right-24 -top-24 h-80 w-80 rounded-full bg-navy-500/20 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-32 -left-16 h-80 w-80 rounded-full bg-emerald-500/10 blur-3xl" />

      <div className="relative flex items-center gap-3">
        <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-white/10 ring-1 ring-white/20">
          <Shield size={22} />
        </span>
        <div className="leading-tight">
          <p className="text-lg font-extrabold tracking-wide">APAMS</p>
          <p className="text-[0.65rem] font-semibold uppercase tracking-[0.18em] text-navy-300">
            Personnel Attendance Management
          </p>
        </div>
      </div>

      <div className="relative">
        <p className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-[0.65rem] font-bold uppercase tracking-[0.16em] text-navy-200 ring-1 ring-white/15">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" /> Demonstration build
        </p>
        <h1 className="mt-5 max-w-md text-4xl font-extrabold leading-[1.12] tracking-tight">
          Attendance for <span className="text-navy-300">~1,000 personnel.</span>
          <br />
          Accountable to the record.
        </h1>
        <p className="mt-4 max-w-md text-[0.92rem] leading-relaxed text-navy-200/90">
          A professional workflow for marking, correcting and auditing daily attendance — built on Supabase Auth,
          PostgreSQL and Row Level Security.
        </p>

        <div className="mt-8 space-y-4">
          {points.map((p) => (
            <div key={p.title} className="flex items-start gap-3.5">
              <span className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/10 text-navy-200 ring-1 ring-white/15">
                {p.icon}
              </span>
              <div>
                <p className="text-sm font-bold">{p.title}</p>
                <p className="mt-0.5 text-xs leading-relaxed text-navy-300/90">{p.body}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <p className="relative text-[0.68rem] leading-relaxed text-navy-300/70">
        Demonstration build — not an officially approved Indian Army system. No official insignia, classified
        information or real personnel records may be used in this deployment.
      </p>
    </div>
  );
}

function AuthShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen">
      <BrandPanel />
      <div className="flex flex-1 items-center justify-center bg-[#eef2f7] px-5 py-10">
        <div className="w-full max-w-md">{children}</div>
      </div>
    </div>
  );
}

export function LoginPage() {
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const user = await signIn(email, password);
      toast("success", `Welcome back, ${user.fullName.split(" ")[0]}`);
      navigate(user.role === "admin" ? "/dashboard" : "/my", { replace: true });
    } catch (err) {
      const msg = err instanceof BackendError ? err.message : "Sign-in failed. Please try again.";
      setError(msg);
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthShell>
      <div className="rise">
        <div className="mb-6 lg:hidden">
          <p className="flex items-center gap-2 text-lg font-extrabold text-navy-950">
            <Shield size={20} className="text-navy-700" /> APAMS
          </p>
          <p className="text-[0.65rem] font-bold uppercase tracking-[0.16em] text-slate-500">
            Personnel Attendance Management · Demo
          </p>
        </div>

        <h2 className="text-2xl font-extrabold tracking-tight text-navy-950">Secure sign-in</h2>
        <p className="mt-1 text-sm text-slate-500">
          Role-based access — Admins manage attendance, personnel view their own records.
        </p>

        <form onSubmit={submit} className="card mt-6 space-y-4 p-6">
          {error && (
            <div className="fadein flex items-start gap-2.5 rounded-lg border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-xs font-semibold leading-relaxed text-rose-700">
              <Lock size={14} className="mt-0.5 shrink-0" />
              {error}
            </div>
          )}

          <label className="block">
            <span className="mb-1.5 block text-[0.8rem] font-semibold text-navy-900">Email</span>
            <div className="relative">
              <Mail size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="email"
                required
                autoComplete="email"
                className="input pl-9"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
          </label>

          <label className="block">
            <span className="mb-1.5 block text-[0.8rem] font-semibold text-navy-900">Password</span>
            <div className="relative">
              <Lock size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type={showPw ? "text" : "password"}
                required
                autoComplete="current-password"
                className="input pl-9 pr-10"
                placeholder="••••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <button
                type="button"
                className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-md p-1 text-slate-400 hover:text-navy-700"
                onClick={() => setShowPw((v) => !v)}
                aria-label={showPw ? "Hide password" : "Show password"}
              >
                {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
          </label>

          <div className="flex items-center justify-between text-xs">
            <span className="font-medium text-slate-400">Authenticated by Supabase Auth</span>
            <Link to="/forgot-password" className="font-bold text-navy-700 hover:text-navy-500 hover:underline">
              Forgot password?
            </Link>
          </div>

          <button
            type="submit"
            disabled={busy}
            className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-navy-800 text-sm font-bold text-white shadow-sm transition-all hover:bg-navy-700 active:scale-[0.99] disabled:opacity-70"
          >
            {busy ? <Loader2 size={16} className="animate-spin" /> : <LogIn size={16} />}
            {busy ? "Verifying credentials…" : "Sign in securely"}
          </button>
        </form>

        {/* Identified test account — shown on the panel for the demo */}
        <div className="rise rise-1 mt-5">
          <p className="text-[0.68rem] font-bold uppercase tracking-[0.14em] text-slate-400">
            Test admin account — tap to fill
          </p>
          <button
            type="button"
            onClick={() => {
              setEmail(TEST_ADMIN.email);
              setPassword(TEST_ADMIN.password);
              setError(null);
            }}
            className="group mt-2 flex w-full items-center gap-3 rounded-xl border border-slate-200 bg-white px-3.5 py-3 text-left transition-all hover:border-navy-400 hover:shadow-sm"
          >
            <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-navy-800 text-white">
              <Shield size={15} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-xs font-extrabold text-navy-950">Administrator (test)</span>
              <span className="block truncate font-mono text-[0.68rem] leading-relaxed text-slate-500">
                {TEST_ADMIN.email}
                <br />
                {TEST_ADMIN.password}
              </span>
            </span>
            <LogIn size={14} className="shrink-0 text-slate-300 transition-colors group-hover:text-navy-600" />
          </button>
          <p className="mt-1.5 text-[0.63rem] leading-relaxed text-slate-400">
            Works once the same account exists in Supabase (Users → Add user with identical email + password, then
            grant the admin role). Remove this card before any real deployment.
          </p>
        </div>

        {/* Two role-based panels */}
        <div className="rise rise-2 mt-5">
          <p className="text-[0.68rem] font-bold uppercase tracking-[0.14em] text-slate-400">
            Two panels — assigned automatically by your account role
          </p>
          <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
            <div className="rounded-xl border border-slate-200 bg-white p-3.5">
              <p className="flex items-center gap-2 text-xs font-extrabold text-navy-950">
                <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-navy-800 text-white">
                  <Shield size={13} />
                </span>
                Admin Panel
              </p>
              <ul className="mt-2 space-y-1 text-[0.68rem] leading-snug text-slate-500">
                <li>· Live dashboard & trends</li>
                <li>· Mark & correct attendance</li>
                <li>· Personnel directory</li>
                <li>· Reports, CSV exports, audit logs</li>
              </ul>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-3.5">
              <p className="flex items-center gap-2 text-xs font-extrabold text-navy-950">
                <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-600 text-white">
                  <UserRound size={13} />
                </span>
                User Panel
              </p>
              <ul className="mt-2 space-y-1 text-[0.68rem] leading-snug text-slate-500">
                <li>· Own attendance (read-only)</li>
                <li>· Monthly calendar & summaries</li>
                <li>· Present / absent / leave counts</li>
                <li>· Profile & password settings</li>
              </ul>
            </div>
          </div>
        </div>

        <p className="mt-5 text-center text-[0.68rem] leading-relaxed text-slate-400">
          Failed sign-ins are rate-limited by the authentication provider.
          <br />
          Access is provisioned by your administrator — there is no self-registration.
        </p>
      </div>
    </AuthShell>
  );
}

export function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [rateLimited, setRateLimited] = useState(false);

  const coolingDown = cooldown > 0;

  // Count down once per second while the resend cooldown is active.
  useEffect(() => {
    if (!coolingDown) return;
    const id = window.setInterval(() => {
      setCooldown((s) => (s <= 1 ? 0 : s - 1));
    }, 1000);
    return () => window.clearInterval(id);
  }, [coolingDown]);

  async function sendLink(address: string) {
    setBusy(true);
    setRateLimited(false);
    try {
      await getBackend().requestPasswordReset(address);
    } catch (err) {
      console.error("Password reset request failed:", err);
      if (err instanceof Error && /rate limit/i.test(err.message)) {
        setRateLimited(true);
      }
    } finally {
      setSent(true);
      setCooldown(RESEND_SECONDS);
      setBusy(false);
    }
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    void sendLink(email);
  }

  function handleResend() {
    if (busy || coolingDown) return;
    void sendLink(email);
  }

  return (
    <AuthShell>
      <div className="rise">
        <Link
          to="/login"
          className="mb-6 inline-flex items-center gap-1.5 text-xs font-bold text-navy-700 hover:text-navy-500"
        >
          <ArrowLeft size={14} /> Back to sign-in
        </Link>

        <h2 className="text-2xl font-extrabold tracking-tight text-navy-950">Reset your password</h2>
        <p className="mt-1 text-sm leading-relaxed text-slate-500">
          Enter your account email. If it exists, password reset instructions are sent through Supabase Auth. For
          security, we never reveal whether an account exists.
        </p>

        <div className="card mt-6 p-6">
          {sent ? (
            <div className="fadein flex flex-col items-center gap-3 py-4 text-center">
              <span className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
                <MailCheck size={22} />
              </span>
              <p className="text-sm font-bold text-navy-950">Check your inbox</p>
              <p className="max-w-xs text-xs leading-relaxed text-slate-500">
                If an account exists for <span className="font-semibold text-navy-900">{email}</span>, a secure reset
                link has been sent. Links expire for your protection.
              </p>

              {rateLimited && (
                <p className="w-full rounded-lg bg-amber-50 px-3 py-2 text-xs font-semibold leading-relaxed text-amber-700">
                  Too many reset emails were requested. Wait a while before trying again.
                </p>
              )}

              <div className="mt-2 w-full border-t border-slate-200 pt-4">
                <p className="text-xs text-slate-500">Didn&apos;t receive the email?</p>
                {coolingDown ? (
                  <p className="mt-2 text-xs font-semibold text-slate-400">
                    Resend available in {cooldown}s
                  </p>
                ) : (
                  <button
                    type="button"
                    onClick={handleResend}
                    disabled={busy}
                    className="mt-2 inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg border border-navy-800 text-sm font-bold text-navy-800 transition-all hover:bg-navy-50 disabled:opacity-70"
                  >
                    {busy ? <Loader2 size={16} className="animate-spin" /> : <Mail size={16} />}
                    {busy ? "Sending…" : "Resend the link"}
                  </button>
                )}
              </div>

              <p className="mt-2 rounded-lg bg-navy-50 px-3 py-2 text-[0.68rem] font-medium leading-relaxed text-navy-700">
                Note: email delivery requires SMTP to be configured in your Supabase project (Authentication → Email).
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <label className="block">
                <span className="mb-1.5 block text-[0.8rem] font-semibold text-navy-900">Account email</span>
                <div className="relative">
                  <Mail
                    size={15}
                    className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                  />
                  <input
                    type="email"
                    required
                    className="input pl-9"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
              </label>
              <button
                type="submit"
                disabled={busy}
                className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-navy-800 text-sm font-bold text-white shadow-sm transition-all hover:bg-navy-700 active:scale-[0.99] disabled:opacity-70"
              >
                {busy ? <Loader2 size={16} className="animate-spin" /> : <Lock size={16} />}
                Send reset instructions
              </button>
            </form>
          )}
        </div>
      </div>
    </AuthShell>
  );
}

/**
 * Password reset page.
 * completePasswordReset() exchanges the recovery code from the URL hash,
 * updates the password, and signs out. refresh() then clears the user in
 * AuthContext so the recovery session cannot open the app.
 */
export function ResetPasswordPage() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { refresh } = useAuth();

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;

    setError(null);

    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setBusy(true);

    try {
      await getBackend().completePasswordReset(password);
      await refresh(); // clears the recovery user from AuthContext
      setSuccess(true);
      toast("success", "Password updated successfully.");
    } catch (err) {
      console.error("Password reset failed:", err);
      setError(
        err instanceof BackendError
          ? err.message
          : "Unable to update your password. Request a new reset link and try again.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthShell>
      <div className="rise">
        <Link
          to="/login"
          className="mb-6 inline-flex items-center gap-1.5 text-xs font-bold text-navy-700 hover:text-navy-500"
        >
          <ArrowLeft size={14} /> Back to sign-in
        </Link>

        <h2 className="text-2xl font-extrabold tracking-tight text-navy-950">
          Create a new password
        </h2>
        <p className="mt-1 text-sm leading-relaxed text-slate-500">
          Choose a strong password with at least 8 characters.
        </p>

        <div className="card mt-6 p-6">
          {success ? (
            <div className="fadein flex flex-col items-center gap-3 py-4 text-center">
              <span className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
                <CheckCircle2 size={24} />
              </span>
              <p className="text-sm font-bold text-navy-950">Password updated</p>
              <p className="text-xs leading-relaxed text-slate-500">
                Your password has been changed successfully. You can now sign in with your new password.
              </p>
              <button
                type="button"
                onClick={() => navigate("/login", { replace: true })}
                className="mt-2 inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-navy-800 text-sm font-bold text-white hover:bg-navy-700"
              >
                <LogIn size={16} /> Return to sign-in
              </button>
            </div>
          ) : (
            <form onSubmit={submit} className="space-y-4">
              {error && (
                <div
                  role="alert"
                  className="fadein rounded-lg border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-xs font-semibold leading-relaxed text-rose-700"
                >
                  {error}
                </div>
              )}

              <label className="block">
                <span className="mb-1.5 block text-[0.8rem] font-semibold text-navy-900">
                  New password
                </span>
                <div className="relative">
                  <Lock
                    size={15}
                    className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                  />
                  <input
                    type={showPassword ? "text" : "password"}
                    required
                    minLength={8}
                    autoComplete="new-password"
                    className="input pl-9 pr-10"
                    placeholder="At least 8 characters"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                  <button
                    type="button"
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-md p-1 text-slate-400 hover:text-navy-700"
                    onClick={() => setShowPassword((v) => !v)}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
              </label>

              <label className="block">
                <span className="mb-1.5 block text-[0.8rem] font-semibold text-navy-900">
                  Confirm new password
                </span>
                <div className="relative">
                  <KeyRound
                    size={15}
                    className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                  />
                  <input
                    type={showPassword ? "text" : "password"}
                    required
                    minLength={8}
                    autoComplete="new-password"
                    className="input pl-9"
                    placeholder="Re-enter your password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                  />
                </div>
              </label>

              <button
                type="submit"
                disabled={busy}
                className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-navy-800 text-sm font-bold text-white shadow-sm transition-all hover:bg-navy-700 active:scale-[0.99] disabled:opacity-70"
              >
                {busy ? <Loader2 size={16} className="animate-spin" /> : <Lock size={16} />}
                {busy ? "Updating password…" : "Update password"}
              </button>
            </form>
          )}
        </div>
      </div>
    </AuthShell>
  );
}