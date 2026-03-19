"use client";

import React from "react";
import LayoutGrid from "@/components/layout/LayoutGrid";

interface DashboardLayoutProps {
  children: React.ReactNode;
}

const DashboardLayout = ({ children }: DashboardLayoutProps) => {
  return <LayoutGrid>{children}</LayoutGrid>;
};

export default DashboardLayout;
