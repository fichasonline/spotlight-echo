import { useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { BarChart3, CalendarDays, MessageSquare, Users } from "lucide-react";
import { Link } from "react-router-dom";

import { supabase } from "@/integrations/supabase/client";

interface MonthlyModerationMetric {
  month_start: string;
  month_end: string;
  support_threads_count: number;
  auth_users_count: number;
}

function parseDateOnly(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function formatMonth(value: string) {
  return format(parseDateOnly(value), "MMMM yyyy", { locale: es });
}

function formatMonthRange(start: string, end: string) {
  return `${format(parseDateOnly(start), "d MMM", { locale: es })} - ${format(parseDateOnly(end), "d MMM", { locale: es })}`;
}

function normalizeMetricRow(row: Record<string, unknown>): MonthlyModerationMetric {
  return {
    month_start: String(row.month_start),
    month_end: String(row.month_end),
    support_threads_count: Number(row.support_threads_count ?? 0),
    auth_users_count: Number(row.auth_users_count ?? 0),
  };
}

export default function AdminInsights() {
  const [monthlyMetrics, setMonthlyMetrics] = useState<MonthlyModerationMetric[]>([]);
  const [metricsLoading, setMetricsLoading] = useState(true);
  const [metricsError, setMetricsError] = useState<string | null>(null);

  const currentMonthMetric = monthlyMetrics[0] ?? null;
  const visibleMonthlyMetrics = useMemo(() => monthlyMetrics.slice(0, 12), [monthlyMetrics]);

  useEffect(() => {
    const fetchMetrics = async () => {
      setMetricsLoading(true);
      setMetricsError(null);

      const { data, error } = await (supabase as any).rpc("get_admin_moderation_monthly_metrics", {
        p_months: 12,
      });

      if (error) {
        setMonthlyMetrics([]);
        setMetricsError(error.message);
        setMetricsLoading(false);
        return;
      }

      setMonthlyMetrics(((data ?? []) as Record<string, unknown>[]).map(normalizeMetricRow));
      setMetricsLoading(false);
    };

    void fetchMetrics();
  }, []);

  return (
    <div className="min-h-screen bg-background">

      <div className="container mx-auto space-y-6 px-4 py-8">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="mb-2 flex items-center gap-2 text-sm font-medium text-primary">
              <BarChart3 className="h-4 w-4" />
              Insights
            </div>
            <h1 className="text-3xl font-display font-bold">Metricas de crecimiento</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Chats iniciados por visitantes y registros reales de usuarios en Auth.
            </p>
          </div>
          <Link
            to="/admin"
            className="inline-flex items-center rounded-full border border-border bg-card px-4 py-2 text-sm text-foreground transition-colors hover:border-primary/30"
          >
            Volver al dashboard
          </Link>
        </div>

        {metricsError ? (
          <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            No se pudieron cargar las metricas: {metricsError}
          </div>
        ) : (
          <>
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-lg border border-border bg-card p-4 shadow-sm">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm text-muted-foreground">Chats este mes</p>
                  <MessageSquare className="h-4 w-4 text-primary" />
                </div>
                <p className="mt-3 text-3xl font-display font-bold">
                  {metricsLoading ? "-" : currentMonthMetric?.support_threads_count ?? 0}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">Contactos unicos por chats abiertos en la web.</p>
              </div>

              <div className="rounded-lg border border-border bg-card p-4 shadow-sm">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm text-muted-foreground">Usuarios este mes</p>
                  <Users className="h-4 w-4 text-primary" />
                </div>
                <p className="mt-3 text-3xl font-display font-bold">
                  {metricsLoading ? "-" : currentMonthMetric?.auth_users_count ?? 0}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">Nuevos registros desde Supabase Auth.</p>
              </div>

              <div className="rounded-lg border border-border bg-card p-4 shadow-sm">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm text-muted-foreground">Periodo actual</p>
                  <CalendarDays className="h-4 w-4 text-primary" />
                </div>
                <p className="mt-3 text-xl font-display font-bold">
                  {metricsLoading || !currentMonthMetric
                    ? "-"
                    : formatMonthRange(currentMonthMetric.month_start, currentMonthMetric.month_end)}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">Del primer al ultimo dia del mes.</p>
              </div>

              <div className="rounded-lg border border-border bg-card p-4 shadow-sm">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm text-muted-foreground">Meses visibles</p>
                  <BarChart3 className="h-4 w-4 text-primary" />
                </div>
                <p className="mt-3 text-3xl font-display font-bold">{metricsLoading ? "-" : monthlyMetrics.length}</p>
                <p className="mt-1 text-xs text-muted-foreground">Historico mensual para comparar.</p>
              </div>
            </div>

            <div className="rounded-lg border border-border bg-card p-4 shadow-sm">
              <div className="mb-3 flex items-center justify-between gap-3">
                <div>
                  <h2 className="font-display text-lg font-semibold">Acumulado mensual</h2>
                  <p className="text-xs text-muted-foreground">Conteos cerrados por mes calendario.</p>
                </div>
              </div>

              {metricsLoading ? (
                <div className="py-8 text-center text-sm text-muted-foreground">Cargando metricas...</div>
              ) : visibleMonthlyMetrics.length === 0 ? (
                <div className="py-8 text-center text-sm text-muted-foreground">Todavia no hay metricas disponibles.</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[520px] text-sm">
                    <thead>
                      <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                        <th className="pb-2 font-medium">Mes</th>
                        <th className="pb-2 font-medium">Periodo</th>
                        <th className="pb-2 text-right font-medium">Chats abiertos</th>
                        <th className="pb-2 text-right font-medium">Usuarios registrados</th>
                      </tr>
                    </thead>
                    <tbody>
                      {visibleMonthlyMetrics.map((metric) => (
                        <tr key={metric.month_start} className="border-b border-border/60 last:border-0">
                          <td className="py-3 font-medium capitalize">{formatMonth(metric.month_start)}</td>
                          <td className="py-3 text-muted-foreground">{formatMonthRange(metric.month_start, metric.month_end)}</td>
                          <td className="py-3 text-right font-semibold">{metric.support_threads_count}</td>
                          <td className="py-3 text-right font-semibold">{metric.auth_users_count}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
