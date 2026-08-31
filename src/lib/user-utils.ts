const AVATAR_COLORS = [
  "bg-accent",
  "bg-success",
  "bg-accent",
  "bg-warning",
  "bg-danger",
  "bg-accent",
  "bg-danger",
  "bg-accent",
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
