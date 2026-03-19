"use client";

import { onAuthStateChanged, User } from "firebase/auth";
import React, { useEffect, useState } from "react";
import { auth } from "@/lib/firebase";
import Loader from "@/components/ui/loader";

const AuthGuard = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null | undefined>(undefined);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user); 
    });

    return () => unsubscribe(); 
  }, []);

  if (user === undefined) {
    return <Loader content="Loading..." />;
  }

  if (user === null) {
    return <Loader content="Please login" />;
  }

  return <>{children}</>;
};

export default AuthGuard;