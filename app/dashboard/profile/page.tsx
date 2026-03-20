"use client";

import React from "react";
import toast from "react-hot-toast";
import { onAuthStateChanged } from "firebase/auth";
import { auth, getUserByUid, updateUserProfile } from "@/lib/firebase";

export default function Page() {
  const [uid, setUid] = React.useState<string | null>(null);
  const [name, setName] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [phone, setPhone] = React.useState("");
  const [company, setCompany] = React.useState("");
  const [isSaving, setIsSaving] = React.useState(false);

  React.useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        setUid(null);
        return;
      }

      setUid(user.uid);
      setEmail(user.email ?? "");

      try {
        const userDoc = await getUserByUid(user.uid);
        setName(String(userDoc.name ?? ""));
        setPhone(String(userDoc.phone ?? ""));
        setCompany(String(userDoc.company ?? ""));
        setEmail(String(userDoc.email ?? user.email ?? ""));
      } catch {
        // Keep auth values if user document is not fully initialized.
      }
    });

    return () => unsubscribe();
  }, []);

  const handleSave = async () => {
    if (!uid) {
      toast.error("Please sign in first");
      return;
    }

    if (!name.trim()) {
      toast.error("Name is required");
      return;
    }

    setIsSaving(true);

    try {
      await updateUserProfile(uid, {
        name: name.trim(),
        email: email.trim(),
        phone: phone.trim(),
        company: company.trim(),
      });
      toast.success("Profile updated");
    } catch (error) {
      toast.error("Failed to update profile");
      console.error("Profile update error:", error);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <section className="rounded-2xl border border-outline bg-forground text-text">
      <div className="border-b border-outline px-5 py-4">
        <h1 className="text-2xl font-semibold">Profile</h1>
        <p className="mt-1 text-sm text-text-secondary">Update your personal and business details.</p>
      </div>

      <div className="grid grid-cols-1 gap-3 px-4 py-4 md:grid-cols-2">
        <input
          className="h-11 rounded-xl border border-outline bg-secondary px-3 text-sm outline-none focus:border-hover"
          onChange={(event) => setName(event.target.value)}
          placeholder="Full Name"
          value={name}
        />
        <input
          className="h-11 rounded-xl border border-outline bg-secondary px-3 text-sm outline-none focus:border-hover"
          onChange={(event) => setEmail(event.target.value)}
          placeholder="Email"
          type="email"
          value={email}
        />
        <input
          className="h-11 rounded-xl border border-outline bg-secondary px-3 text-sm outline-none focus:border-hover"
          onChange={(event) => setPhone(event.target.value)}
          placeholder="Phone"
          value={phone}
        />
        <input
          className="h-11 rounded-xl border border-outline bg-secondary px-3 text-sm outline-none focus:border-hover"
          onChange={(event) => setCompany(event.target.value)}
          placeholder="Company"
          value={company}
        />
      </div>

      <div className="border-t border-outline px-4 py-4">
        <button
          className="h-10 rounded-xl bg-text px-4 text-sm font-medium text-forground hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
          disabled={isSaving || !uid}
          onClick={() => void handleSave()}
          type="button"
        >
          {isSaving ? "Saving..." : "Save Profile"}
        </button>
      </div>
    </section>
  );
}
