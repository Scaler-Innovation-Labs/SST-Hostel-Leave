type StatCardProps = {
  label: string;
  value: string;
  helperText?: string;
};

export function StatCard({
  label,
  value,
  helperText,
}: StatCardProps) {
  return (
    <div
      className="
        rounded-2xl border border-border
        bg-card p-6
      "
    >
      <p className="text-sm text-muted-foreground">
        {label}
      </p>

      <h3 className="mt-3 text-3xl font-bold tracking-tight">
        {value}
      </h3>

      {helperText && (
        <p className="mt-2 text-sm text-muted-foreground">
          {helperText}
        </p>
      )}
    </div>
  );
}