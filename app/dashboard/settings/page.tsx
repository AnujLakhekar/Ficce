"use client";

import React from "react";
import toast from "react-hot-toast";
import { onAuthStateChanged } from "firebase/auth";
import { auth, getUserSettings, updateUserSettings } from "@/lib/firebase";

export default function Page() {
  const [uid, setUid] = React.useState<string | null>(null);
  const [currency, setCurrency] = React.useState("USD");
  const [language, setLanguage] = React.useState("en");
  const [emailNotifications, setEmailNotifications] = React.useState(true);
  const [isSaving, setIsSaving] = React.useState(false);

  React.useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        setUid(null);
        return;
      }

      setUid(user.uid);

      try {
        const settings = await getUserSettings(user.uid);
        setCurrency(settings.currency);
        setLanguage(settings.language);
        setEmailNotifications(settings.emailNotifications);
      } catch (error) {
        console.error("Settings load error:", error);
      }
    });

    return () => unsubscribe();
  }, []);

  const handleSave = async () => {
    if (!uid) {
      toast.error("Please sign in first");
      return;
    }

    setIsSaving(true);

    try {
      await updateUserSettings(uid, {
        currency,
        language,
        emailNotifications,
      });
      toast.success("Settings updated");
    } catch (error) {
      toast.error("Failed to update settings");
      console.error("Settings update error:", error);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <section className="rounded-2xl border border-outline bg-forground text-text">
      <div className="border-b border-outline px-5 py-4">
        <h1 className="text-2xl font-semibold">Settings</h1>
        <p className="mt-1 text-sm text-text-secondary">Control account-level preferences used across your workspace.</p>
      </div>

      <div className="grid grid-cols-1 gap-3 px-4 py-4 md:grid-cols-3">
        <select
          className="h-11 rounded-xl border border-outline bg-secondary px-3 text-sm outline-none focus:border-hover"
          onChange={(event) => setCurrency(event.target.value)}
          value={currency}
        >
          <option value="USD">USD</option>
          <option value="INR">INR</option>
          <option value="EUR">EUR</option>
        </select>

        <select
          className="h-11 rounded-xl border border-outline bg-secondary px-3 text-sm outline-none focus:border-hover"
          onChange={(event) => setLanguage(event.target.value)}
          value={language}
        >
          <option value="en">English</option>
          <option value="hi">Hindi</option>
        </select>

        <label className="inline-flex h-11 items-center gap-2 rounded-xl border border-outline bg-secondary px-3 text-sm">
          <input
            checked={emailNotifications}
            onChange={(event) => setEmailNotifications(event.target.checked)}
            type="checkbox"
          />
          Email Notifications
        </label>
      </div>

      <div className="border-t border-outline px-4 py-4">
        <button
          className="h-10 rounded-xl bg-text px-4 text-sm font-medium text-forground hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
          disabled={isSaving || !uid}
          onClick={() => void handleSave()}
          type="button"
        >
          {isSaving ? "Saving..." : "Save Settings"}
        </button>
      </div>
    </section>
  );
}
