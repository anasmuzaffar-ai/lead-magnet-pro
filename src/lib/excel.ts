import * as XLSX from "xlsx";

export type LeadRow = {
  brand_name: string | null;
  owner_name: string | null;
  phone_1: string | null;
  phone_2: string | null;
  phone_3: string | null;
  emails: string[] | null;
  facebook_url: string | null;
  instagram_url: string | null;
  address: string | null;
  google_maps_url: string | null;
  website_url: string | null;
};

export function downloadLeadsXlsx(query: string, leads: LeadRow[]) {
  const rows = leads.map((l) => ({
    "Brand Name": l.brand_name ?? "",
    "Owner / Contact Person": l.owner_name ?? "",
    "Contact Number 1": l.phone_1 ?? "",
    "Contact Number 2": l.phone_2 ?? "",
    "Contact Number 3": l.phone_3 ?? "",
    "All Email Addresses": (l.emails ?? []).join(", "),
    "Facebook URL": l.facebook_url ?? "",
    "Instagram URL": l.instagram_url ?? "",
    "Address": l.address ?? "",
    "Google Maps URL": l.google_maps_url ?? "",
    "Website URL": l.website_url ?? "",
  }));
  const ws = XLSX.utils.json_to_sheet(rows);
  ws["!cols"] = [
    { wch: 32 }, { wch: 24 }, { wch: 18 }, { wch: 18 }, { wch: 18 },
    { wch: 40 }, { wch: 36 }, { wch: 36 }, { wch: 50 }, { wch: 40 }, { wch: 36 },
  ];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Leads");
  const safe = query.replace(/[^a-z0-9]+/gi, "_").slice(0, 40) || "leads";
  XLSX.writeFile(wb, `${safe}_${Date.now()}.xlsx`);
}