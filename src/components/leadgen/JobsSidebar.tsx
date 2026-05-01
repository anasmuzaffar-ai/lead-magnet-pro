import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Activity, CheckCircle2, XCircle, Loader2, Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

export type JobRow = {
  id: string;
  query: string;
  status: string;
  total_leads: number;
  enriched_count: number;
  created_at: string;
  progress: number;
};

const StatusBadge = ({ status }: { status: string }) => {
  const map: Record<string, { label: string; cls: string; Icon: any }> = {
    queued: { label: "queued", cls: "bg-muted text-muted-foreground", Icon: Activity },
    running: { label: "running", cls: "bg-primary/15 text-primary", Icon: Loader2 },
    completed: { label: "completed", cls: "bg-success/15 text-success", Icon: CheckCircle2 },
    failed: { label: "failed", cls: "bg-danger/15 text-danger", Icon: XCircle },
  };
  const { label, cls, Icon } = map[status] ?? map.queued;
  return (
    <span className={cn("inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-mono font-semibold uppercase", cls)}>
      <Icon className={cn("h-3 w-3", status === "running" && "animate-spin")} />
      {label}
    </span>
  );
};

const timeAgo = (iso: string) => {
  const s = Math.max(1, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
};

export const JobsSidebar = ({
  selectedId, onSelect,
}: { selectedId: string | null; onSelect: (id: string) => void }) => {
  const [jobs, setJobs] = useState<JobRow[]>([]);

  const refresh = async () => {
    const { data } = await supabase
      .from("jobs")
      .select("id,query,status,total_leads,enriched_count,created_at,progress")
      .order("created_at", { ascending: false })
      .limit(50);
    if (data) setJobs(data as JobRow[]);
  };

  useEffect(() => {
    refresh();
    const ch = supabase
      .channel("jobs-sidebar")
      .on("postgres_changes", { event: "*", schema: "public", table: "jobs" }, refresh)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  return (
    <aside className="w-full lg:w-80 lg:shrink-0">
      <div className="glass-card rounded-2xl p-4 lg:sticky lg:top-24">
        <div className="flex items-center justify-between mb-3 px-1">
          <h3 className="font-display text-sm font-semibold tracking-tight">Recent Missions</h3>
          <span className="text-[10px] font-mono text-muted-foreground">{jobs.length}</span>
        </div>

        <div className="space-y-1.5 max-h-[60vh] lg:max-h-[calc(100vh-12rem)] overflow-y-auto scrollbar-thin pr-1">
          {jobs.length === 0 && (
            <div className="text-center text-xs text-muted-foreground py-10 px-3">
              No missions yet. Run your first search above.
            </div>
          )}
          <AnimatePresence initial={false}>
            {jobs.map((j) => (
              <motion.button
                key={j.id}
                layout
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                onClick={() => onSelect(j.id)}
                className={cn(
                  "w-full text-left p-3 rounded-xl border transition-all relative overflow-hidden",
                  selectedId === j.id
                    ? "bg-secondary/60 border-primary/40 shadow-card"
                    : "bg-secondary/20 border-border/40 hover:bg-secondary/40 hover:border-border"
                )}
              >
                {j.status === "running" && (
                  <div className="absolute inset-x-0 bottom-0 h-0.5 shimmer" />
                )}
                <div className="flex items-start gap-2">
                  <div className="h-7 w-7 rounded-lg bg-background/60 grid place-items-center shrink-0 mt-0.5">
                    <Search className="h-3.5 w-3.5 text-muted-foreground" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <p className="text-sm font-medium truncate">{j.query}</p>
                      <span className="text-[10px] text-muted-foreground font-mono shrink-0">{timeAgo(j.created_at)}</span>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <StatusBadge status={j.status} />
                      <span className="text-[10px] font-mono text-muted-foreground">
                        {j.total_leads} · {j.enriched_count} enriched
                      </span>
                    </div>
                  </div>
                </div>
              </motion.button>
            ))}
          </AnimatePresence>
        </div>
      </div>
    </aside>
  );
};