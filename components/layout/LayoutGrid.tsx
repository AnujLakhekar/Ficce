"use client";

import React, { ReactNode } from "react";
import { usePathname } from "next/navigation";
import Navbar from "@/components/ui/Navbar";
import SidePanel from "@/components/ui/SidePanel";

interface LayoutGridProps {
  children: ReactNode;
}

const SIDEBAR_EXPANDED_WIDTH = 240;
const SIDEBAR_COLLAPSED_WIDTH = 80;
const SIDEBAR_STORAGE_KEY = "ficce.sidebar.collapsed";

const LayoutGrid = ({ children }: LayoutGridProps) => {
  const pathname = usePathname();
  const [isSidebarCollapsed, setIsSidebarCollapsed] = React.useState(true);

  const toggleSidebar = React.useCallback(() => {
    setIsSidebarCollapsed((prev) => {
      const next = !prev;
      try {
        window.localStorage.setItem(SIDEBAR_STORAGE_KEY, String(next));
      } catch {
        // Ignore storage errors to avoid breaking UI interactions.
      }
      return next;
    });
  }, []);

  React.useEffect(() => {
    try {
      const saved = window.localStorage.getItem(SIDEBAR_STORAGE_KEY);
      if (saved !== null) {
        setIsSidebarCollapsed(saved === "true");
      }
    } catch {
      // Ignore storage errors and keep default state.
    }
  }, []);

  React.useEffect(() => {
    try {
      const saved = window.localStorage.getItem(SIDEBAR_STORAGE_KEY);
      if (saved !== null) {
        const next = saved === "true";
        setIsSidebarCollapsed((prev) => (prev === next ? prev : next));
      }
    } catch {
      // Ignore storage errors and keep current state.
    }
  }, [pathname]);

  const sidebarWidth = isSidebarCollapsed
    ? SIDEBAR_COLLAPSED_WIDTH
    : SIDEBAR_EXPANDED_WIDTH;

  return (
    <div className="h-screen flex">
      <aside
        className="fixed left-0 top-0 bottom-0 bg-forground border-r border-outline overflow-y-auto z-40"
        style={{
          width: `${sidebarWidth}px`,
          transition: "width 250ms ease-in-out",
        }}
      >
        <SidePanel isCollapsed={isSidebarCollapsed} />
      </aside>

      {/* Right Section - Navbar and Content */}
      <div
        className="flex-1 flex flex-col"
        style={{
          marginLeft: `${sidebarWidth}px`,
          transition: "margin-left 250ms ease-in-out",
        }}
      >
        {/* Fixed Navbar */}
        <div className="h-[70px] bg-forground border-b border-outline z-50">
          <Navbar
            isSidebarCollapsed={isSidebarCollapsed}
            onToggleSidebar={toggleSidebar}
          />
        </div>

        {/* Scrollable Content Area */}
        <div className="flex-1 overflow-y-auto bg-background">
          <div className="p-6">{children}</div>
        </div>
      </div>
    </div>
  );
};

export default LayoutGrid;
