"use client";

import { useState } from "react";
import { usePortfolio } from "@/lib/hooks/use-portfolio";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { HealthScoreBadge } from "@/components/contacts/health-score-badge";
import { formatCurrency, formatNumber, getInitials } from "@/lib/utils/format";
import { VERTICALS, VERTICAL_COLORS } from "@/lib/constants/verticals";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from "recharts";
import { Users, DollarSign, Heart, AlertTriangle, TrendingUp } from "lucide-react";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";

import { CHURN_RISK_COLORS } from "@/lib/constants/brand-colors";

const churnRiskColors = CHURN_RISK_COLORS;

export default function PortfolioPage() {
  const [sortBy, setSortBy] = useState("healthScore");
  const [sortDir, setSortDir] = useState("asc");
  const [churnRiskFilter, setChurnRiskFilter] = useState("all");
  const [verticalFilter, setVerticalFilter] = useState("all");

  const { data, isLoading } = usePortfolio({
    sortBy,
    sortDir,
    churnRisk: churnRiskFilter !== "all" ? churnRiskFilter : undefined,
    vertical: verticalFilter !== "all" ? verticalFilter : undefined,
  });

  const creators = data?.creators ?? [];
  const stats = data?.stats;
  const verticalBreakdown = data?.verticalBreakdown ?? [];
  const healthDistribution = data?.healthDistribution ?? [];
  const nrr = data?.stats?.nrr ?? 100;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Portfolio</h1>
        <p className="text-muted-foreground">
          Your creator portfolio at a glance.
        </p>
      </div>

      {/* Aggregate Stats */}
      <div className="grid gap-4 md:grid-cols-5">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Creators</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-12" />
            ) : (
              <div className="text-2xl font-bold">
                {stats?.totalCreators ?? 0}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total GMV</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-24" />
            ) : (
              <div className="text-2xl font-bold">
                {formatCurrency(stats?.totalGmv ?? 0)}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Avg Health</CardTitle>
            <Heart className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-12" />
            ) : (
              <div className="text-2xl font-bold">{stats?.avgHealth ?? 0}</div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">At Risk</CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-12" />
            ) : (
              <div className="text-2xl font-bold text-destructive">
                {stats?.atRisk ?? 0}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">NRR</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <div className={`text-2xl font-bold ${nrr >= 100 ? "text-[#00876D]" : "text-destructive"}`}>
                {nrr}%
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3">
        <Select value={sortBy} onValueChange={setSortBy}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Sort by" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="healthScore">Health Score</SelectItem>
            <SelectItem value="currentGmv">GMV</SelectItem>
            <SelectItem value="currentMrr">MRR</SelectItem>
            <SelectItem value="memberCount">Members</SelectItem>
            <SelectItem value="createdAt">Date Added</SelectItem>
          </SelectContent>
        </Select>

        <Select value={sortDir} onValueChange={setSortDir}>
          <SelectTrigger className="w-[120px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="asc">Ascending</SelectItem>
            <SelectItem value="desc">Descending</SelectItem>
          </SelectContent>
        </Select>

        <Select value={churnRiskFilter} onValueChange={setChurnRiskFilter}>
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="Churn Risk" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Risk Levels</SelectItem>
            <SelectItem value="critical">Critical</SelectItem>
            <SelectItem value="high">High</SelectItem>
            <SelectItem value="medium">Medium</SelectItem>
            <SelectItem value="low">Low</SelectItem>
          </SelectContent>
        </Select>

        <Select value={verticalFilter} onValueChange={setVerticalFilter}>
          <SelectTrigger className="w-[170px]">
            <SelectValue placeholder="Vertical" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Verticals</SelectItem>
            {VERTICALS.map((v) => (
              <SelectItem key={v.value} value={v.value}>{v.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Charts */}
      {!isLoading && (verticalBreakdown.length > 0 || healthDistribution.some((d: any) => d.value > 0)) && (
        <div className="grid gap-4 md:grid-cols-2">
          {/* Vertical Breakdown */}
          {verticalBreakdown.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium">GMV by Vertical</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={verticalBreakdown.map((d: any) => ({
                    ...d,
                    label: VERTICALS.find((v) => v.value === d.vertical)?.label ?? d.vertical,
                    gmv: Math.round(d.gmv),
                  }))}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="label" tick={{ fontSize: 11 }} angle={-20} textAnchor="end" height={60} />
                    <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
                    <Tooltip formatter={(value) => [`$${Number(value).toLocaleString()}`, "GMV"]} />
                    <Bar dataKey="gmv" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}

          {/* Health Distribution */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">Health Distribution</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie
                    data={healthDistribution.filter((d: any) => d.value > 0)}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={90}
                    paddingAngle={2}
                    dataKey="value"
                    nameKey="name"
                    label={({ name, value }: any) => `${name}: ${value}`}
                    labelLine={false}
                  >
                    {healthDistribution.filter((d: any) => d.value > 0).map((entry: any, index: number) => (
                      <Cell key={index} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Creator Grid */}
      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="p-4">
                <Skeleton className="h-20 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : creators.length === 0 ? (
        <div className="flex items-center justify-center py-20 text-muted-foreground">
          No creators in your portfolio yet.
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {creators.map(
            (creator: {
              id: string;
              firstName: string;
              lastName: string | null;
              whopUsername: string | null;
              status: string;
              tier: string | null;
              healthScore: number | null;
              currentGmv: string | null;
              currentMrr: string | null;
              lifetimeGmv: string | null;
              memberCount: number | null;
              churnRisk: string | null;
              vertical: string | null;
              lastActiveAt: string | null;
            }) => (
              <Link key={creator.id} href={`/contacts/${creator.id}`}>
                <Card className="hover:border-primary/50 transition-colors cursor-pointer">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted text-sm font-medium">
                          {getInitials(creator.firstName, creator.lastName)}
                        </div>
                        <div>
                          <p className="font-medium">
                            {creator.firstName} {creator.lastName}
                          </p>
                          {creator.whopUsername && (
                            <p className="text-xs text-muted-foreground">
                              @{creator.whopUsername}
                            </p>
                          )}
                        </div>
                      </div>
                      <HealthScoreBadge score={creator.healthScore} size="md" />
                    </div>

                    <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                      <div>
                        <p className="text-xs text-muted-foreground">GMV</p>
                        <p className="text-sm font-medium">
                          {formatCurrency(creator.currentGmv)}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">MRR</p>
                        <p className="text-sm font-medium">
                          {formatCurrency(creator.currentMrr)}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Members</p>
                        <p className="text-sm font-medium">
                          {formatNumber(creator.memberCount)}
                        </p>
                      </div>
                    </div>

                    <div className="mt-3 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {creator.tier && (
                          <Badge variant="outline" className="text-[10px]">
                            {creator.tier}
                          </Badge>
                        )}
                        {creator.churnRisk && (
                          <span
                            className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${churnRiskColors[creator.churnRisk] ?? ""}`}
                          >
                            {creator.churnRisk} risk
                          </span>
                        )}
                        {creator.vertical && (
                          <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${VERTICAL_COLORS[creator.vertical] ?? ""}`}>
                            {VERTICALS.find((v) => v.value === creator.vertical)?.label ?? creator.vertical}
                          </span>
                        )}
                      </div>
                      {creator.lastActiveAt && (
                        <span className="text-[10px] text-muted-foreground">
                          Active{" "}
                          {formatDistanceToNow(new Date(creator.lastActiveAt), {
                            addSuffix: true,
                          })}
                        </span>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </Link>
            )
          )}
        </div>
      )}
    </div>
  );
}
