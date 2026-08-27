import { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { Spinner } from "./ui/Spinner";

// Keeps already-authenticated users out of the login/register screens.
export function RedirectIfAuthenticated({ children }: { children: ReactNode }) {
  const { isAuthenticated, isBooting } = useAuth();
  if (isBooting) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Spinner className="h-6 w-6 text-brand-600" />
      </div>
    );
  }
  if (isAuthenticated) return <Navigate to="/" replace />;
  return <>{children}</>;
}
