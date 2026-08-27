import { useState } from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import { LayoutDashboard, LogOut, Menu, Shield, ShieldCheck, History, X } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { config } from "../../config";
import { cn } from "../../utils/cn";
import { Button } from "../ui/Button";

const linkClass = ({ isActive }: { isActive: boolean }) =>
  cn(
    "relative flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-semibold tracking-wide transition-all duration-200",
    isActive
      ? "bg-brand-50 text-brand-700 shadow-sm ring-1 ring-brand-200/60"
      : "text-slate-600 hover:bg-slate-100/80 hover:text-slate-900"
  );

export function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  const onLogout = async () => {
    await logout();
    navigate("/login", { replace: true });
  };

  return (
    <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-white/80 backdrop-blur-xl shadow-sm transition-all">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        <Link to="/" className="flex items-center gap-2.5 group">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-tr from-brand-600 to-indigo-600 text-white shadow-md shadow-brand-500/20 transition-transform duration-300 group-hover:scale-105">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <div className="flex flex-col">
            <span className="text-sm font-bold tracking-tight text-slate-900 leading-none">
              {config.appName}
            </span>
            <span className="text-[10px] font-medium text-slate-400">AI Multi-Factor</span>
          </div>
        </Link>

        <nav className="hidden items-center gap-1.5 md:flex">
          <NavLink to="/" end className={linkClass}>
            <LayoutDashboard className="h-3.5 w-3.5" />
            Dashboard
          </NavLink>
          <NavLink to="/security" className={linkClass}>
            <Shield className="h-3.5 w-3.5" />
            Security
          </NavLink>
          <NavLink to="/history" className={linkClass}>
            <History className="h-3.5 w-3.5" />
            Activity
          </NavLink>
          {user?.is_admin && (
            <NavLink to="/admin" className={linkClass}>
              <span className="flex h-1.5 w-1.5 rounded-full bg-brand-500 animate-ping" />
              Admin
            </NavLink>
          )}
        </nav>

        <div className="hidden items-center gap-3 md:flex">
          <div className="flex items-center gap-2 rounded-full border border-slate-200/80 bg-slate-50/80 px-3 py-1.5 text-xs text-slate-600">
            <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="max-w-[150px] truncate font-medium">{user?.email}</span>
          </div>
          <Button variant="secondary" size="sm" onClick={onLogout}>
            <LogOut className="h-3.5 w-3.5" /> Sign out
          </Button>
        </div>

        <button
          className="rounded-xl p-2 text-slate-600 hover:bg-slate-100 md:hidden"
          onClick={() => setOpen((v) => !v)}
          aria-label="Toggle menu"
        >
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {open && (
        <div className="animate-slide-down border-t border-slate-100 bg-white/95 px-4 py-4 backdrop-blur-lg md:hidden">
          <div className="flex flex-col gap-1.5">
            <NavLink to="/" end className={linkClass} onClick={() => setOpen(false)}>
              <LayoutDashboard className="h-4 w-4" />
              Dashboard
            </NavLink>
            <NavLink to="/security" className={linkClass} onClick={() => setOpen(false)}>
              <Shield className="h-4 w-4" />
              Security
            </NavLink>
            <NavLink to="/history" className={linkClass} onClick={() => setOpen(false)}>
              <History className="h-4 w-4" />
              Activity
            </NavLink>
            {user?.is_admin && (
              <NavLink to="/admin" className={linkClass} onClick={() => setOpen(false)}>
                Admin
              </NavLink>
            )}
            <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-3">
              <span className="truncate text-xs text-slate-500">{user?.email}</span>
              <Button variant="secondary" size="sm" onClick={onLogout}>
                <LogOut className="h-3.5 w-3.5" /> Sign out
              </Button>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
