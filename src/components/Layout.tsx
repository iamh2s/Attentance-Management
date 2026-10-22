import { useEffect, useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import {
  BarChart3,
  CalendarCheck,
  ChevronDown,
  History,
  LayoutDashboard,
  LogOut,
  Menu,
  ScrollText,
  Settings,
  ShieldCheck,
  UserRound,
  Users,
  X,
} from "lucide-react";
import { cn } from "@/utils/cn";
import { useAuth } from "@/context/AuthContext";
import { Avatar } from "./ui";
import { fmtDate } from "@/lib/utils";

interface NavItem {
  to: string;
  label: string;
  icon: React.ReactNode;
  section?: string;
}

const ADMIN_NAV: NavItem[] = [
  { to: "/dashboard", label: "Dashboard", icon: <LayoutDashboard size={17} />, section: "Overview" },
  { to: "/personnel", label: "Personnel Directory", icon: <Users size={17} /> },
  { to: "/attendance", label: "Mark Attendance", icon: <CalendarCheck size={17} />, section: "Operations" },
  { to: "/history", label: "Attendance History", icon: <History size={17} /> },
  { to: "/reports", label: "Reports & Exports", icon: <BarChart3 size={17} /> },
  { to: "/audit", label: "Audit Logs", icon: <ScrollText size={17} />, section: "Security" },
  { to: "/settings", label: "Security Settings", icon: <Settings size={17} /> },
];

const PERSONNEL_NAV: NavItem[] = [
  { to: "/my", label: "My Dashboard", icon: <LayoutDashboard size={17} />, section: "Self Service" },
  { to: "/my/attendance", label: "My Attendance", icon: <CalendarCheck size={17} /> },
  { to: "/my/profile", label: "My Profile", icon: <UserRound size={17} /> },
  { to: "/settings", label: "Security Settings", icon: <Settings size={17} />, section: "Account" },
];

function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const nav = user?.role === "admin" ? ADMIN_NAV : PERSONNEL_NAV;

  let lastSection: string | undefined;
  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-3 px-5 pb-5 pt-6">
        <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-navy-500 to-navy-800 text-white shadow-lg shadow-navy-950/40 ring-1 ring-white/20">
          <ShieldCheck size={20} />
        </span>
        <div className="leading-tight">
          <p className="text-[0.95rem] font-extrabold tracking-wide text-white">APAMS</p>
          <p className="text-[0.62rem] font-semibold uppercase tracking-[0.14em] text-navy-300">
            Attendance System · Demo
          </p>
        </div>
      </div>

      <nav className="dark-scroll flex-1 overflow-y-auto px-3 pb-4">
        {nav.map((item) => {
          const showSection = item.section && item.section !== lastSection;
          lastSection = item.section ?? lastSection;
          return (
            <div key={item.to}>
              {showSection && (
                <p className="mb-1 mt-4 px-3 text-[0.6rem] font-bold uppercase tracking-[0.16em] text-navy-400/80 first:mt-0">
                  {item.section}
                </p>
              )}
              <NavLink
                to={item.to}
                end={item.to === "/my"}
                onClick={onNavigate}
                className={({ isActive }) =>
                  cn(
                    "group mb-0.5 flex items-center gap-3 rounded-lg px-3 py-2.5 text-[0.83rem] font-semibold transition-all duration-150",
                    isActive
                      ? "bg-white/10 text-white shadow-inner ring-1 ring-white/10"
                      : "text-navy-200/80 hover:bg-white/5 hover:text-white"
                  )
                }
              >
                <span className="opacity-80">{item.icon}</span>
                {item.label}
              </NavLink>
            </div>
          );
        })}
      </nav>

      <div className="border-t border-white/10 p-3.5">
        <div className="flex items-center gap-3 rounded-xl bg-white/[0.06] px-3 py-2.5 ring-1 ring-white/10">
          <Avatar name={user?.fullName ?? "?"} size="sm" />
          <div className="min-w-0 flex-1 leading-tight">
            <p className="truncate text-[0.78rem] font-bold text-white">{user?.fullName}</p>
            <p className="text-[0.62rem] font-semibold uppercase tracking-wider text-navy-300">
              {user?.role === "admin" ? "Administrator" : "Personnel"}
            </p>
          </div>
          <button
            className="rounded-lg p-1.5 text-navy-300 transition-colors hover:bg-white/10 hover:text-white"
            title="Sign out"
            onClick={async () => {
              await signOut();
              navigate("/login");
              onNavigate?.();
            }}
          >
            <LogOut size={15} />
          </button>
        </div>
        <p className="mt-3 px-1 text-center text-[0.6rem] font-medium leading-relaxed text-navy-400/70">
          Demonstration build — not an officially approved system.
        </p>
      </div>
    </div>
  );
}

export default function AppLayout() {
  const [drawer, setDrawer] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const { user, signOut } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    setDrawer(false);
    setMenuOpen(false);
  }, [location.pathname]);

  const title =
    [...ADMIN_NAV, ...PERSONNEL_NAV].find((n) =>
      n.to === "/my" ? location.pathname === "/my" : location.pathname.startsWith(n.to)
    )?.label ?? "APAMS";

  return (
    <div className="flex h-full min-h-screen">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col bg-gradient-to-b from-navy-950 via-navy-900 to-navy-950 lg:flex">
        <SidebarContent />
      </aside>

      {/* Mobile drawer */}
      {drawer && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="fadein absolute inset-0 bg-navy-950/60 backdrop-blur-sm" onClick={() => setDrawer(false)} />
          <aside className="absolute inset-y-0 left-0 w-72 bg-gradient-to-b from-navy-950 via-navy-900 to-navy-950 shadow-2xl">
            <button
              className="absolute right-3 top-4 z-10 rounded-lg p-1.5 text-navy-300 hover:bg-white/10 hover:text-white"
              onClick={() => setDrawer(false)}
              aria-label="Close menu"
            >
              <X size={18} />
            </button>
            <SidebarContent onNavigate={() => setDrawer(false)} />
          </aside>
        </div>
      )}

      {/* Main column */}
      <div className="flex min-w-0 flex-1 flex-col lg:pl-64">
        {/* Demo banner */}
        <div className="flex items-center justify-center gap-2 bg-navy-950 px-4 py-1.5 text-center">
          <ShieldCheck size={12} className="shrink-0 text-navy-300" />
          <p className="text-[0.68rem] font-semibold tracking-wide text-navy-200">
            DEMO BUILD — not an officially approved Indian Army system · no classified or real data
          </p>
        </div>

        {/* Topbar */}
        <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b border-slate-200 bg-white/85 px-4 backdrop-blur-md sm:px-6">
          <button
            className="rounded-lg p-2 text-navy-800 hover:bg-navy-100/70 lg:hidden"
            onClick={() => setDrawer(true)}
            aria-label="Open menu"
          >
            <Menu size={19} />
          </button>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-[0.95rem] font-extrabold tracking-tight text-navy-950">{title}</h1>
          </div>
          <p className="hidden text-xs font-semibold text-slate-500 sm:block">{fmtDate(new Date().toISOString().slice(0, 10))}</p>
          <div className="relative">
            <button
              className="flex items-center gap-2 rounded-full border border-slate-200 bg-white py-1 pl-1 pr-2 shadow-sm transition-colors hover:border-navy-300"
              onClick={() => setMenuOpen((v) => !v)}
            >
              <Avatar name={user?.fullName ?? "?"} size="sm" />
              <span className="hidden max-w-28 truncate text-xs font-bold text-navy-900 md:block">
                {user?.fullName?.replace(/\(.*?\)/g, "").trim()}
              </span>
              <ChevronDown size={13} className={cn("text-slate-400 transition-transform", menuOpen && "rotate-180")} />
            </button>
            {menuOpen && (
              <div className="fadein absolute right-0 top-full mt-2 w-52 overflow-hidden rounded-xl border border-slate-200 bg-white py-1.5 shadow-pop">
                <div className="border-b border-slate-100 px-4 py-2.5">
                  <p className="truncate text-xs font-bold text-navy-950">{user?.fullName}</p>
                  <p className="truncate text-[0.68rem] text-slate-500">{user?.email}</p>
                </div>
                <button
                  className="flex w-full items-center gap-2.5 px-4 py-2 text-left text-xs font-semibold text-navy-900 hover:bg-navy-50"
                  onClick={() => {
                    setMenuOpen(false);
                    navigate("/settings");
                  }}
                >
                  <Settings size={14} className="text-slate-400" /> Security settings
                </button>
                <button
                  className="flex w-full items-center gap-2.5 px-4 py-2 text-left text-xs font-semibold text-rose-700 hover:bg-rose-50"
                  onClick={async () => {
                    await signOut();
                    navigate("/login");
                  }}
                >
                  <LogOut size={14} /> Sign out
                </button>
              </div>
            )}
          </div>
        </header>

        <main className="mx-auto w-full max-w-[1400px] flex-1 px-4 py-6 sm:px-6 lg:px-8">
          <Outlet />
        </main>

        <footer className="border-t border-slate-200 bg-white/60 px-6 py-4">
          <p className="text-center text-[0.68rem] font-medium leading-relaxed text-slate-400">
            APAMS demonstration build · Not an officially approved Indian Army system · No real personnel data, insignia,
            or operational details are used.
          </p>
        </footer>
      </div>
    </div>
  );
}
