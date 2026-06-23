const AVATAR_COLORS = [
  "bg-blue-500",
  "bg-emerald-500",
  "bg-violet-500",
  "bg-amber-500",
  "bg-rose-500",
  "bg-cyan-500",
  "bg-pink-500",
  "bg-indigo-500",
] as const;

export function getInitials(name: string): string {
  const parts = name.split(" ");
  const initials = parts
    .map((n) => n[0] ?? "")
    .slice(0, 2)
    .join("")
    .toUpperCase();
  return initials || "?";
}

export function getAvatarColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const idx = Math.abs(hash) % AVATAR_COLORS.length;
  return AVATAR_COLORS[idx]!;
}
