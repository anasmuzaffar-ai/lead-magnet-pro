// Lead Generator orchestrator: scrapes Google Maps via Apify, enriches via SerpAPI + website fetch
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

type Lead = {
  brand_name: string | null;
  owner_name: string | null;
  phone_1: string | null;
  phone_2: string | null;
  phone_3: string | null;
  emails: string[];
  facebook_url: string | null;
  instagram_url: string | null;
  address: string | null;
  google_maps_url: string | null;
  website_url: string | null;
};

const EMAIL_RE = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
const FB_RE = /https?:\/\/(?:www\.|m\.|web\.)?facebook\.com\/[A-Za-z0-9_.\-/?=&%]+/i;
const IG_RE = /https?:\/\/(?:www\.)?instagram\.com\/[A-Za-z0-9_.\-/?=&%]+/i;

function dedupe<T>(arr: T[]): T[] { return Array.from(new Set(arr)); }

function pickPhones(item: any): [string|null, string|null, string|null] {
  const phones: string[] = [];
  if (item.phone) phones.push(String(item.phone));
  if (Array.isArray(item.phones)) for (const p of item.phones) phones.push(String(p));
  if (Array.isArray(item.phoneUnformatted)) for (const p of item.phoneUnformatted) phones.push(String(p));
  if (item.phoneUnformatted && typeof item.phoneUnformatted === "string") phones.push(item.phoneUnformatted);
  if (Array.isArray(item.additionalInfo)) {
    for (const g of item.additionalInfo) {
      if (Array.isArray(g)) for (const v of g) if (typeof v === "string" && /\d/.test(v) && v.length < 30) phones.push(v);
    }
  }
  const uniq = dedupe(phones.map(p => p.trim()).filter(Boolean));
  return [uniq[0] ?? null, uniq[1] ?? null, uniq[2] ?? null];
}

function pickEmails(item: any): string[] {
  const out: string[] = [];
  if (Array.isArray(item.emails)) out.push(...item.emails);
  if (typeof item.email === "string") out.push(item.email);
  return dedupe(out.map(e => e.toLowerCase().trim()).filter(e => EMAIL_RE.test(e)));
}

function normalizeApifyItem(item: any): Lead {
  const [p1, p2, p3] = pickPhones(item);
  const fb = item.facebook || item.facebookUrl || null;
  const ig = item.instagram || item.instagramUrl || null;
  return {
    brand_name: item.title || item.name || null,
    owner_name: null,
    phone_1: p1, phone_2: p2, phone_3: p3,
    emails: pickEmails(item),
    facebook_url: fb,
    instagram_url: ig,
    address: item.address || item.fullAddress || null,
    google_maps_url: item.url || item.placeUrl || null,
    website_url: item.website || item.websiteUrl || null,
  };
}

async function appendLog(supabase: any, jobId: string, logs: any[], message: string) {
  const entry = { ts: new Date().toISOString(), message };
  logs.push(entry);
  await supabase.from("jobs").update({ logs }).eq("id", jobId);
  console.log(`[job ${jobId}]`, message);
}

async function updateJob(supabase: any, jobId: string, patch: Record<string, unknown>) {
  await supabase.from("jobs").update(patch).eq("id", jobId);
}

async function runApify(token: string, query: string, maxResults: number): Promise<any[]> {
  const url = `https://api.apify.com/v2/acts/compass~crawler-google-places/run-sync-get-dataset-items?token=${encodeURIComponent(token)}`;
  const body = {
    searchStringsArray: [query],
    maxCrawledPlacesPerSearch: maxResults,
    language: "en",
    skipClosedPlaces: false,
    scrapeContacts: true,
  };
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Apify error ${res.status}: ${await res.text()}`);
  return await res.json();
}

async function serpSearch(key: string, q: string): Promise<any> {
  const url = `https://serpapi.com/search.json?engine=google&num=10&q=${encodeURIComponent(q)}&api_key=${encodeURIComponent(key)}`;
  const res = await fetch(url);
  if (!res.ok) return null;
  return await res.json().catch(() => null);
}

async function fetchPageText(url: string): Promise<string> {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 10000);
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: { "User-Agent": "Mozilla/5.0 LeadGenBot/1.0" },
    });
    clearTimeout(t);
    if (!res.ok) return "";
    const text = await res.text();
    return text.slice(0, 300_000);
  } catch { return ""; }
}

async function enrichLead(lead: Lead, serpKey: string | null): Promise<Lead> {
  // 1. Scrape website itself
  if (lead.website_url) {
    const html = await fetchPageText(lead.website_url);
    if (html) {
      const found = (html.match(EMAIL_RE) || []).map(e => e.toLowerCase());
      lead.emails = dedupe([...lead.emails, ...found]).filter(e => !/\.(png|jpg|jpeg|gif|svg|webp)$/i.test(e)).slice(0, 10);
      if (!lead.facebook_url) {
        const m = html.match(FB_RE); if (m) lead.facebook_url = m[0];
      }
      if (!lead.instagram_url) {
        const m = html.match(IG_RE); if (m) lead.instagram_url = m[0];
      }
      // Try /contact
      try {
        const u = new URL(lead.website_url);
        for (const path of ["/contact", "/contact-us", "/about"]) {
          if (lead.emails.length > 0 && lead.facebook_url && lead.instagram_url) break;
          const sub = await fetchPageText(`${u.origin}${path}`);
          if (sub) {
            const found2 = (sub.match(EMAIL_RE) || []).map(e => e.toLowerCase());
            lead.emails = dedupe([...lead.emails, ...found2]).filter(e => !/\.(png|jpg|jpeg|gif|svg|webp)$/i.test(e)).slice(0, 10);
            if (!lead.facebook_url) { const m = sub.match(FB_RE); if (m) lead.facebook_url = m[0]; }
            if (!lead.instagram_url) { const m = sub.match(IG_RE); if (m) lead.instagram_url = m[0]; }
          }
        }
      } catch {}
    }
  }

  // 2. SerpAPI for missing socials/emails
  if (serpKey && lead.brand_name) {
    if (!lead.facebook_url) {
      const r = await serpSearch(serpKey, `${lead.brand_name} site:facebook.com`);
      const link = r?.organic_results?.find((x: any) => /facebook\.com/i.test(x.link))?.link;
      if (link) lead.facebook_url = link;
    }
    if (!lead.instagram_url) {
      const r = await serpSearch(serpKey, `${lead.brand_name} site:instagram.com`);
      const link = r?.organic_results?.find((x: any) => /instagram\.com/i.test(x.link))?.link;
      if (link) lead.instagram_url = link;
    }
    if (lead.emails.length === 0) {
      const r = await serpSearch(serpKey, `${lead.brand_name} ${lead.address ?? ""} email contact`);
      const blob = JSON.stringify(r?.organic_results ?? []);
      const found = (blob.match(EMAIL_RE) || []).map(e => e.toLowerCase()).filter(e => !/\.(png|jpg|jpeg|gif|svg|webp)$/i.test(e));
      lead.emails = dedupe(found).slice(0, 5);
    }
  }
  return lead;
}

async function process(jobId: string) {
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const { data: job } = await supabase.from("jobs").select("*").eq("id", jobId).single();
  if (!job) return;
  const logs: any[] = Array.isArray(job.logs) ? job.logs : [];

  // Resolve API keys (DB first, then env fallback)
  const { data: keysRow } = await supabase.from("api_keys").select("*").limit(1).maybeSingle();
  const apifyToken = keysRow?.apify_token || Deno.env.get("APIFY_API_TOKEN") || "";
  const serpKey = keysRow?.serpapi_key || Deno.env.get("SERPAPI_API_KEY") || "";

  if (!apifyToken) {
    await updateJob(supabase, jobId, {
      status: "failed", error: "Missing APIFY_API_TOKEN. Add it in the dashboard.", finished_at: new Date().toISOString(),
    });
    return;
  }

  try {
    await updateJob(supabase, jobId, { status: "running", stage: "scraping", progress: 5 });
    await appendLog(supabase, jobId, logs, `🔎 Scraping Google Maps for "${job.query}" (max ${job.max_results})…`);

    const items = await runApify(apifyToken, job.query, job.max_results);
    await appendLog(supabase, jobId, logs, `✅ Apify returned ${items.length} raw listings.`);

    // Normalize + dedupe by maps url / brand+address
    const seen = new Set<string>();
    const leads: Lead[] = [];
    for (const it of items) {
      const lead = normalizeApifyItem(it);
      const key = (lead.google_maps_url || `${lead.brand_name}|${lead.address}`).toLowerCase().trim();
      if (seen.has(key)) continue;
      seen.add(key);
      leads.push(lead);
    }
    await appendLog(supabase, jobId, logs, `🧹 Deduplicated to ${leads.length} unique leads.`);
    await updateJob(supabase, jobId, { total_leads: leads.length, stage: "enriching", progress: 25 });

    // Insert pre-enrich rows
    if (leads.length > 0) {
      const rows = leads.map(l => ({ job_id: jobId, ...l, enriched: false }));
      // chunk inserts
      for (let i = 0; i < rows.length; i += 100) {
        await supabase.from("leads").insert(rows.slice(i, i + 100));
      }
    }

    // Enrich
    if (job.enrich) {
      await appendLog(supabase, jobId, logs, `🌐 Enriching missing emails & socials…`);
      const { data: dbLeads } = await supabase.from("leads").select("*").eq("job_id", jobId);
      const list = dbLeads ?? [];
      let done = 0;
      const BATCH = 4;
      for (let i = 0; i < list.length; i += BATCH) {
        const slice = list.slice(i, i + BATCH);
        await Promise.all(slice.map(async (row: any) => {
          const updated = await enrichLead({
            brand_name: row.brand_name, owner_name: row.owner_name,
            phone_1: row.phone_1, phone_2: row.phone_2, phone_3: row.phone_3,
            emails: row.emails ?? [], facebook_url: row.facebook_url, instagram_url: row.instagram_url,
            address: row.address, google_maps_url: row.google_maps_url, website_url: row.website_url,
          }, serpKey || null);
          await supabase.from("leads").update({ ...updated, enriched: true }).eq("id", row.id);
        }));
        done += slice.length;
        const pct = 25 + Math.round((done / Math.max(1, list.length)) * 70);
        await updateJob(supabase, jobId, { enriched_count: done, progress: Math.min(95, pct) });
      }
      await appendLog(supabase, jobId, logs, `✨ Enrichment complete (${done}/${list.length}).`);
    } else {
      await updateJob(supabase, jobId, { enriched_count: leads.length, progress: 95 });
    }

    await appendLog(supabase, jobId, logs, `📦 Preparing Excel file…`);
    await updateJob(supabase, jobId, {
      status: "completed", stage: "completed", progress: 100, finished_at: new Date().toISOString(),
    });
    await appendLog(supabase, jobId, logs, `🎉 Done!`);
  } catch (err) {
    console.error(err);
    await appendLog(supabase, jobId, logs, `❌ Error: ${(err as Error).message}`);
    await updateJob(supabase, jobId, {
      status: "failed", error: (err as Error).message, finished_at: new Date().toISOString(),
    });
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const { jobId } = await req.json();
    if (!jobId) {
      return new Response(JSON.stringify({ error: "jobId required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    // @ts-ignore EdgeRuntime is Deno Deploy global
    EdgeRuntime.waitUntil(process(jobId));
    return new Response(JSON.stringify({ ok: true, jobId }), {
      status: 202, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});