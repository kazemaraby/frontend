import { Bar, BarChart as RBarChart, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { useFormat } from "@/lib/useFormat";

import { ChartTooltip, chartColors } from "./chartTheme";

export type BarDatum = { label: string; value: number };

type Props = {
  data: BarDatum[];
  /** Index (in `data`) of the bar drawn in dark teal, e.g. the peak month. */
  highlight?: number;
  height?: number;
  ticks?: number[];
  /** Accessible summary of the chart. */
  label: string;
  valueLabel?: (value: number) => string;
};

/** Teal bars with rounded tops. Reads right-to-left in Arabic (first item on the right). */
export function BarChart({ data, highlight, height = 280, ticks, label, valueLabel }: Props) {
  const { dir, number } = useFormat();
  const rtl = dir === "rtl";
  const rows = data.map((d, i) => ({ ...d, highlighted: i === highlight }));
  const ordered = rtl ? [...rows].reverse() : rows;
  const highlightedLabel = highlight === undefined ? undefined : data[highlight]?.label;

  return (
    // Recharts mis-anchors axis text inside RTL containers, so the SVG always lays out LTR and we mirror the data.
    <div dir="ltr" role="img" aria-label={label} style={{ height }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        <RBarChart data={ordered} margin={{ top: 8, right: 4, bottom: 0, left: 0 }} barCategoryGap="16%">
          <YAxis
            ticks={ticks}
            domain={ticks ? [ticks[0], ticks[ticks.length - 1]] : undefined}
            axisLine={false}
            tickLine={false}
            width={36}
            tick={{ fill: chartColors.muted, fontSize: 12 }}
            tickFormatter={(v: number) => number(v)}
          />
          <XAxis
            dataKey="label"
            axisLine={false}
            tickLine={false}
            // On narrow screens Recharts drops labels that would collide instead of overlapping them.
            interval="preserveStartEnd"
            minTickGap={6}
            height={34}
            tick={({ x, y, payload }) => {
              // Match by label: with skipped ticks, Recharts' `index` counts visible ticks, not data points.
              const highlighted = payload.value === highlightedLabel;
              return (
                <text
                  x={x}
                  y={Number(y) + 14}
                  textAnchor="middle"
                  fontSize={12}
                  fontWeight={highlighted ? 700 : 400}
                  fill={highlighted ? chartColors.tealDark : chartColors.muted}
                >
                  {payload.value}
                </text>
              );
            }}
          />
          <Tooltip
            cursor={{ fill: chartColors.cursor, radius: 8 }}
            content={<ChartTooltip dir={dir} format={(v) => (valueLabel ? valueLabel(v) : number(v))} />}
          />
          <Bar dataKey="value" radius={[8, 8, 0, 0]} maxBarSize={40} isAnimationActive={false}>
            {ordered.map((row) => (
              <Cell key={row.label} fill={row.highlighted ? chartColors.tealDark : chartColors.teal} />
            ))}
          </Bar>
        </RBarChart>
      </ResponsiveContainer>
    </div>
  );
}
