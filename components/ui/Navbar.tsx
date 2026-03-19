"use client";

import React from "react";
import { usePathname } from "next/navigation";
import {
  Search,
  Grid3x3,
  Paperclip,
  Bell,
  ChevronRight,
  PanelLeftClose,
  PanelLeftOpen,
} from "lucide-react";
import Link from "next/link";
import ProfileMenu from "@/components/ui/ProfileMenu";

interface NavbarProps {
  isSidebarCollapsed: boolean;
  onToggleSidebar: () => void;
  bellColor?: string;

}

const Navbar = ({ isSidebarCollapsed, onToggleSidebar, bellColor = "red" }: NavbarProps) => {
  const pathname = usePathname();
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  const segments = mounted ? (pathname ?? "").split("/").filter(Boolean) : [];

  return (
    <nav className="h-[70px] bg-forground border-b border-outline flex items-center justify-between px-6">
      {/* Left Side - Breadcrumb */}
      <div className="flex items-center gap-3 min-w-0">
        <button
          aria-label="Toggle sidebar"
          className="p-2 hover:bg-secondary rounded-lg transition text-text"
          onClick={onToggleSidebar}
          type="button"
        >
          {isSidebarCollapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
        </button>

        {segments.length > 0 ? (
          <div className="flex items-center gap-2 text-sm text-text truncate">
            {segments.map((seg, i) => {
              return (
                <div key={i}>
                  {i === 2 ? (
                    <div>...</div>
                  ) : (
                    i < 2 && (
                      <div className="flex items-center gap-2 justify-center">
                        <span
                          className={
                            "font-medium" +
                            (i === segments.length - 1
                              ? " text-text"
                              : " text-text opacity-60")
                          }
                        >
                          <Link href={`/${segments.slice(0, i + 1).join("/")}`}>
                            {seg.charAt(0).toUpperCase() + seg.slice(1)}
                          </Link>
                        </span>
                        {i !== segments.length - 1 && (
                          <span className="text-text opacity-50">
                            <ChevronRight size={18} color="black" />
                          </span>
                        )}
                      </div>
                    )
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-sm font-medium text-text">Dashboard</p>
        )}
      </div>

      {/* Middle - Search Bar */}
      <div className="flex-1 max-w-md mx-8">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search..."
            className="w-full pl-10 pr-4 py-2 bg-secondary border border-outline rounded-lg text-sm text-text placeholder-text placeholder-opacity-50 focus:outline-none focus:bg-forground focus:border-hover transition"
          />
        </div>
      </div>

      {/* Right Side - Icons and Avatar */}
      <div className="flex items-center gap-4">
        {/* Grid Icon */}
        <button className="p-2 hover:bg-secondary rounded-lg transition text-text">
          <Grid3x3 className="w-5 h-5" />
        </button>

        {/* Paperclip Icon */}
        <button className="p-2 hover:bg-secondary rounded-lg transition text-text">
          <Paperclip className="w-5 h-5" />
        </button>

        {/* Bell Icon */}
        <button className="p-2 hover:bg-secondary rounded-lg transition text-text relative">
          <Bell className="w-5 h-5" />
          <span className={"absolute top-1 right-1 w-2 h-2 rounded-full "} style={{
            background: bellColor,
          }}></span>
        </button>

        {/* Divider */}
        <div className="w-px h-6 bg-outline"></div>

        <ProfileMenu />
      </div>
    </nav>
  );
};

export default Navbar;
