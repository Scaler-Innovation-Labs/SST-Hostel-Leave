import { currentUser } from "@clerk/nextjs/server";
import Image from "next/image";

export default async function ProfilePage() {
  const user = await currentUser();

  return (
    <div className="max-w-3xl">
      <h1 className="text-3xl font-semibold">
        Profile
      </h1>

      <div
        className="
          mt-8 rounded-3xl
          border border-border
          bg-card p-6
        "
      >
        <div className="flex items-center gap-5">
          <Image
            src={user?.imageUrl}
            alt="Profile"
            width={80}
            height={80}
            className="
              size-20 rounded-full
            "
          />

          <div>
            <h2 className="text-xl font-medium">
              {user?.fullName}
            </h2>

            <p className="mt-1 text-muted-foreground">
              {
                user?.primaryEmailAddress
                  ?.emailAddress
              }
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}