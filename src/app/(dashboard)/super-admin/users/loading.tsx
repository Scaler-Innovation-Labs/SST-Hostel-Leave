export default function UsersLoading() {
  return (
    <div className="space-y-6">
      <div className="h-8 w-32 animate-pulse rounded-lg bg-muted" />
      <div className="flex gap-3">
        <div className="h-8 w-64 animate-pulse rounded-lg bg-muted" />
        <div className="h-8 w-32 animate-pulse rounded-lg bg-muted" />
        <div className="h-8 w-32 animate-pulse rounded-lg bg-muted" />
      </div>
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-12 animate-pulse rounded-lg bg-muted" />
        ))}
      </div>
    </div>
  );
}
