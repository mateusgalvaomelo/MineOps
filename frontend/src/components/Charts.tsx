import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { History } from "../types";
export function Trend({
  data,
  field = "throughput",
  color = "#38bdf8",
  height = 220,
}: {
  data: History[];
  field?: string;
  color?: string;
  height?: number;
}) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data}>
        <defs>
          <linearGradient id={"gradient-" + field} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.24} />
            <stop offset="100%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid stroke="var(--border)" vertical={false} />
        <XAxis
          dataKey="time"
          tickFormatter={(t) =>
            new Date(t).toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            })
          }
          minTickGap={45}
          stroke="var(--muted)"
          fontSize={10}
        />
        <YAxis stroke="var(--muted)" fontSize={10} width={38} />
        <Tooltip
          contentStyle={{
            background: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: 8,
          }}
          labelFormatter={(t) => new Date(String(t)).toLocaleString()}
        />
        <Area
          type="monotone"
          dataKey={field}
          stroke={color}
          strokeWidth={2}
          fill={"url(#gradient-" + field + ")"}
          isAnimationActive={false}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
export function Bars({
  data,
  height = 210,
}: {
  data: { name: string; value: number }[];
  height?: number;
}) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} layout="vertical" margin={{ left: 10, right: 25 }}>
        <CartesianGrid stroke="var(--border)" horizontal={false} />
        <XAxis type="number" stroke="var(--muted)" fontSize={10} />
        <YAxis
          dataKey="name"
          type="category"
          width={130}
          stroke="var(--muted)"
          fontSize={11}
        />
        <Tooltip
          contentStyle={{
            background: "var(--surface)",
            border: "1px solid var(--border)",
          }}
        />
        <Bar
          dataKey="value"
          fill="#38bdf8"
          radius={[0, 4, 4, 0]}
          isAnimationActive={false}
        />
      </BarChart>
    </ResponsiveContainer>
  );
}
