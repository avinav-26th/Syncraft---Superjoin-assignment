import React, { useState } from 'react';
import Image from 'next/image';
import { RefreshCw, LogOut, Moon, User } from 'lucide-react';
import { useSession, signOut } from "next-auth/react";

interface HeaderProps {
  title: string | null;
  isLive: boolean;
  isFetching: boolean;
  isLoading: boolean;
  activeUsers: string[];
  onRefresh: () => void;
}

export default function Header({ title, isLive, isFetching, isLoading, activeUsers, onRefresh }: HeaderProps) {
  const { data: session } = useSession();
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showActiveUsers, setShowActiveUsers] = useState(false);

  // Filter out current user from "Active" list
  const otherUsers = activeUsers.filter((email) => email !== session?.user?.email);

  return (
    <div className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-6 shadow-sm z-20 relative" 
         onClick={() => { setShowUserMenu(false); setShowActiveUsers(false); }}>
      
      {/* LEFT: Title & Live Status */}
      <div className="flex items-center gap-4">
        <h2 className="text-lg font-bold text-slate-800">{title || "Dashboard"}</h2>
        {isLive && !isFetching && (
            <span className="flex items-center gap-1.5 px-2 py-0.5 bg-emerald-50 text-emerald-600 text-xs font-bold uppercase rounded-full border border-emerald-100">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              Live
            </span>
        )}
        {isFetching && !isLoading && <span className="text-xs text-blue-500 animate-pulse font-medium">Updating...</span>}
      </div>

      {/* RIGHT: Controls */}
      <div className="flex items-center gap-4">
        {/* Active Users Stack */}
        {otherUsers.length > 0 && (
          <div className="relative">
            <div 
              className="flex -space-x-2 cursor-pointer hover:scale-105 transition-transform"
              onClick={(e) => { e.stopPropagation(); setShowActiveUsers(!showActiveUsers); }}
            >
              {otherUsers.slice(0, 3).map((email, i) => (
                <div key={i} className="w-8 h-8 rounded-full bg-blue-100 border-2 border-white flex items-center justify-center text-xs font-bold text-blue-600 shadow-sm" title={email}>
                  {email[0].toUpperCase()}
                </div>
              ))}
              {otherUsers.length > 3 && (
                <div className="w-8 h-8 rounded-full bg-slate-100 border-2 border-white flex items-center justify-center text-xs font-bold text-slate-500 shadow-sm">
                  +{otherUsers.length - 3}
                </div>
              )}
            </div>
            {/* Active Users Dropdown */}
            {showActiveUsers && (
              <div className="absolute top-full right-0 mt-2 w-64 bg-white rounded-lg shadow-xl border border-slate-100 p-2 z-50 animate-in fade-in zoom-in-95 duration-200">
                <p className="text-xs font-bold text-slate-400 uppercase px-2 py-1 mb-1">Recent Contributors</p>
                {otherUsers.map((email) => (
                  <a key={email} href={`mailto:${email}`} className="block px-2 py-2 text-sm text-slate-700 hover:bg-slate-50 rounded-md truncate transition-colors">
                    {email}
                  </a>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Refresh Button */}
        <button onClick={onRefresh} className="p-2 hover:bg-slate-100 rounded-full text-slate-500 hover:text-blue-600 transition-all">
          <RefreshCw size={18} className={isFetching ? "animate-spin text-blue-500" : ""} />
        </button>

        {/* User Menu */}
        <div className="relative ml-2 border-l pl-4 border-slate-200">
          <button 
            onClick={(e) => { e.stopPropagation(); setShowUserMenu(!showUserMenu); }}
            className="relative w-9 h-9 rounded-full overflow-hidden border border-slate-200 hover:ring-2 ring-blue-100 transition-all"
          >
            {session?.user?.image ? (
              <Image src={session.user.image} alt="User" fill className="object-cover" />
            ) : (
              <div className="w-full h-full bg-blue-600 text-white flex items-center justify-center font-bold text-sm">
                {session?.user?.email?.[0].toUpperCase() || "A"}
              </div>
            )}
          </button>

          {showUserMenu && (
            <div className="absolute top-full right-0 mt-2 w-56 bg-white rounded-lg shadow-xl border border-slate-100 p-2 z-50 animate-in fade-in zoom-in-95 duration-200">
              <div className="px-3 py-2 border-b border-slate-100 mb-2">
                <p className="text-sm font-bold text-slate-800 truncate">{session?.user?.name}</p>
                <p className="text-xs text-slate-500 truncate">{session?.user?.email}</p>
              </div>
              <button onClick={() => signOut()} className="w-full text-left px-3 py-2 text-sm text-red-600 hover:bg-red-50 rounded-md flex items-center gap-2 transition-colors mt-1">
                <LogOut size={14} /> Sign Out
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}