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
const MOBILE_SIDEBAR_WIDTH = 280;
const MOBILE_BREAKPOINT = 1024;
const SIDEBAR_STORAGE_KEY = "ficce.sidebar.collapsed";

const LayoutGrid = ({ children }: LayoutGridProps) => {
  const pathname = usePathname();
  const [isSidebarCollapsed, setIsSidebarCollapsed] = React.useState(true);
  const [isMobile, setIsMobile] = React.useState(false);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = React.useState(false);

  const toggleSidebar = React.useCallback(() => {
    if (isMobile) {
      setIsMobileSidebarOpen((prev) => !prev);
      return;
    }

    setIsSidebarCollapsed((prev) => {
      const next = !prev;
      try {
        window.localStorage.setItem(SIDEBAR_STORAGE_KEY, String(next));
      } catch {
        // Ignore storage errors to avoid breaking UI interactions.
      }
      return next;
    });
  }, [isMobile]);

  React.useEffect(() => {
    const mediaQuery = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`);

    const syncViewport = () => {
      setIsMobile(mediaQuery.matches);
      if (!mediaQuery.matches) {
        setIsMobileSidebarOpen(false);
      }
    };

    syncViewport();
    mediaQuery.addEventListener("change", syncViewport);

    return () => mediaQuery.removeEventListener("change", syncViewport);
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

  React.useEffect(() => {
    if (isMobile) {
      setIsMobileSidebarOpen(false);
    }
  }, [pathname, isMobile]);

  React.useEffect(() => {
    if (!isMobile) {
      return;
    }

    document.body.style.overflow = isMobileSidebarOpen ? "hidden" : "";

    return () => {
      document.body.style.overflow = "";
    };
  }, [isMobile, isMobileSidebarOpen]);

  const sidebarWidth = isSidebarCollapsed
    ? SIDEBAR_COLLAPSED_WIDTH
    : SIDEBAR_EXPANDED_WIDTH;

  return (
    <div className="flex h-screen overflow-hidden">
      {isMobile && isMobileSidebarOpen && (
        <button
          aria-label="Close sidebar"
          className="fixed inset-0 z-30 bg-black/40"
          onClick={() => setIsMobileSidebarOpen(false)}
          type="button"
        />
      )}

      <aside
        className="fixed bottom-0 left-0 top-0 z-40 overflow-y-auto border-r border-outline bg-forground"
        style={{
          width: `${isMobile ? MOBILE_SIDEBAR_WIDTH : sidebarWidth}px`,
          transition: "width 250ms ease-in-out, transform 250ms ease-in-out",
          transform: isMobile
            ? isMobileSidebarOpen
              ? "translateX(0)"
              : "translateX(-100%)"
            : "translateX(0)",
        }}
      >
        <SidePanel isCollapsed={isMobile ? false : isSidebarCollapsed} />
      </aside>

      {/* Right Section - Navbar and Content */}
      <div
        className="flex flex-1 flex-col"
        style={{
          marginLeft: isMobile ? "0px" : `${sidebarWidth}px`,
          transition: "margin-left 250ms ease-in-out",
        }}
      >
        {/* Fixed Navbar */}
        <div className="h-17.5 bg-forground border-b border-outline z-50">
          <Navbar
            isSidebarCollapsed={isSidebarCollapsed}
            onToggleSidebar={toggleSidebar}
          />
        </div>

        {/* Scrollable Content Area */}
        <div className="flex-1 overflow-y-auto bg-background">
          <div className="p-4 md:p-6">{children}</div>
        </div>
      </div>
    </div>
  );
};

export default LayoutGrid;
