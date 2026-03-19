"use client";

import React from "react";
import { onAuthStateChanged, signOut, type User } from "firebase/auth";
import { LogOut, Settings, UserCircle2 } from "lucide-react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { auth } from "@/lib/firebase";

const getInitials = (name: string, email: string) => {
  if (name.trim()) {
    return name
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? "")
      .join("");
  }

  return (email[0] ?? "U").toUpperCase();
};

const ProfileMenu = () => {
  const router = useRouter();
  const menuRef = React.useRef<HTMLDivElement | null>(null);

  const [user, setUser] = React.useState<User | null>(null);
  const [isOpen, setIsOpen] = React.useState(false);
  const [isLoggingOut, setIsLoggingOut] = React.useState(false);

  React.useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (nextUser) => {
      setUser(nextUser);
    });

    return () => unsubscribe();
  }, []);

  React.useEffect(() => {
    const onDocumentClick = (event: MouseEvent) => {
      if (!menuRef.current) return;

      if (!menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", onDocumentClick);
    return () => document.removeEventListener("mousedown", onDocumentClick);
  }, []);

  const displayName = user?.displayName || "Guest User";
  const displayEmail = user?.email || "Not signed in";
  const avatarText = getInitials(user?.displayName ?? "", user?.email ?? "");

  const handleLogout = async () => {
    if (!user) {
      toast.error("No active session found.");
      return;
    }

    setIsLoggingOut(true);
    const loadingToast = toast.loading("Signing out...");

    try {
      await signOut(auth);
      toast.dismiss(loadingToast);
      toast.success("Logged out successfully.");
      setIsOpen(false);
      router.push("/auth");
    } catch (error) {
      toast.dismiss(loadingToast);
      toast.error("Failed to log out. Please try again.");
      console.error("Logout error:", error);
    } finally {
      setIsLoggingOut(false);
    }
  };

  return (
    <div className="relative" ref={menuRef}>
      <button
        aria-expanded={isOpen}
        aria-haspopup="menu"
        className="h-9 w-9 rounded-[10px] bg-gradient-to-br from-blue-500 to-blue-700 text-forground font-semibold text-sm hover:opacity-90 transition"
        onClick={() => setIsOpen((prev) => !prev)}
        type="button"
      >
        {avatarText}
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-64 rounded-xl border border-outline bg-forground shadow-[0_10px_30px_rgba(0,0,0,0.08)] z-[60]">
          <div className="px-4 py-3 border-b border-outline">
            <p className="text-sm font-semibold text-text truncate">{displayName}</p>
            <p className="text-xs text-text-secondary truncate">{displayEmail}</p>
          </div>

          <div className="p-2">
            <button
              className="w-full flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-text hover:bg-secondary transition"
              onClick={() => {
                setIsOpen(false);
                router.push("/dashboard/profile");
              }}
              type="button"
            >
              <UserCircle2 size={16} />
              Profile
            </button>

            <button
              className="w-full flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-text hover:bg-secondary transition"
              onClick={() => {
                setIsOpen(false);
                router.push("/dashboard/settings");
              }}
              type="button"
            >
              <Settings size={16} />
              Settings
            </button>

            <button
              className="w-full flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-red-600 hover:bg-red-50 transition disabled:opacity-60"
              disabled={isLoggingOut}
              onClick={handleLogout}
              type="button"
            >
              <LogOut size={16} />
              {isLoggingOut ? "Signing out..." : "Logout"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProfileMenu;