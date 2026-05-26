import { cn } from "@/lib/utils";

type DashboardCardProps = {
  title: string;
  description?: string;
  children?: React.ReactNode;
  className?: string;
};

export function DashboardCard({
  title,
  description,
  children,
  className,
}: DashboardCardProps) {
  return (
    <div
      className={cn(
        `
          rounded-2xl border border-border
          bg-card
          p-6
          shadow-sm
        `,
        className
      )}
    >
      <div className="mb-4">
        <h3 className="text-base font-semibold">
          {title}
        </h3>

        {description && (
          <p className="mt-1 text-sm text-muted-foreground">
            {description}
          </p>
        )}
      </div>

      {children}
    </div>
  );
}