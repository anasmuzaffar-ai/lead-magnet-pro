import { useEffect, useState } from "react";
import { Radar } from "lucide-react";
import { ApiKeysCard } from "@/components/leadgen/ApiKeysCard";
import { SearchPanel } from "@/components/leadgen/SearchPanel";
import { JobsSidebar } from "@/components/leadgen/JobsSidebar";
import { JobDetail } from "@/components/leadgen/JobDetail";
import { supabase } from "@/integrations/supabase/client";

const Index = () => {
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);

  useEffect(() => {
    document.title = "Lead Generator — Mission Control";
    const meta = document.querySelector('meta[name="description"]') ?? (() => {
      const m = document.createElement("meta"); m.setAttribute("name", "description"); document.head.appendChild(m); return m;
    })();
    meta.setAttribute("content", "One-click lead generation: scrape Google Maps, enrich emails & socials, export Excel.");

    (async () => {
      const { data } = await supabase.from("jobs").select("id").order("created_at", { ascending: false }).limit(1);
      if (data && data.length > 0) setSelectedJobId(data[0].id);
    })();
  }, []);

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-30 backdrop-blur-xl bg-background/70 border-b border-border/40">
        <div className="max-w-[1400px] mx-auto px-5 lg:px-8 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="relative h-10 w-10 rounded-xl bg-gradient-primary grid place-items-center shadow-glow">
              <Radar className="h-5 w-5 text-primary-foreground" />
              <span className="absolute inset-0 rounded-xl ring-1 ring-primary/30" />
            </div>
            <div>
              <h1 className="font-display text-lg font-bold tracking-tight leading-tight">Lead Generator</h1>
              <p className="text-[11px] font-mono text-muted-foreground tracking-wider">AUTOMATED PROSPECTING WORKBENCH</p>
            </div>
          </div>
          <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full bg-secondary/40 border border-border/40">
            <span className="h-1.5 w-1.5 rounded-full bg-success pulse-dot" />
            <span className="text-[11px] font-mono text-muted-foreground">SYSTEMS ONLINE</span>
          </div>
        </div>
      </header>

      <main className="max-w-[1400px] mx-auto px-5 lg:px-8 py-6 lg:py-8">
        <div className="flex flex-col lg:flex-row gap-6">
          <JobsSidebar selectedId={selectedJobId} onSelect={setSelectedJobId} />

          <div className="flex-1 min-w-0 space-y-6">
            <ApiKeysCard />
            <SearchPanel onJobStart={setSelectedJobId} />
            {selectedJobId ? (
              <JobDetail jobId={selectedJobId} />
            ) : (
              <div className="glass-card rounded-2xl p-10 text-center">
                <p className="text-sm text-muted-foreground">Run your first search above to see live progress here.</p>
              </div>
            )}
          </div>
        </div>

        <footer className="mt-12 pt-6 border-t border-border/30 text-center text-[11px] font-mono text-muted-foreground tracking-wider">
          POWERED BY APIFY · SERPAPI · LOVABLE CLOUD
        </footer>
      </main>
    </div>
  );
};

export default Index;