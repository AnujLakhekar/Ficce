"use client";

import { onAuthStateChanged, User } from "firebase/auth";
import React, { useEffect, useState } from "react";
import { auth } from "@/lib/firebase";
import Loader from "@/components/ui/loader";
import { usePathname, useRouter } from "next/navigation";

type AuthGuardProps = {
  children: React.ReactNode;
  requireAuth?: boolean;
};

const AuthGuard = ({ children, requireAuth = true }: AuthGuardProps) => {
  const [user, setUser] = useState<User | null | undefined>(undefined);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (user === undefined) {
      return;
    }

    if (requireAuth && user === null && pathname !== "/auth") {
      router.replace("/auth");
      return;
    }

    if (!requireAuth && user !== null && pathname.startsWith("/auth")) {
      router.replace("/dashboard");
    }
  }, [user, requireAuth, pathname, router]);

  if (user === undefined) {
    return <Loader content="Loading..." />;
  }

  if (requireAuth && user === null) {
    return <Loader content="Redirecting..." />;
  }

  if (!requireAuth && user !== null) {
    return null;
  }

  return <>{children}</>;
};

export default AuthGuard;
