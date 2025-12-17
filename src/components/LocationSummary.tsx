import type { ReactNode } from "react";

type LocationSummaryProps = {
  label: string;
  lat: number;
  lng: number;
  color: string;
  colorLabel: string;
  actionSlot?: ReactNode;
  labelVariant?: "default" | "placeholder";
};

export function LocationSummary({
  label,
  lat,
  lng,
  color,
  colorLabel,
  actionSlot,
  labelVariant = "default",
}: LocationSummaryProps) {
  const labelColorClass =
    labelVariant === "placeholder"
      ? "text-slate-400 dark:text-slate-500"
      : "text-slate-900 dark:text-slate-100";

  return (
    <>
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className={`font-medium ${labelColorClass}`}>{label}</div>
          <div className="font-mono text-xs text-slate-500 dark:text-slate-300">
            {lat.toFixed(2)}, {lng.toFixed(2)}
          </div>
        </div>
        <span
          className="inline-flex h-4 w-4 rounded-full border border-slate-200 dark:border-slate-700"
          style={{ backgroundColor: color }}
          role="img"
          aria-label={colorLabel}
        />
      </div>
      {actionSlot ? <div className="mt-2 flex justify-end">{actionSlot}</div> : null}
    </>
  );
}
