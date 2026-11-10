"use client";

import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  CheckCircle2,
  XCircle,
  Loader2,
  Clock,
  AlertTriangle,
  ChevronRight,
} from "lucide-react";
import { formatDistanceToNow, format } from "date-fns";

interface ImportJob {
  id: string;
  entityType: string;
  status: string;
  fileName: string | null;
  totalRows: number;
  processedRows: number;
  results: {
    created: number;
    skipped: number;
    updated: number;
    errors: number;
    errorDetails: { index: number; message: string }[];
    companyLinking?: {
      linkedByDomain: number;
      linkedByName: number;
      companiesCreated: number;
      ambiguousMatches: number;
      noMatchFound: number;
      noCompanyInfo: number;
    };
  } | null;
  createdAt: string;
  completedAt: string | null;
  userName: string | null;
  userLastName: string | null;
}

const statusConfig: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline"; icon: typeof CheckCircle2 }> = {
  pending: { label: "Pending", variant: "outline", icon: Clock },
  processing: { label: "Processing", variant: "secondary", icon: Loader2 },
  complete: { label: "Complete", variant: "default", icon: CheckCircle2 },
  failed: { label: "Failed", variant: "destructive", icon: XCircle },
};

export default function ImportsPage() {
  const [selectedJob, setSelectedJob] = useState<ImportJob | null>(null);

  const { data, isLoading } = useQuery<{ data: ImportJob[] }>({
    queryKey: ["import-jobs"],
    queryFn: async () => {
      const res = await fetch("/api/import-jobs");
      if (!res.ok) throw new Error("Failed to load import jobs");
      return res.json();
    },
    refetchInterval: 10000, // Poll for updates
  });

  const jobs = data?.data ?? [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Import History</h1>
        <p className="text-sm text-muted-foreground mt-1">
          View past data imports and their results.
        </p>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : jobs.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <Clock className="h-10 w-10 text-muted-foreground mb-3" />
          <p className="text-sm text-muted-foreground">No imports yet.</p>
          <p className="text-xs text-muted-foreground mt-1">
            Import contacts or companies from the Contacts or Companies page.
          </p>
        </div>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>File</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Created</TableHead>
                <TableHead className="text-right">Updated</TableHead>
                <TableHead className="text-right">Skipped</TableHead>
                <TableHead className="text-right">Errors</TableHead>
                <TableHead>User</TableHead>
                <TableHead className="w-[40px]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {jobs.map((job) => {
                const config = statusConfig[job.status] ?? statusConfig.pending;
                const Icon = config.icon;
                const isProcessing = job.status === "processing";

                return (
                  <TableRow
                    key={job.id}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => setSelectedJob(job)}
                  >
                    <TableCell className="text-xs">
                      {format(new Date(job.createdAt), "MMM d, yyyy h:mm a")}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs capitalize">
                        {job.entityType === "contact" ? "Contacts" : "Companies"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground max-w-[150px] truncate">
                      {job.fileName || "—"}
                    </TableCell>
                    <TableCell>
                      <Badge variant={config.variant} className="gap-1 text-xs">
                        <Icon className={`h-3 w-3 ${isProcessing ? "animate-spin" : ""}`} />
                        {config.label}
                        {isProcessing && (
                          <span className="text-[10px]">
                            {job.processedRows}/{job.totalRows}
                          </span>
                        )}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right text-sm">{job.results?.created ?? "—"}</TableCell>
                    <TableCell className="text-right text-sm">{job.results?.updated ?? "—"}</TableCell>
                    <TableCell className="text-right text-sm">{job.results?.skipped ?? "—"}</TableCell>
                    <TableCell className="text-right text-sm">
                      {job.results?.errors != null && job.results.errors > 0 ? (
                        <span className="text-destructive font-medium">{job.results.errors}</span>
                      ) : (
                        job.results?.errors ?? "—"
                      )}
                    </TableCell>
                    <TableCell className="text-xs">
                      {[job.userName, job.userLastName].filter(Boolean).join(" ") || "—"}
                    </TableCell>
                    <TableCell>
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Job detail dialog */}
      <JobDetailDialog job={selectedJob} onClose={() => setSelectedJob(null)} />
    </div>
  );
}

function JobDetailDialog({ job, onClose }: { job: ImportJob | null; onClose: () => void }) {
  if (!job) return null;

  const results = job.results;
  const config = statusConfig[job.status] ?? statusConfig.pending;
  const Icon = config.icon;

  return (
    <Dialog open={!!job} onOpenChange={() => onClose()}>
      <DialogContent className="sm:max-w-lg max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Import Details
            <Badge variant={config.variant} className="gap-1 text-xs">
              <Icon className="h-3 w-3" />
              {config.label}
            </Badge>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Metadata */}
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <p className="text-muted-foreground text-xs">Type</p>
              <p className="capitalize">{job.entityType === "contact" ? "Contacts" : "Companies"}</p>
            </div>
            <div>
              <p className="text-muted-foreground text-xs">File</p>
              <p className="truncate">{job.fileName || "—"}</p>
            </div>
            <div>
              <p className="text-muted-foreground text-xs">Started</p>
              <p>{format(new Date(job.createdAt), "MMM d, yyyy h:mm a")}</p>
            </div>
            <div>
              <p className="text-muted-foreground text-xs">Completed</p>
              <p>
                {job.completedAt
                  ? format(new Date(job.completedAt), "MMM d, yyyy h:mm a")
                  : "—"}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground text-xs">User</p>
              <p>{[job.userName, job.userLastName].filter(Boolean).join(" ") || "—"}</p>
            </div>
            <div>
              <p className="text-muted-foreground text-xs">Total Rows</p>
              <p>{job.totalRows}</p>
            </div>
          </div>

          {/* Results */}
          {results && (
            <>
              <div className="grid grid-cols-4 gap-3">
                <div className="rounded-lg border p-3 text-center">
                  <p className="text-xl font-bold text-green-600">{results.created}</p>
                  <p className="text-[10px] text-muted-foreground">Created</p>
                </div>
                <div className="rounded-lg border p-3 text-center">
                  <p className="text-xl font-bold text-blue-600">{results.updated}</p>
                  <p className="text-[10px] text-muted-foreground">Updated</p>
                </div>
                <div className="rounded-lg border p-3 text-center">
                  <p className="text-xl font-bold text-muted-foreground">{results.skipped}</p>
                  <p className="text-[10px] text-muted-foreground">Skipped</p>
                </div>
                <div className="rounded-lg border p-3 text-center">
                  <p className={`text-xl font-bold ${results.errors > 0 ? "text-destructive" : "text-muted-foreground"}`}>
                    {results.errors}
                  </p>
                  <p className="text-[10px] text-muted-foreground">Errors</p>
                </div>
              </div>

              {/* Company linking summary */}
              {results.companyLinking && (
                <div className="rounded-md border p-3 space-y-1">
                  <p className="text-xs font-medium mb-2">Company Linking</p>
                  <div className="grid grid-cols-2 gap-1 text-xs">
                    <span className="text-muted-foreground">Linked by domain:</span>
                    <span>{results.companyLinking.linkedByDomain}</span>
                    <span className="text-muted-foreground">Linked by name:</span>
                    <span>{results.companyLinking.linkedByName}</span>
                    <span className="text-muted-foreground">Companies created:</span>
                    <span>{results.companyLinking.companiesCreated}</span>
                    {results.companyLinking.ambiguousMatches > 0 && (
                      <>
                        <span className="text-yellow-600">Ambiguous matches:</span>
                        <span className="text-yellow-600">{results.companyLinking.ambiguousMatches}</span>
                      </>
                    )}
                    {results.companyLinking.noMatchFound > 0 && (
                      <>
                        <span className="text-yellow-600">No match found:</span>
                        <span className="text-yellow-600">{results.companyLinking.noMatchFound}</span>
                      </>
                    )}
                    <span className="text-muted-foreground">No company info:</span>
                    <span>{results.companyLinking.noCompanyInfo}</span>
                  </div>
                </div>
              )}

              {/* Error details */}
              {results.errorDetails && results.errorDetails.length > 0 && (
                <details className="rounded-md border p-3">
                  <summary className="text-sm font-medium cursor-pointer text-destructive">
                    {results.errorDetails.length} error detail{results.errorDetails.length > 1 ? "s" : ""}
                  </summary>
                  <div className="mt-2 space-y-1 max-h-[200px] overflow-y-auto">
                    {results.errorDetails.map((e, i) => (
                      <p key={i} className="text-xs text-muted-foreground">
                        {e.index >= 0 ? `Row ${e.index + 1}: ` : ""}{e.message}
                      </p>
                    ))}
                  </div>
                </details>
              )}
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
