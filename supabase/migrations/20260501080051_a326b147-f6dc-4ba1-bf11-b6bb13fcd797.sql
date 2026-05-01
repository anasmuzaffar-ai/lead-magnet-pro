
-- API keys (single-user tool, public access)
CREATE TABLE public.api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  apify_token TEXT,
  serpapi_key TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Jobs
CREATE TABLE public.jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  query TEXT NOT NULL,
  max_results INTEGER NOT NULL DEFAULT 200,
  enrich BOOLEAN NOT NULL DEFAULT true,
  status TEXT NOT NULL DEFAULT 'queued',
  stage TEXT,
  total_leads INTEGER NOT NULL DEFAULT 0,
  enriched_count INTEGER NOT NULL DEFAULT 0,
  progress INTEGER NOT NULL DEFAULT 0,
  logs JSONB NOT NULL DEFAULT '[]'::jsonb,
  error TEXT,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  finished_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_jobs_created_at ON public.jobs (created_at DESC);

-- Leads
CREATE TABLE public.leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  brand_name TEXT,
  owner_name TEXT,
  phone_1 TEXT,
  phone_2 TEXT,
  phone_3 TEXT,
  emails TEXT[],
  facebook_url TEXT,
  instagram_url TEXT,
  address TEXT,
  google_maps_url TEXT,
  website_url TEXT,
  enriched BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_leads_job_id ON public.leads (job_id);

-- RLS: public access (single-user tool, no auth)
ALTER TABLE public.api_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public read api_keys" ON public.api_keys FOR SELECT USING (true);
CREATE POLICY "public write api_keys" ON public.api_keys FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "public read jobs" ON public.jobs FOR SELECT USING (true);
CREATE POLICY "public write jobs" ON public.jobs FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "public read leads" ON public.leads FOR SELECT USING (true);
CREATE POLICY "public write leads" ON public.leads FOR ALL USING (true) WITH CHECK (true);

-- Realtime
ALTER TABLE public.jobs REPLICA IDENTITY FULL;
ALTER TABLE public.leads REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.jobs;
ALTER PUBLICATION supabase_realtime ADD TABLE public.leads;

-- Seed single api_keys row
INSERT INTO public.api_keys (apify_token, serpapi_key) VALUES (NULL, NULL);
