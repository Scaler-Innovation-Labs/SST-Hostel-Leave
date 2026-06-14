"use client";

type PolicyConfig = Record<string, unknown>;

type PolicyConfigBuilderProps = {
  policyType: string;
  config: PolicyConfig;
  onChange: (config: PolicyConfig) => void;
};

export function PolicyConfigBuilder({
  policyType,
  config,
  onChange,
}: PolicyConfigBuilderProps) {
  const update = (key: string, value: unknown) => {
    onChange({ ...config, [key]: value });
  };

  switch (policyType) {
    case "MAX_DAYS":
      return (
        <div className="space-y-3">
          <p className="text-xs text-muted-foreground">
            Maximum consecutive days allowed for this leave type.
          </p>
          <label className="block text-sm">
            <span className="mb-1.5 block font-medium">Max Days</span>
            <div className="flex items-center gap-3">
              <input
                type="range"
                min={1}
                max={90}
                value={(config.maxDays as number) ?? 7}
                onChange={(e) => update("maxDays", Number(e.target.value))}
                className="h-2 w-full cursor-pointer appearance-none rounded-lg bg-muted accent-primary"
              />
              <span className="min-w-[3ch] text-right font-mono text-lg font-semibold tabular-nums">
                {String(config.maxDays ?? 7)}
              </span>
            </div>
          </label>
        </div>
      );

    case "BLOCK_DURING_PERIOD": {
      const PRESET_PERIODS = [
        { value: "MID_EXAM", label: "Midterm Exams" },
        { value: "FINAL_EXAM", label: "Final Exams" },
        { value: "DIWALI", label: "Diwali" },
        { value: "HOLI", label: "Holi" },
        { value: "WINTER_BREAK", label: "Winter Break" },
        { value: "SUMMER_BREAK", label: "Summer Break" },
      ];
      const selected = (config.blockedPeriods as string[]) ?? [];

      const toggle = (period: string) => {
        const next = selected.includes(period)
          ? selected.filter((p) => p !== period)
          : [...selected, period];
        update("blockedPeriods", next);
      };

      return (
        <div className="space-y-3">
          <p className="text-xs text-muted-foreground">
            Select periods during which this leave type is blocked.
          </p>
          <label className="block text-sm">
            <span className="mb-1.5 block font-medium">Blocked Periods</span>
            <div className="flex flex-wrap gap-2">
              {PRESET_PERIODS.map((p) => {
                const active = selected.includes(p.value);
                return (
                  <button
                    key={p.value}
                    type="button"
                    onClick={() => toggle(p.value)}
                    className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
                      active
                        ? "border-destructive/50 bg-destructive/10 text-destructive"
                        : "border-border text-muted-foreground hover:border-muted-foreground/30"
                    }`}
                  >
                    {active ? `✕ ${p.label}` : p.label}
                  </button>
                );
              })}
            </div>
          </label>
          {selected.length > 0 && (
            <p className="text-xs text-muted-foreground">
              {selected.length} period{selected.length > 1 ? "s" : ""} blocked
            </p>
          )}
        </div>
      );
    }

    case "RESTRICT_BATCH": {
      const batchYears = (config.blockedBatchYears as number[]) ?? [];

      const addBatch = () => {
        const year = new Date().getFullYear();
        const max = Math.max(...batchYears, year - 1);
        update("blockedBatchYears", [...batchYears, max + 1]);
      };

      const removeBatch = (year: number) => {
        update(
          "blockedBatchYears",
          batchYears.filter((y) => y !== year),
        );
      };

      return (
        <div className="space-y-3">
          <p className="text-xs text-muted-foreground">
            Restrict specific batch years from taking this leave type.
          </p>
          <label className="block text-sm">
            <span className="mb-1.5 block font-medium">Blocked Batch Years</span>
            {batchYears.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                No batch years blocked yet.
              </p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {batchYears.map((year) => (
                  <span
                    key={year}
                    className="inline-flex items-center gap-1.5 rounded-lg border bg-card px-2.5 py-1 text-xs font-mono"
                  >
                    {year}
                    <button
                      type="button"
                      onClick={() => removeBatch(year)}
                      className="text-muted-foreground hover:text-destructive"
                    >
                      ✕
                    </button>
                  </span>
                ))}
              </div>
            )}
          </label>
          <button
            type="button"
            onClick={addBatch}
            className="rounded-lg border border-dashed border-border px-3 py-1.5 text-xs text-muted-foreground hover:border-primary hover:text-primary transition-colors"
          >
            + Add batch year
          </button>
        </div>
      );
    }

    case "REQUIRE_PARENT_APPROVAL":
      return (
        <div className="space-y-3">
          <p className="text-xs text-muted-foreground">
            Require parent approval before this leave type can be processed.
          </p>
          <div className="flex items-center gap-3 rounded-lg border bg-muted/20 p-3">
            <label className="relative inline-flex cursor-pointer items-center">
              <input
                type="checkbox"
                checked={true}
                readOnly
                className="peer sr-only"
              />
              <div className="h-5 w-9 rounded-full bg-primary after:absolute after:left-[2px] after:top-[2px] after:h-4 after:w-4 after:rounded-full after:bg-white after:transition-all peer-checked:after:translate-x-full" />
            </label>
            <div>
              <p className="text-sm font-medium">Parent Approval Required</p>
              <p className="text-xs text-muted-foreground">
                This policy type requires no additional configuration.
              </p>
            </div>
          </div>
        </div>
      );

    case "CURFEW_RESTRICTION":
      return (
        <div className="space-y-3">
          <p className="text-xs text-muted-foreground">
            Set the latest return time for this leave type. Students must return before this time.
          </p>
          <label className="block text-sm">
            <span className="mb-1.5 block font-medium">Latest Return Time</span>
            <input
              type="time"
              value={(config.latestReturnTime as string) ?? "22:00"}              onChange={(e) => update("latestReturnTime", e.target.value)}
                    className="h-9 w-40 rounded-lg border bg-background px-3 font-mono text-sm outline-none focus:border-ring focus:ring-1 focus:ring-ring"
            />
          </label>
        </div>
      );

    case "MAX_EXTENSION_COUNT":
      return (
        <div className="space-y-3">
          <p className="text-xs text-muted-foreground">
            Maximum number of times a leave can be extended.
          </p>
          <label className="block text-sm">
            <span className="mb-1.5 block font-medium">Max Extensions</span>
            <div className="flex items-center gap-3">
              <input
                type="range"
                min={0}
                max={20}
                value={(config.maxExtensionCount as number) ?? 3}
                onChange={(e) => update("maxExtensionCount", Number(e.target.value))}
                className="h-2 w-full cursor-pointer appearance-none rounded-lg bg-muted accent-primary"
              />
              <span className="min-w-[2ch] text-right font-mono text-lg font-semibold tabular-nums">
                {String(config.maxExtensionCount ?? 3)}
              </span>
            </div>
          </label>
          <p className="text-xs text-muted-foreground">
            Set to 0 to disallow extensions entirely.
          </p>
        </div>
      );

    default:
      return (
        <div className="space-y-3">
          <p className="text-xs text-muted-foreground">
            No visual editor available for this policy type. Edit the raw configuration below.
          </p>
          <label className="block text-sm">
            <span className="mb-1.5 block font-medium">Config (JSON)</span>
            <textarea
              rows={6}
              value={JSON.stringify(config, null, 2)}
              onChange={(e) => {
                try {
                  const parsed = JSON.parse(e.target.value);
                  onChange(parsed);
                } catch {
                  // Keep invalid JSON for editing
                }
              }}
              className="w-full rounded-lg border bg-background p-3 font-mono text-xs outline-none focus:border-ring focus:ring-1 focus:ring-ring"
            />
          </label>
        </div>
      );
  }
}

export type { PolicyConfig };
export default PolicyConfigBuilder;
