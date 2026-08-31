import { currentUser } from "@clerk/nextjs/server";
import { Mail, User } from "lucide-react";
import Image from "next/image";

import { PageHeader } from "@/components/shared/PageHeader";
import { SectionCard, TECH_LABEL } from "@/design-system/sst";

export default async function ProfilePage() {
  const user = await currentUser();

  const name = user?.fullName ?? "Your account";
  const email = user?.primaryEmailAddress?.emailAddress ?? "No email on file";

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Account"
        title="Your profile"
        description="What the platform knows about you. Your name and photo come from your institutional Google account."
      />

      <SectionCard Icon={User} title="Account details">
        <div className="flex flex-wrap items-center gap-5">
          {user?.imageUrl ? (
            <Image
              src={user.imageUrl}
              alt=""
              width={80}
              height={80}
              className="h-20 w-20 shrink-0 rounded-full object-cover ring-1 ring-inset ring-border"
            />
          ) : (
            <span className="flex h-20 w-20 shrink-0 items-center justify-center rounded-full bg-accent-light text-accent ring-1 ring-inset ring-accent/10">
              <User className="h-8 w-8" aria-hidden />
            </span>
          )}

          <dl className="min-w-0 space-y-3">
            <div>
              <dt className={TECH_LABEL}>Name</dt>
              <dd className="mt-0.5 text-body-lg font-semibold text-ink">
                {name}
              </dd>
            </div>
            <div>
              <dt className={TECH_LABEL}>Email</dt>
              <dd className="mt-0.5 flex items-center gap-1.5 text-body text-muted">
                <Mail className="h-4 w-4 shrink-0" aria-hidden />
                {email}
              </dd>
            </div>
          </dl>
        </div>

        <p className="mt-6 border-t border-border pt-4 text-caption text-muted">
          To change your name or photo, update your Google account. Roles and
          hostel assignments are managed by the hostel office.
        </p>
      </SectionCard>
    </div>
  );
}
