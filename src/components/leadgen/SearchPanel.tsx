import { useState } from "react";
import { motion } from "framer-motion";
import { Search, Sparkles, Loader2, Wand2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const SearchPanel = ({ onJobStart }: { onJobStart: (id: string) => void }) => {
  const [query, setQuery] = useState("");
  const [maxResults, setMaxResults] = useState(200);
  const [enrich, setEnrich] = useState(true);
  const [loading, setLoading] = useState(false);

  const start = async () => {
    if (!query.trim()) { toast.error("Enter a search query"); return; }
    setLoading(true);
    try {
      const { data: job, error } = await supabase
        .from("jobs")
        .insert({ query: query.trim(), max_results: maxResults, enrich, status: "queued" })
        .select()
        .single();
      if (error || !job) throw error;

      const { error: fnErr } = await supabase.functions.invoke("run-job", { body: { jobId: job.id } });
      if (fnErr) throw fnErr;

      toast.success("Lead generation started", { description: `"${query.trim()}"` });
      onJobStart(job.id);
      setQuery("");
    } catch (e: any) {
      toast.error("Could not start job", { description: e.message });
    } finally {
      setLoading(false);
    }
  };

  const examples = ["Women Salon in Karachi", "Coffee shops in Berlin", "Dental clinics in Dubai"];

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.05 }}
      className="glass-card rounded-2xl p-7 relative overflow-hidden"
    >
      <div className="absolute inset-0 grid-bg opacity-40 pointer-events-none" />
      <div className="absolute -top-24 -right-24 w-72 h-72 rounded-full bg-primary/20 blur-3xl pointer-events-none" />
      <div className="absolute -bottom-32 -left-20 w-72 h-72 rounded-full bg-accent/20 blur-3xl pointer-events-none" />

      <div className="relative">
        <div className="flex items-center gap-2 mb-1">
          <Sparkles className="h-4 w-4 text-primary" />
          <span className="text-[10px] tracking-[0.22em] font-mono text-primary uppercase">New Mission</span>
        </div>
        <h2 className="font-display text-3xl md:text-4xl font-bold tracking-tight">
          Generate enriched leads
          <span className="bg-gradient-primary bg-clip-text text-transparent"> in one click.</span>
        </h2>
        <p className="text-muted-foreground mt-2 max-w-xl">
          Describe the businesses you're looking for. We'll scrape Google Maps, enrich missing emails &amp; socials, and hand you a clean Excel.
        </p>

        <div className="mt-6 flex flex-col md:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && start()}
              placeholder="e.g. Women Salon in Karachi"
              className="h-14 pl-12 pr-4 text-base bg-secondary/40 border-border/60 rounded-xl"
              disabled={loading}
            />
          </div>
          <Button
            onClick={start}
            disabled={loading}
            className="h-14 px-7 bg-gradient-primary text-primary-foreground hover:opacity-90 shadow-glow font-semibold text-base rounded-xl"
          >
            {loading ? <Loader2 className="h-5 w-5 mr-2 animate-spin" /> : <Wand2 className="h-5 w-5 mr-2" />}
            Generate Leads
          </Button>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {examples.map((ex) => (
            <button
              key={ex}
              onClick={() => setQuery(ex)}
              className="text-xs font-mono px-3 py-1.5 rounded-full border border-border/60 bg-secondary/40 hover:bg-secondary hover:border-primary/40 transition text-muted-foreground hover:text-foreground"
            >
              {ex}
            </button>
          ))}
        </div>

        <div className="mt-6 flex flex-col sm:flex-row gap-4 items-stretch sm:items-center justify-between p-4 rounded-xl bg-secondary/30 border border-border/50">
          <div className="flex items-center gap-3">
            <Label htmlFor="max" className="text-[10px] tracking-[0.18em] font-mono text-muted-foreground whitespace-nowrap">MAX RESULTS</Label>
            <Input
              id="max"
              type="number"
              min={10}
              max={1000}
              value={maxResults}
              onChange={(e) => setMaxResults(Math.max(10, Math.min(1000, Number(e.target.value) || 0)))}
              className="w-24 h-9 bg-background/40 font-mono"
            />
          </div>
          <div className="h-px sm:h-6 sm:w-px bg-border/60" />
          <div className="flex items-center gap-3">
            <Switch id="enrich" checked={enrich} onCheckedChange={setEnrich} />
            <Label htmlFor="enrich" className="text-sm cursor-pointer">
              Enrich missing data via web search
            </Label>
          </div>
        </div>
      </div>
    </motion.div>
  );
};