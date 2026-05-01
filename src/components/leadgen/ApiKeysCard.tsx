import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Eye, EyeOff, KeyRound, ShieldCheck, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export const ApiKeysCard = () => {
  const [apify, setApify] = useState("");
  const [serp, setSerp] = useState("");
  const [showA, setShowA] = useState(false);
  const [showS, setShowS] = useState(false);
  const [rowId, setRowId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("api_keys").select("*").limit(1).maybeSingle();
      if (data) {
        setRowId(data.id);
        setApify(data.apify_token ?? "");
        setSerp(data.serpapi_key ?? "");
      }
      setLoaded(true);
    })();
  }, []);

  const save = async () => {
    setSaving(true);
    const payload = { apify_token: apify || null, serpapi_key: serp || null, updated_at: new Date().toISOString() };
    const { error } = rowId
      ? await supabase.from("api_keys").update(payload).eq("id", rowId)
      : await supabase.from("api_keys").insert(payload);
    setSaving(false);
    if (error) toast.error("Failed to save keys", { description: error.message });
    else toast.success("API keys saved securely");
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass-card glow-border rounded-2xl p-6"
    >
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-gradient-primary grid place-items-center shadow-glow">
            <KeyRound className="h-5 w-5 text-primary-foreground" />
          </div>
          <div>
            <h3 className="font-display text-base font-semibold tracking-tight">API Credentials</h3>
            <p className="text-xs text-muted-foreground flex items-center gap-1.5">
              <ShieldCheck className="h-3 w-3" /> Stored securely on the server
            </p>
          </div>
        </div>
        <Button
          onClick={save}
          disabled={saving || !loaded}
          className="bg-gradient-primary text-primary-foreground hover:opacity-90 shadow-glow font-semibold"
        >
          {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
          Save Keys
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <KeyField
          label="APIFY API TOKEN"
          value={apify}
          onChange={setApify}
          show={showA}
          onToggle={() => setShowA(!showA)}
          placeholder="apify_api_..."
        />
        <KeyField
          label="SERPAPI API KEY"
          value={serp}
          onChange={setSerp}
          show={showS}
          onToggle={() => setShowS(!showS)}
          placeholder="Enter SerpAPI key"
        />
      </div>
    </motion.div>
  );
};

const KeyField = ({
  label, value, onChange, show, onToggle, placeholder,
}: {
  label: string; value: string; onChange: (v: string) => void;
  show: boolean; onToggle: () => void; placeholder: string;
}) => (
  <div>
    <Label className="text-[10px] tracking-[0.18em] font-mono text-muted-foreground">{label}</Label>
    <div className="relative mt-1.5">
      <Input
        type={show ? "text" : "password"}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="bg-secondary/40 border-border/60 font-mono text-sm pr-10 h-11"
      />
      <button
        type="button"
        onClick={onToggle}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition"
      >
        {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </button>
    </div>
  </div>
);