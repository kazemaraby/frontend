import { useId } from "react";
import { Area, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { useFormat } from "@/lib/useFormat";

import { ChartTooltip, chartColors } from "./chartTheme";

export type TrendDatum = { label: string; primary: number; secondary?: number };

type Props = {
  data: TrendDatum[];
  primaryLabel: string;
  secondaryLabel?: string;
  height?: number;
  ticks?: number[];
  label: string;
};

/** Smooth area (dark teal) with an optional grey comparison line. Mirrored in Arabic like BarChart. */
export function TrendChart({ data, primaryLabel, secondaryLabel, height = 300, ticks, label }: Props) {
  const { dir, number } = useFormat();
  const ordered = dir === "rtl" ? [...data].reverse() : data;
  const names: Record<string, string> = { primary: primaryLabel, secondary: secondaryLabel ?? "" };
  const fillId = `trend-fill-${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;

  return (
    <div className="w-full">
      <ul className="mb-3 flex flex-wrap items-center gap-5 text-sm text-muted">
        <li className="flex items-center gap-2">
          <span aria-hidden="true" className="h-1 w-4 rounded-full bg-teal-dark" />
          {primaryLabel}
        </li>
        {secondaryLabel && (
          <li className="flex items-center gap-2">
            <span aria-hidden="true" className="h-1 w-4 rounded-full bg-subtle" />
            {secondaryLabel}
          </li>
        )}
      </ul>
      <div dir="ltr" role="img" aria-label={label} style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={ordered} margin={{ top: 8, right: 24, bottom: 0, left: 0 }}>
            <defs>
              <linearGradient id={fillId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={chartColors.tealMist} stopOpacity={1} />
                <stop offset="100%" stopColor={chartColors.tealMist} stopOpacity={0.7} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} stroke={chartColors.grid} />
            <YAxis
              ticks={ticks}
              domain={ticks ? [ticks[0] - 10, ticks[ticks.length - 1]] : ["auto", "auto"]}
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
              interval={0}
              height={30}
              padding={{ left: 12, right: 0 }}
              tick={{ fill: chartColors.muted, fontSize: 12 }}
            />
            <Tooltip
              cursor={{ stroke: chartColors.line, strokeDasharray: "4 4" }}
              content={<ChartTooltip dir={dir} names={names} format={(v) => number(v)} />}
            />
            <Area
              type="natural"
              dataKey="primary"
              stroke={chartColors.tealDark}
              strokeWidth={2.5}
              fill={`url(#${fillId})`}
              isAnimationActive={false}
            />
            {secondaryLabel && (
              <Line
                type="natural"
                dataKey="secondary"
                stroke={chartColors.subtle}
                strokeWidth={2.5}
                dot={false}
                isAnimationActive={false}
              />
            )}
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
