"use client";

import { useQuery } from "@tanstack/react-query";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
} from "recharts";

import { CHART_COLORS } from "@/lib/constants/brand-colors";

const COLORS = CHART_COLORS;

function useAnalytics() {
  return useQuery({
    queryKey: ["analytics"],
    queryFn: async () => {
      const res = await fetch("/api/analytics");
      if (!res.ok) throw new Error("Failed to fetch analytics");
      return res.json();
    },
  });
}

export default function AnalyticsPage() {
  const { data, isLoading } = useAnalytics();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Analytics</h1>
        <p className="text-muted-foreground">
          Insights and reporting across your CRM.
        </p>
      </div>

      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="p-6">
                <Skeleton className="h-64 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-2">
            {/* Contact Breakdown by Type */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Contacts by Type</CardTitle>
                <CardDescription>
                  Distribution of contact types
                </CardDescription>
              </CardHeader>
              <CardContent>
                {data?.contactsByType?.length > 0 ? (
                  <ResponsiveContainer width="100%" height={250}>
                    <PieChart>
                      <Pie
                        data={data.contactsByType.map(
                          (d: { type: string; count: number }) => ({
                            name: d.type.replace("_", " "),
                            value: Number(d.count),
                          })
                        )}
                        cx="50%"
                        cy="50%"
                        outerRadius={80}
                        dataKey="value"
                        label={({ name, value }: { name?: string; value?: number }) =>
                          `${name ?? ""}: ${value ?? 0}`
                        }
                      >
                        {data.contactsByType.map(
                          (_: unknown, i: number) => (
                            <Cell
                              key={i}
                              fill={COLORS[i % COLORS.length]}
                            />
                          )
                        )}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <EmptyChart />
                )}
              </CardContent>
            </Card>

            {/* Contact Breakdown by Status */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Contacts by Status</CardTitle>
                <CardDescription>
                  Active, at-risk, churned breakdown
                </CardDescription>
              </CardHeader>
              <CardContent>
                {data?.contactsByStatus?.length > 0 ? (
                  <ResponsiveContainer width="100%" height={250}>
                    <BarChart
                      data={data.contactsByStatus.map(
                        (d: { status: string; count: number }) => ({
                          name: d.status.replace("_", " "),
                          count: Number(d.count),
                        })
                      )}
                    >
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" fontSize={12} />
                      <YAxis fontSize={12} />
                      <Tooltip />
                      <Bar dataKey="count" fill="#1754D8" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <EmptyChart />
                )}
              </CardContent>
            </Card>

            {/* Pipeline Deals by Stage */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Pipeline by Stage</CardTitle>
                <CardDescription>
                  Deal count and value per stage
                </CardDescription>
              </CardHeader>
              <CardContent>
                {data?.dealsByStage?.length > 0 ? (
                  <ResponsiveContainer width="100%" height={250}>
                    <BarChart
                      data={data.dealsByStage.map(
                        (d: {
                          stageName: string;
                          stageColor: string | null;
                          count: number;
                          totalValue: string;
                        }) => ({
                          name: d.stageName,
                          deals: Number(d.count),
                          value: Math.round(parseFloat(d.totalValue)),
                        })
                      )}
                    >
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" fontSize={11} />
                      <YAxis fontSize={12} />
                      <Tooltip />
                      <Bar dataKey="deals" fill="#8160CE" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <EmptyChart />
                )}
              </CardContent>
            </Card>

            {/* Activity Types (last 30d) */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Activities (Last 30d)</CardTitle>
                <CardDescription>
                  Activity breakdown by type
                </CardDescription>
              </CardHeader>
              <CardContent>
                {data?.activitiesByType?.length > 0 ? (
                  <ResponsiveContainer width="100%" height={250}>
                    <PieChart>
                      <Pie
                        data={data.activitiesByType.map(
                          (d: { type: string; count: number }) => ({
                            name: d.type.replace("_", " "),
                            value: Number(d.count),
                          })
                        )}
                        cx="50%"
                        cy="50%"
                        outerRadius={80}
                        dataKey="value"
                        label={({ name, value }: { name?: string; value?: number }) =>
                          `${name ?? ""}: ${value ?? 0}`
                        }
                      >
                        {data.activitiesByType.map(
                          (_: unknown, i: number) => (
                            <Cell
                              key={i}
                              fill={COLORS[i % COLORS.length]}
                            />
                          )
                        )}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <EmptyChart />
                )}
              </CardContent>
            </Card>
          </div>

          {/* Activity Trend Line */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Activity Trend</CardTitle>
              <CardDescription>
                Monthly activity volume (last 6 months)
              </CardDescription>
            </CardHeader>
            <CardContent>
              {data?.activityTrend?.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart
                    data={data.activityTrend.map(
                      (d: { month: string; count: number }) => ({
                        month: d.month,
                        activities: Number(d.count),
                      })
                    )}
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" fontSize={12} />
                    <YAxis fontSize={12} />
                    <Tooltip />
                    <Line
                      type="monotone"
                      dataKey="activities"
                      stroke="#FA4616"
                      strokeWidth={2}
                      dot={{ r: 4 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <EmptyChart />
              )}
            </CardContent>
          </Card>

          {/* Task Summary */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Tasks Summary</CardTitle>
              <CardDescription>Tasks by status</CardDescription>
            </CardHeader>
            <CardContent>
              {data?.tasksSummary?.length > 0 ? (
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart
                    layout="vertical"
                    data={data.tasksSummary.map(
                      (d: { status: string; count: number }) => ({
                        name: d.status.replace("_", " "),
                        count: Number(d.count),
                      })
                    )}
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis type="number" fontSize={12} />
                    <YAxis dataKey="name" type="category" fontSize={12} width={100} />
                    <Tooltip />
                    <Bar dataKey="count" fill="#00876D" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <EmptyChart />
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

function EmptyChart() {
  return (
    <div className="flex items-center justify-center h-[250px] text-sm text-muted-foreground">
      No data yet
    </div>
  );
}
