"use client";

import AuthGuard from "@/providers/Middleware";
import React from "react";

interface DashboardLayoutProps {
  children: React.ReactNode;
}

const AuthLayout = ({ children }: DashboardLayoutProps) => {
  return (
    <AuthGuard requireAuth={false}>
      <div>{children}</div>
    </AuthGuard>
  );
};

export default AuthLayout;
