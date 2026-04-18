import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Navigate, Outlet, Link, useLocation } from 'react-router-dom';
import { LogOut, LayoutDashboard, Calendar, Search, Users, Shield, Briefcase, FileText, ChevronUp, RotateCcw } from 'lucide-react';
import { cn } from '../lib/utils';

export const Layout = () => {
  const { user, profile, loading, signOut, testRole, setTestRole, originalRole } = useAuth();
  const location = useLocation();
  const [showRoleSwitcher, setShowRoleSwitcher] = useState(false);
  const switcherRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (switcherRef.current && !switcherRef.current.contains(event.target as Node)) {
        setShowRoleSwitcher(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center bg-[#0A0A0A] text-[#FFFFFF] font-mono">Loading Sandbox...</div>;
  }

  if (!user || !profile) {
    return <Navigate to="/login" replace />;
  }

  const role = profile.role;
  const isTesting = !!testRole;

  const links = [
    { to: "/", label: "Dashboard", icon: LayoutDashboard, roles: ["Admin", "Facilitator", "Reviewer", "Requestor", "Watcher", "Participant", "Guest"] },
    { to: "/calendar", label: "Calendar", icon: Calendar, roles: ["Admin", "Facilitator", "Reviewer", "Requestor", "Watcher", "Participant", "Guest"] },
    { to: "/projects", label: "Projects", icon: Briefcase, roles: ["Requestor", "Facilitator", "Participant", "Reviewer", "Watcher", "Admin"] },
    { to: "/users", label: "User Management", icon: Users, roles: ["Admin"] },
    { to: "/settings", label: "Settings", icon: Shield, roles: ["Admin"] },
  ];

  const filteredLinks = links.filter(link => link.roles.includes(role));

  const roles: ("Admin" | "Facilitator" | "Reviewer" | "Requestor" | "Participant" | "Watcher" | "Guest")[] = [
    "Admin", "Facilitator", "Reviewer", "Requestor", "Participant", "Watcher", "Guest"
  ];

  return (
    <div className="flex h-screen bg-[#0A0A0A] font-sans text-[#FFFFFF]">
      {/* Sidebar */}
      <aside className="w-64 border-r border-[#262626] bg-[#0A0A0A] flex flex-col pt-4">
        <div className="px-6 pb-6 border-b border-[#262626]">
          <h1 className="font-bold text-3xl tracking-tighter flex items-center gap-2 text-[#FF3D00]">
            <Shield className="w-6 h-6" />
            UXDR
          </h1>
          <span className="font-mono text-[11px] text-[#999999] uppercase tracking-wider block mt-1">Design Review System</span>
        </div>

        <nav className="flex-1 py-4 flex flex-col gap-1 px-4">
          {filteredLinks.map(link => (
            <Link
              key={link.to}
              to={link.to}
              className={cn(
                "flex items-center gap-3 px-3 py-2 rounded-md font-medium text-[13px] uppercase tracking-wider transition-colors",
                location.pathname === link.to 
                  ? "bg-[#141414] text-[#FFFFFF]" 
                  : "text-[#999999] hover:bg-[#141414]"
              )}
            >
              <link.icon className="w-4 h-4" />
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="p-4 border-t border-[#262626] relative" ref={switcherRef}>
          <div className="mb-4">
            <p className="font-bold text-sm truncate">{profile.name}</p>
            <p className="text-[11px] text-[#999999] truncate">{profile.email}</p>
            <div className="flex items-center gap-2 mt-2">
              <span className={cn(
                "inline-block px-2 py-1 bg-[#FF3D00] text-white text-[11px] font-bold uppercase rounded-sm tracking-tight",
                isTesting && "bg-[#555555] border border-[#FF3D00]"
              )}>
                {role} {isTesting && "(Testing)"}
              </span>
              
              {/* Testing role switcher - only show in dev */}
              {process.env.NODE_ENV !== 'production' && (
                <button 
                  onClick={() => setShowRoleSwitcher(!showRoleSwitcher)}
                  className="p-1 hover:bg-[#262626] rounded-sm transition-colors text-[#999999] hover:text-white"
                >
                  <ChevronUp className={cn("w-3 h-3 transition-transform", showRoleSwitcher && "rotate-180")} />
                </button>
              )}
            </div>

            {showRoleSwitcher && (
              <div className="absolute bottom-full left-4 mb-2 w-56 bg-[#141414] border border-[#262626] rounded shadow-2xl z-50 overflow-hidden animate-in fade-in slide-in-from-bottom-2">
                <div className="p-2 border-b border-[#262626]">
                  <button 
                    onClick={() => {
                      setTestRole(null);
                      setShowRoleSwitcher(false);
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-[11px] font-bold uppercase tracking-wider text-[#999999] hover:text-white hover:bg-[#262626] rounded transition-colors"
                  >
                    <RotateCcw className="w-3 h-3" />
                    Reset to {originalRole}
                  </button>
                </div>
                <div className="max-h-48 overflow-y-auto py-1 custom-scrollbar">
                  {roles.map(r => (
                    <button
                      key={r}
                      onClick={() => {
                        setTestRole(r);
                        setShowRoleSwitcher(false);
                      }}
                      className={cn(
                        "w-full text-left px-4 py-2 text-[12px] font-medium transition-colors hover:bg-[#262626]",
                        role === r ? "text-[#FF3D00] bg-[#1A1A1A]" : "text-[#999999]"
                      )}
                    >
                      {r}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
          <button 
            onClick={signOut}
            className="flex items-center gap-2 text-[12px] font-bold text-[#999999] hover:text-[#FFFFFF] uppercase tracking-wider transition-colors w-full text-left mt-4"
          >
            <LogOut className="w-4 h-4" />
            Sign Out
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto bg-[#0A0A0A]">
        <Outlet />
      </main>
    </div>
  );
};
