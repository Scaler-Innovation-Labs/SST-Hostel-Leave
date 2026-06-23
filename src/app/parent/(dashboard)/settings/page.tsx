"use client";

import { useRouter } from "next/navigation";
import { useEffect,useState } from "react";

import { PageHeader } from "@/components/shared/PageHeader";
import { ROUTES } from "@/constants/routes";

type ParentProfile = {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  relationship: string;
};

export default function ParentSettingsPage() {
  const router = useRouter();
  const [profile, setProfile] = useState<ParentProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/v1/auth/parent/me")
      .then((r) => r.json())
      .then((json) => {
        if (json.success) setProfile(json.data);
      })
      .finally(() => setLoading(false));
  }, []);

  async function handleLogout() {
    await fetch("/api/v1/auth/parent/logout", { method: "POST" });
    router.push(ROUTES.PARENT_LOGIN);
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Settings"
        description="Manage your account preferences."
      />

      <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
        <h2 className="mb-4 text-base font-semibold">Profile</h2>
        <div className="space-y-3">
          {loading ? (
            <p className="text-muted-foreground">Loading...</p>
          ) : profile ? (
            <>
              <div>
                <span className="text-xs text-muted-foreground">Name</span>
                <p className="font-medium">{profile.name}</p>
              </div>
              <div>
                <span className="text-xs text-muted-foreground">Phone</span>
                <p className="font-medium">{profile.phone}</p>
              </div>
              {profile.email && (
                <div>
                  <span className="text-xs text-muted-foreground">Email</span>
                  <p className="font-medium">{profile.email}</p>
                </div>
              )}
              <div>
                <span className="text-xs text-muted-foreground">
                  Relationship
                </span>
                <p className="font-medium capitalize">
                  {profile.relationship}
                </p>
              </div>
            </>
          ) : (
            <p className="text-muted-foreground">Could not load profile.</p>
          )}
        </div>
      </div>

      <button
        onClick={handleLogout}
        className="rounded-lg bg-destructive/10 px-4 py-2 text-sm font-medium text-destructive hover:bg-destructive/20"
      >
        Logout
      </button>
    </div>
  );
}
