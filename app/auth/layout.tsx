"use client";

import React from "react";

interface DashboardLayoutProps {
  children: React.ReactNode;
}

const AuthLayout = ({ children }: DashboardLayoutProps) => {
  return <div>{children}</div>;
};

export default AuthLayout;
