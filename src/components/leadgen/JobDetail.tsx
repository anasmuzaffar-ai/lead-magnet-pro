import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  Download, Loader2, CheckCircle2, XCircle, Activity, ExternalLink,
  Mail, Phone, MapPin, Globe, Facebook, Instagram, ChevronDown, ChevronUp,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { downloadLeadsXlsx, type LeadRow } from "@/lib/excel";
import { cn } from "@/lib/utils";

type Job = {
  id: string; query: string; status: string; stage: string | null;
  total_leads: number; enriched_count: number; progress: number;
  logs: { ts: string; message: string }[]; error: string | null;
  started_at: string; finished_at: string | null;
};

type Lead = LeadRow & { id: string; enriched: boolean; created_at: string };

export const JobDetail = ({ jobId }: { jobId: string }) => {
  const [job, setJob] = useState<Job | null>(null);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [showLogs, setShowLogs] = useState(true);

  useEffect(() => {
    let mounted = true;
    const loadJob = async () => {
      const { data } = await supabase.from("jobs").select("*").eq("id", jobId).single();
      if (mounted && data) setJob(data as any);
    };
    const loadLeads = async () => {
      const { data } = await supabase.from("leads").select("*").eq("job_id", jobId).order("created_at", { ascending: true });
      if (mounted && data) setLeads(data as any);
    };
    loadJob(); loadLeads();

    const ch = supabase
      .channel(`job-${jobId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "jobs", filter: `id=eq.${jobId}` }, loadJob)
      .on("postgres_changes", { event: "*", schema: "public", table: "leads", filter: `job_id=eq.${jobId}` }, loadLeads)
      .subscribe();
    return () => { mounted = false; supabase.removeChannel(ch); };
  }, [jobId]);

  const stageLabel = useMemo(() => {
    if (!job) return "";
    if (job.status === "completed") return "Completed";
    if (job.status === "failed") return "Failed";
    switch (job.stage) {
      case "scraping": return "Scraping Google Maps…";
      case "enriching": return "Enriching missing data…";
      case "completed": return "Completed";
      default: return "Initializing…";
    }
  }, [job]);

  if (!job) {
    return (
      <div className="glass-card rounded-2xl p-12 text-center">
        <Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
      </div>
    );
  }

  const StatusIcon = job.status === "completed" ? CheckCircle2
    : job.status === "failed" ? XCircle
    : job.status === "running" ? Loader2 : Activity;

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-5">
      <div className="glass-card rounded-2xl p-6">
        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className={cn(
                "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[10px] font-mono font-semibold uppercase",
                job.status === "completed" && "bg-success/15 text-success",
                job.status === "failed" && "bg-danger/15 text-danger",
                job.status === "running" && "bg-primary/15 text-primary",
                job.status === "queued" && "bg-muted text-muted-foreground",
              )}>
                <StatusIcon className={cn("h-3 w-3", job.status === "running" && "animate-spin")} />
                {job.status}
              </span>
              <span className="text-xs text-muted-foreground font-mono">
                Started {new Date(job.started_at).toLocaleString()}
              </span>
            </div>
            <h2 className="font-display text-2xl md:text-3xl font-bold tracking-tight">{job.query}</h2>
            <p className="text-sm text-muted-foreground mt-1">{stageLabel}</p>
          </div>
          <Button
            onClick={() => downloadLeadsXlsx(job.query, leads)}
            disabled={leads.length === 0}
            className="bg-gradient-primary text-primary-foreground hover:opacity-90 shadow-glow font-semibold"
          >
            <Download className="h-4 w-4 mr-2" /> Download Excel
          </Button>
        </div>

        <div className="mt-6 grid grid-cols-3 gap-3">
          <Stat label="Total Leads" value={job.total_leads} />
          <Stat label="Enriched" value={job.enriched_count} accent />
          <Stat label="Progress" value={`${job.progress}%`} />
        </div>

        <div className="mt-4">
          <Progress value={job.progress} className="h-2 bg-secondary/60" />
        </div>

        {job.error && (
          <div className="mt-4 p-3 rounded-xl bg-danger/10 border border-danger/30 text-sm text-danger font-mono">
            {job.error}
          </div>
        )}
      </div>

      <div className="glass-card rounded-2xl overflow-hidden">
        <button
          onClick={() => setShowLogs((v) => !v)}
          className="w-full flex items-center justify-between px-5 py-3 hover:bg-secondary/30 transition"
        >
          <div className="flex items-center gap-2">
            <Activity className="h-4 w-4 text-primary" />
            <span className="font-display text-sm font-semibold">Live Activity</span>
            {job.status === "running" && (
              <span className="ml-1 inline-flex h-1.5 w-1.5 rounded-full bg-primary pulse-dot" />
            )}
          </div>
          {showLogs ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
        </button>
        {showLogs && (
          <div className="border-t border-border/40 max-h-56 overflow-y-auto scrollbar-thin font-mono text-xs">
            {(job.logs ?? []).length === 0 ? (
              <div className="px-5 py-6 text-muted-foreground">Waiting for activity…</div>
            ) : (
              <ul className="divide-y divide-border/30">
                {[...(job.logs ?? [])].reverse().map((l, i) => (
                  <li key={i} className="px-5 py-2 flex gap-3">
                    <span className="text-muted-foreground/70 shrink-0">
                      {new Date(l.ts).toLocaleTimeString()}
                    </span>
                    <span className="text-foreground/90">{l.message}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>

      <div className="glass-card rounded-2xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3 border-b border-border/40">
          <h3 className="font-display text-sm font-semibold">Lead Database</h3>
          <span className="text-[11px] font-mono text-muted-foreground">{leads.length} rows</span>
        </div>
        <div className="overflow-x-auto scrollbar-thin">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-[10px] uppercase tracking-[0.14em] font-mono text-muted-foreground bg-secondary/30">
                <th className="text-left px-4 py-2.5">Brand</th>
                <th className="text-left px-4 py-2.5">Phones</th>
                <th className="text-left px-4 py-2.5">Emails</th>
                <th className="text-left px-4 py-2.5">Socials</th>
                <th className="text-left px-4 py-2.5">Address</th>
                <th className="text-left px-4 py-2.5">Links</th>
              </tr>
            </thead>
            <tbody>
              {leads.length === 0 && (
                <tr><td colSpan={6} className="px-4 py-12 text-center text-muted-foreground text-sm">
                  {job.status === "running" ? "Scraping in progress…" : "No leads yet."}
                </td></tr>
              )}
              {leads.map((l) => {
                const phones = [l.phone_1, l.phone_2, l.phone_3].filter(Boolean) as string[];
                const emails = l.emails ?? [];
                return (
                <tr key={l.id} className="border-t border-border/30 hover:bg-secondary/20 align-top">
                  <td className="px-4 py-3 max-w-[220px]">
                    <div className="font-medium truncate">{l.brand_name ?? "—"}</div>
                    <div className="text-[11px] text-muted-foreground mt-0.5 font-mono">
                      {l.enriched ? <span className="text-primary">enriched</span> : "raw"}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-xs">
                    {phones.length === 0 ? <span className="text-muted-foreground">—</span> : phones.map((p, i) => (
                      <div key={i} className="flex items-center gap-1.5 text-muted-foreground">
                        <Phone className="h-3 w-3" /> {p}
                      </div>
                    ))}
                  </td>
                  <td className="px-4 py-3 text-xs max-w-[220px]">
                    {emails.length === 0 ? (
                      <span className="text-muted-foreground">—</span>
                    ) : (
                      <div className="space-y-0.5">
                        {emails.slice(0, 3).map((e) => (
                          <div key={e} className="flex items-center gap-1.5 text-muted-foreground truncate">
                            <Mail className="h-3 w-3 shrink-0" /> <span className="truncate">{e}</span>
                          </div>
                        ))}
                        {emails.length > 3 && <div className="text-[10px] text-muted-foreground">+{emails.length - 3} more</div>}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      {l.facebook_url && <a href={l.facebook_url} target="_blank" rel="noreferrer" className="text-muted-foreground hover:text-primary"><Facebook className="h-4 w-4" /></a>}
                      {l.instagram_url && <a href={l.instagram_url} target="_blank" rel="noreferrer" className="text-muted-foreground hover:text-primary"><Instagram className="h-4 w-4" /></a>}
                      {!l.facebook_url && !l.instagram_url && <span className="text-muted-foreground text-xs">—</span>}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground max-w-[260px]">
                    {l.address ? (
                      <span className="flex items-start gap-1.5"><MapPin className="h-3 w-3 mt-0.5 shrink-0" /><span className="line-clamp-2">{l.address}</span></span>
                    ) : "—"}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      {l.website_url && <a href={l.website_url} target="_blank" rel="noreferrer" className="text-muted-foreground hover:text-primary"><Globe className="h-4 w-4" /></a>}
                      {l.google_maps_url && <a href={l.google_maps_url} target="_blank" rel="noreferrer" className="text-muted-foreground hover:text-primary"><ExternalLink className="h-4 w-4" /></a>}
                    </div>
                  </td>
                </tr>
              );})}
            </tbody>
          </table>
        </div>
      </div>
    </motion.div>
  );
};

const Stat = ({ label, value, accent }: { label: string; value: number | string; accent?: boolean }) => (
  <div className={cn(
    "rounded-xl p-4 border",
    accent ? "bg-primary/5 border-primary/20" : "bg-secondary/30 border-border/40",
  )}>
    <div className="text-[10px] tracking-[0.18em] font-mono text-muted-foreground">{label}</div>
    <div className={cn("font-display text-2xl font-bold mt-1", accent && "bg-gradient-primary bg-clip-text text-transparent")}>
      {value}
    </div>
  </div>
);