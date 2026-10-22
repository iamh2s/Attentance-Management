import { useState } from "react";
import { Check, CheckCircle2, Circle, Copy, Database, KeyRound, PlayCircle, Shield, ShieldCheck, TerminalSquare } from "lucide-react";
import { supabaseEnvStatus } from "@/lib/backend";
import { cn } from "@/utils/cn";

const ENV_SNIPPET = `VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-public-key`;

function CopyChip({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard?.writeText(text);
        } catch {
          /* clipboard unavailable — user can select manually */
        }
        setCopied(true);
        window.setTimeout(() => setCopied(false), 1600);
      }}
      className="inline-flex items-center gap-1.5 rounded-md bg-white/10 px-2 py-1 text-[0.65rem] font-bold text-navy-100 ring-1 ring-white/15 transition-colors hover:bg-white/20"
      title="Copy to clipboard"
    >
      {copied ? <Check size={11} className="text-emerald-300" /> : <Copy size={11} />}
      {copied ? "Copied" : "Copy"}
    </button>
  );
}

function Step({
  n,
  icon,
  title,
  children,
}: {
  n: number;
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <li className="flex items-start gap-4">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-navy-800 text-sm font-extrabold text-white shadow-sm">
        {n}
      </span>
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-2 text-sm font-bold text-navy-950">
          <span className="text-navy-500">{icon}</span>
          {title}
        </p>
        <div className="mt-1.5 text-[0.8rem] leading-relaxed text-slate-500">{children}</div>
      </div>
    </li>
  );
}

export default function SetupRequired() {
  const { url, anonKey } = supabaseEnvStatus;
  const missing = [!url && "VITE_SUPABASE_URL", !anonKey && "VITE_SUPABASE_ANON_KEY"].filter(Boolean) as string[];

  return (
    <div className="auth-grid relative flex min-h-screen items-center justify-center overflow-hidden bg-gradient-to-br from-navy-950 via-navy-900 to-navy-800 p-5">
      <div className="pointer-events-none absolute -right-24 -top-24 h-80 w-80 rounded-full bg-navy-500/20 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-32 -left-16 h-80 w-80 rounded-full bg-emerald-500/10 blur-3xl" />

      <div className="rise relative w-full max-w-2xl">
        <div className="mb-6 text-center text-white">
          <span className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-white/10 ring-1 ring-white/20">
            <Shield size={26} />
          </span>
          <h1 className="mt-4 text-2xl font-extrabold tracking-tight sm:text-3xl">Connect your Supabase project</h1>
          <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-navy-200/90">
            APAMS ships with no predefined data or demo accounts — every record comes from your own Supabase database.
            Add your project keys to go live.
          </p>
        </div>

        {/* Missing-var status */}
        <div className="mb-4 flex flex-wrap items-center justify-center gap-2">
          <span
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 font-mono text-[0.68rem] font-bold ring-1",
              url ? "bg-emerald-400/10 text-emerald-300 ring-emerald-300/30" : "bg-rose-400/10 text-rose-300 ring-rose-300/30"
            )}
          >
            {url ? <CheckCircle2 size={12} /> : <Circle size={12} />}
            VITE_SUPABASE_URL {url ? "· set" : "· missing"}
          </span>
          <span
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 font-mono text-[0.68rem] font-bold ring-1",
              anonKey
                ? "bg-emerald-400/10 text-emerald-300 ring-emerald-300/30"
                : "bg-rose-400/10 text-rose-300 ring-rose-300/30"
            )}
          >
            {anonKey ? <CheckCircle2 size={12} /> : <Circle size={12} />}
            VITE_SUPABASE_ANON_KEY {anonKey ? "· set" : "· missing"}
          </span>
        </div>

        <div className="rounded-2xl bg-white p-6 shadow-pop sm:p-8">
          <ol className="space-y-6">
            <Step n={1} icon={<Database size={15} />} title="Create a Supabase project">
              Sign in at <span className="font-mono font-semibold text-navy-800">supabase.com</span>, create a project,
              then open{" "}
              <span className="font-semibold text-navy-800">Project Settings → API</span> to find your Project URL and
              anon public key.
            </Step>

            <Step n={2} icon={<ShieldCheck size={15} />} title="Run the database migration">
              In the Supabase dashboard open <span className="font-semibold text-navy-800">SQL Editor</span> and run{" "}
              <span className="font-mono text-[0.72rem] font-semibold text-navy-800">supabase/migrations/0001_init.sql</span>.
              It creates the tables, indexes, unique constraints, Row Level Security policies, audit triggers and the
              trusted server-side RPCs the app uses for privileged operations.
            </Step>

            <Step n={3} icon={<KeyRound size={15} />} title="Add the keys to your environment">
              <p>
                Set these variables (<span className="font-semibold text-navy-800">.env.local</span> for development,
                or your host's environment settings for deployment):
              </p>
              <div className="relative mt-2.5 rounded-xl bg-navy-950 p-4 pr-16">
                <pre className="overflow-x-auto font-mono text-[0.72rem] leading-relaxed text-navy-100">{ENV_SNIPPET}</pre>
                <span className="absolute right-2.5 top-2.5">
                  <CopyChip text={ENV_SNIPPET} />
                </span>
              </div>
              <p className="mt-2 flex items-start gap-1.5 text-[0.72rem] text-slate-400">
                <ShieldCheck size={13} className="mt-0.5 shrink-0 text-emerald-600" />
                The anon key is designed to be public — authorisation is enforced by RLS. Never set the service-role
                key as a VITE_ variable.
              </p>
            </Step>

            <Step n={4} icon={<PlayCircle size={15} />} title="Restart and create your first admin">
              <p>
                Restart the dev server (or rebuild for deployment). Then create the administrator in
                <span className="font-semibold text-navy-800"> Authentication → Users → Add user</span> and grant the
                role in the SQL Editor:
              </p>
              <div className="relative mt-2.5 rounded-xl bg-navy-950 p-4 pr-16">
                <pre className="overflow-x-auto font-mono text-[0.72rem] leading-relaxed text-navy-100">
{`insert into public.user_roles (user_id, role)
values ('PASTE-USER-UUID', 'admin');`}
                </pre>
                <span className="absolute right-2.5 top-2.5">
                  <CopyChip
                    text={"insert into public.user_roles (user_id, role)\nvalues ('PASTE-USER-UUID', 'admin');"}
                  />
                </span>
              </div>
            </Step>
          </ol>

          <div className="mt-7 flex items-start gap-2.5 rounded-xl border border-navy-100 bg-navy-50/70 px-4 py-3 text-[0.72rem] leading-relaxed text-navy-800">
            <TerminalSquare size={15} className="mt-0.5 shrink-0" />
            <span>
              {missing.length > 0
                ? `Waiting for ${missing.join(" and ")}. Once the environment is set and the app restarts, this screen is replaced by the secure sign-in automatically.`
                : "Environment detected — restarting will load the secure sign-in."}{" "}
              Full instructions: <span className="font-mono font-semibold">README.md → Setup with Supabase</span>.
            </span>
          </div>
        </div>

        <p className="mt-5 text-center text-[0.65rem] leading-relaxed text-navy-300/70">
          Demonstration build — not an officially approved Indian Army system. No official insignia, classified or real
          personnel data may be used.
        </p>
      </div>
    </div>
  );
}
