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
      <p className="text-body text-muted">
        {label}
      </p>

      <h3 className="mt-3 text-h1 font-semibold tracking-tight">
        {value}
      </h3>

      {helperText && (
        <p className="mt-2 text-body text-muted">
          {helperText}
        </p>
      )}
    </div>
  );
}