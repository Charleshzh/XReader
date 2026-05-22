import { useEffect, useState } from "react";
import { useReaderStore, type StatsSummary } from "@/stores/readerStore";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { BookOpen, Clock, FileText } from "lucide-react";

function fmtDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function fmtWords(n: number): string {
  if (n >= 10000) return `${(n / 10000).toFixed(1)}万`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}

export function StatsPage() {
  const [stats, setStats] = useState<StatsSummary | null>(null);
  const [days, setDays] = useState(30);

  useEffect(() => {
    useReaderStore.getState().getStats(days).then(setStats);
  }, [days]);

  if (!stats) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <p className="text-muted-foreground">加载中...</p>
      </div>
    );
  }

  const chartData = [...stats.daily].reverse().map((d) => ({
    date: d.date.slice(5), // MM-DD
    minutes: Math.round(d.read_seconds / 60),
    words: d.read_words,
  }));

  return (
    <div className="flex h-screen flex-col bg-background">
      <header className="flex items-center justify-between border-b px-6 py-4">
        <h1 className="text-2xl font-bold">阅读统计</h1>
        <select
          value={days}
          onChange={(e) => setDays(Number(e.target.value))}
          className="rounded border bg-background px-3 py-1 text-sm"
        >
          <option value={7}>最近 7 天</option>
          <option value={14}>最近 14 天</option>
          <option value={30}>最近 30 天</option>
          <option value={90}>最近 90 天</option>
        </select>
      </header>

      <main className="flex-1 overflow-auto p-6">
        {/* Summary cards */}
        <div className="mb-8 grid grid-cols-3 gap-4">
          <div className="rounded-lg border bg-card p-4">
            <div className="mb-2 flex items-center gap-2 text-sm text-muted-foreground">
              <Clock className="h-4 w-4" />
              总阅读时长
            </div>
            <p className="text-2xl font-bold">{fmtDuration(stats.total_seconds)}</p>
          </div>
          <div className="rounded-lg border bg-card p-4">
            <div className="mb-2 flex items-center gap-2 text-sm text-muted-foreground">
              <FileText className="h-4 w-4" />
              总阅读字数
            </div>
            <p className="text-2xl font-bold">{fmtWords(stats.total_words)}</p>
          </div>
          <div className="rounded-lg border bg-card p-4">
            <div className="mb-2 flex items-center gap-2 text-sm text-muted-foreground">
              <BookOpen className="h-4 w-4" />
              日均阅读
            </div>
            <p className="text-2xl font-bold">
              {stats.daily.length > 0
                ? fmtDuration(
                    Math.round(
                      stats.daily.reduce((s, d) => s + d.read_seconds, 0) / stats.daily.length,
                    ),
                  )
                : "0m"}
            </p>
          </div>
        </div>

        {/* Chart */}
        <div className="rounded-lg border bg-card p-4">
          <h3 className="mb-4 text-sm font-semibold">每日阅读时长</h3>
          {chartData.length === 0 ? (
            <p className="py-12 text-center text-sm text-muted-foreground">暂无数据</p>
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip
                  formatter={(_value: unknown) => [`${_value} 分钟`, "阅读时长"]}
                  labelFormatter={(label: unknown) => `日期: ${String(label)}`}
                />
                <Bar dataKey="minutes" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </main>
    </div>
  );
}
