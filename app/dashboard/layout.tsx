"use client";

import React from "react";
import LayoutGrid from "@/components/layout/LayoutGrid";
import AuthGuard from "@/providers/Middleware";

interface DashboardLayoutProps {
  children: React.ReactNode;
}

const DashboardLayout = ({ children }: DashboardLayoutProps) => {
  return (
    <AuthGuard>
      <LayoutGrid>{children}</LayoutGrid>
    </AuthGuard>
  );
};

export default DashboardLayout;
