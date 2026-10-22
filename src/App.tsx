import { HashRouter, Navigate, Route, Routes } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import { ToastProvider } from "@/components/ui";
import AppLayout from "@/components/Layout";
import { isSupabaseConfigured } from "@/lib/backend";
import SetupRequired from "@/pages/Setup";
import {
  ForgotPasswordPage,
  LoginPage,
  ResetPasswordPage,
} from "@/pages/Auth";
import AdminDashboard from "@/pages/admin/Dashboard";
import PersonnelDirectory from "@/pages/admin/PersonnelDirectory";
import MarkAttendance from "@/pages/admin/MarkAttendance";
import AdminHistoryPage from "@/pages/admin/History";
import ReportsPage from "@/pages/admin/Reports";
import AuditLogsPage from "@/pages/admin/AuditLogs";
import {
  MyAttendancePage,
  MyProfilePage,
  PersonnelDashboard,
} from "@/pages/personnel/Personnel";
import SettingsPage from "@/pages/Settings";

function FullScreenLoader() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-[#eef2f7] text-slate-400">
      <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-navy-900 text-white shadow-lg">
        <Loader2 size={22} className="animate-spin" />
      </span>
      <p className="text-sm font-semibold">
        Establishing secure session…
      </p>
    </div>
  );
}

function RequireAuth({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, loading } = useAuth();

  if (loading) return <FullScreenLoader />;
  if (!user) return <Navigate to="/login" replace />;

  return <>{children}</>;
}

function RequireRole({
  role,
  children,
}: {
  role: "admin" | "personnel";
  children: React.ReactNode;
}) {
  const { user, loading } = useAuth();

  if (loading) return <FullScreenLoader />;
  if (!user) return <Navigate to="/login" replace />;

  if (user.role !== role) {
    return (
      <Navigate
        to={user.role === "admin" ? "/dashboard" : "/my"}
        replace
      />
    );
  }

  return <>{children}</>;
}

function RoleHome() {
  const { user } = useAuth();

  return (
    <Navigate
      to={user?.role === "admin" ? "/dashboard" : "/my"}
      replace
    />
  );
}

export default function App() {
  if (!isSupabaseConfigured) {
    return <SetupRequired />;
  }

  return (
    <HashRouter>
      <ToastProvider>
        <AuthProvider>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route
              path="/forgot-password"
              element={<ForgotPasswordPage />}
            />
            <Route
              path="/reset-password"
              element={<ResetPasswordPage />}
            />

            <Route
              element={
                <RequireAuth>
                  <AppLayout />
                </RequireAuth>
              }
            >
              <Route index element={<RoleHome />} />

              <Route
                path="/dashboard"
                element={
                  <RequireRole role="admin">
                    <AdminDashboard />
                  </RequireRole>
                }
              />
              <Route
                path="/personnel"
                element={
                  <RequireRole role="admin">
                    <PersonnelDirectory />
                  </RequireRole>
                }
              />
              <Route
                path="/attendance"
                element={
                  <RequireRole role="admin">
                    <MarkAttendance />
                  </RequireRole>
                }
              />
              <Route
                path="/history"
                element={
                  <RequireRole role="admin">
                    <AdminHistoryPage />
                  </RequireRole>
                }
              />
              <Route
                path="/reports"
                element={
                  <RequireRole role="admin">
                    <ReportsPage />
                  </RequireRole>
                }
              />
              <Route
                path="/audit"
                element={
                  <RequireRole role="admin">
                    <AuditLogsPage />
                  </RequireRole>
                }
              />

              <Route
                path="/my"
                element={
                  <RequireRole role="personnel">
                    <PersonnelDashboard />
                  </RequireRole>
                }
              />
              <Route
                path="/my/attendance"
                element={
                  <RequireRole role="personnel">
                    <MyAttendancePage />
                  </RequireRole>
                }
              />
              <Route
                path="/my/profile"
                element={
                  <RequireRole role="personnel">
                    <MyProfilePage />
                  </RequireRole>
                }
              />

              <Route
                path="/settings"
                element={<SettingsPage />}
              />
            </Route>

            <Route
              path="*"
              element={<Navigate to="/" replace />}
            />
          </Routes>
        </AuthProvider>
      </ToastProvider>
    </HashRouter>
  );
}