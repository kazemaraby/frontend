/** Chart colours mirror the Tailwind tokens in index.css (Recharts needs raw values for SVG attributes). */
export const chartColors = {
  teal: "#2f9e62",
  tealDark: "#006c35",
  tealMist: "#e3f3e9",
  muted: "#475467",
  subtle: "#98a2b3",
  line: "#d0d5dd",
  grid: "#eef0f4",
  cursor: "rgba(20, 40, 28, 0.04)",
};

type TooltipProps = {
  active?: boolean;
  label?: string | number;
  payload?: { dataKey?: string | number; value?: number | string; color?: string }[];
  dir: "rtl" | "ltr";
  format: (value: number) => string;
  names?: Record<string, string>;
};

/** Dark navy tooltip shared by the charts. */
export function ChartTooltip({ active, label, payload, dir, format, names }: TooltipProps) {
  if (!active || !payload?.length) return null;
  return (
    <div dir={dir} className="num rounded-lg bg-navy px-3 py-2 text-xs text-white shadow-pop">
      {label !== "" && <p className="mb-1 font-semibold">{label}</p>}
      {payload.map((item) => (
        <p key={String(item.dataKey)}>
          {names?.[String(item.dataKey)] ? `${names[String(item.dataKey)]}: ` : ""}
          {format(Number(item.value))}
        </p>
      ))}
    </div>
  );
}
