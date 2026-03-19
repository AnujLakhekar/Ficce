"use client";

import React from "react";
import { onAuthStateChanged, signOut, type User } from "firebase/auth";
import { LogOut, Settings, UserCircle2 } from "lucide-react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { auth, getUserByUid } from "@/lib/firebase";
import {
  Menubar,
  MenubarContent,
  MenubarGroup,
  MenubarItem,
  MenubarMenu,
  MenubarSeparator,
  MenubarShortcut,
  MenubarTrigger,
} from "@/components/ui/menubar";

type UserDoc = {
  name?: string;
  email?: string;
};

const getInitials = (name: string, email: string) => {
  if (name.trim()) {
    return name
      .split(" ")
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase() ?? "")
      .join("");
  }
  return (email[0] ?? "U").toUpperCase();
};

const ProfileMenu = () => {
  const router = useRouter();

  const [user, setUser] = React.useState<UserDoc | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [isLoggingOut, setIsLoggingOut] = React.useState(false);

  React.useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (nextUser) => {
      try {
        if (!nextUser) {
          setUser(null);
          setLoading(false);
          return;
        }

        const userData = await getUserByUid(nextUser.uid);
        setUser(userData);
      } catch (error) {
        console.error("User fetch error:", error);
        toast.error("Failed to load user");
      } finally {
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  if (loading) {
    return <div className="h-9 w-9 rounded bg-gray-200 animate-pulse" />;
  }

  const displayName = user?.name || "Guest User";
  const displayEmail = user?.email || "Not signed in";
  const avatarText = getInitials(user?.name ?? "", user?.email ?? "");

  const handleLogout = async () => {
    setIsLoggingOut(true);
    const loadingToast = toast.loading("Signing out...");

    try {
      await signOut(auth);
      toast.dismiss(loadingToast);
      toast.success("Logged out");
      router.push("/auth");
    } catch (error) {
      toast.dismiss(loadingToast);
      toast.error("Logout failed");
    } finally {
      setIsLoggingOut(false);
    }
  };

  return (
    <Menubar className="h-auto border-0 p-0 bg-transparent shadow-none">
      <MenubarMenu>
        <MenubarTrigger className="p-0 rounded-[10px]">
          <div className="h-9 w-9 rounded-[10px] bg-gradient-to-br from-blue-500 to-blue-700 text-white font-semibold text-sm flex items-center justify-center">
            {avatarText}
          </div>
        </MenubarTrigger>

        <MenubarContent align="end" className="w-64">
          <div className="px-3 py-2">
            <p className="text-sm font-semibold truncate">{displayName}</p>
            <p className="text-xs text-muted-foreground truncate">{displayEmail}</p>
          </div>

          <MenubarSeparator />

          <MenubarGroup>
            <MenubarItem onClick={() => router.push("/dashboard/profile")}>
              <UserCircle2 /> Profile
            </MenubarItem>
            <MenubarItem onClick={() => router.push("/dashboard/settings")}>
              <Settings /> Settings
            </MenubarItem>
          </MenubarGroup>

          <MenubarSeparator />

          <MenubarItem
            className="text-red-600"
            disabled={isLoggingOut}
            onClick={handleLogout}
          >
            <LogOut />
            {isLoggingOut ? "Signing out..." : "Logout"}
          </MenubarItem>
        </MenubarContent>
      </MenubarMenu>
    </Menubar>
  );
};

export default ProfileMenu;