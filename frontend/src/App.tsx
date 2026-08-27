import { Suspense, lazy } from "react";
import { Route, Routes } from "react-router-dom";
import { AppLayout } from "./components/layout/AppLayout";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { AdminRoute } from "./components/AdminRoute";
import { RedirectIfAuthenticated } from "./components/RedirectIfAuthenticated";
import { Spinner } from "./components/ui/Spinner";

// Code-split every page. The camera/liveness pages pull in MediaPipe, so
// keeping them out of the initial bundle noticeably speeds up first paint.
const RegisterPage = lazy(() => import("./pages/RegisterPage"));
const VerifyEmailPage = lazy(() => import("./pages/VerifyEmailPage"));
const EnrollFacePage = lazy(() => import("./pages/EnrollFacePage"));
const LoginPage = lazy(() => import("./pages/LoginPage"));
const VerifyOtpPage = lazy(() => import("./pages/VerifyOtpPage"));
const LivenessPage = lazy(() => import("./pages/LivenessPage"));
const FaceVerifyPage = lazy(() => import("./pages/FaceVerifyPage"));
const DashboardPage = lazy(() => import("./pages/DashboardPage"));
const SecurityPage = lazy(() => import("./pages/SecurityPage"));
const LoginHistoryPage = lazy(() => import("./pages/LoginHistoryPage"));
const AdminDashboardPage = lazy(() => import("./pages/admin/AdminDashboardPage"));
const AdminUsersPage = lazy(() => import("./pages/admin/AdminUsersPage"));
const AdminLogsPage = lazy(() => import("./pages/admin/AdminLogsPage"));
const NotFoundPage = lazy(() => import("./pages/NotFoundPage"));

function PageFallback() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <Spinner className="h-6 w-6 text-brand-600" />
    </div>
  );
}

export default function App() {
  return (
    <Suspense fallback={<PageFallback />}>
      <Routes>
        {/* Auth flow. These live outside the app shell (no navbar). */}
        <Route
          path="/register"
          element={
            <RedirectIfAuthenticated>
              <RegisterPage />
            </RedirectIfAuthenticated>
          }
        />
        <Route
          path="/login"
          element={
            <RedirectIfAuthenticated>
              <LoginPage />
            </RedirectIfAuthenticated>
          }
        />
        <Route path="/verify-email" element={<VerifyEmailPage />} />
        {/* Enrollment is reachable both first-time (enroll token) and while
            logged in (re-enroll), so it is intentionally not redirect-guarded. */}
        <Route path="/enroll-face" element={<EnrollFacePage />} />
        <Route path="/verify-otp" element={<VerifyOtpPage />} />
        <Route path="/liveness" element={<LivenessPage />} />
        <Route path="/face-verify" element={<FaceVerifyPage />} />

        {/* Authenticated app. */}
        <Route element={<ProtectedRoute />}>
          <Route element={<AppLayout />}>
            <Route path="/" element={<DashboardPage />} />
            <Route path="/security" element={<SecurityPage />} />
            <Route path="/history" element={<LoginHistoryPage />} />

            {/* Admin-only, still inside the app shell. */}
            <Route element={<AdminRoute />}>
              <Route path="/admin" element={<AdminDashboardPage />} />
              <Route path="/admin/users" element={<AdminUsersPage />} />
              <Route path="/admin/logs" element={<AdminLogsPage />} />
            </Route>
          </Route>
        </Route>

        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </Suspense>
  );
}
