import React from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Navigate, Outlet, Link, useLocation } from 'react-router-dom';
import { LogOut, LayoutDashboard, Calendar, Search, Users, Shield, Briefcase, FileText } from 'lucide-react';
import { cn } from '../lib/utils';

export const Layout = () => {
  const { user, profile, loading, signOut } = useAuth();
  const location = useLocation();

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center bg-[#0A0A0A] text-[#FFFFFF] font-mono">Loading Sandbox...</div>;
  }

  if (!user || !profile) {
    return <Navigate to="/login" replace />;
  }

  const role = profile.role;

  const links = [
    { to: "/", label: "Dashboard", icon: LayoutDashboard, roles: ["Admin", "Facilitator", "Reviewer", "Requestor", "Watcher", "Participant", "Guest"] },
    { to: "/search", label: "Search", icon: Search, roles: ["Admin", "Facilitator", "Reviewer", "Requestor", "Watcher", "Participant", "Guest"] },
    { to: "/calendar", label: "Calendar", icon: Calendar, roles: ["Admin", "Facilitator", "Reviewer"] },
    { to: "/projects", label: "Projects", icon: Briefcase, roles: ["Requestor", "Facilitator", "Participant", "Reviewer", "Watcher", "Admin"] },
    { to: "/users", label: "User Management", icon: Users, roles: ["Admin"] },
  ];

  const filteredLinks = links.filter(link => link.roles.includes(role));

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

        <div className="p-4 border-t border-[#262626]">
          <div className="mb-4">
            <p className="font-bold text-sm truncate">{profile.name}</p>
            <p className="text-[11px] text-[#999999] truncate">{profile.email}</p>
            <span className="inline-block px-2 py-1 mt-2 bg-[#FF3D00] text-white text-[11px] font-bold uppercase rounded-sm tracking-tight">
              {role}
            </span>
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
