import { DESIRED_RADAR } from "./radar-catalog.js";
// Entries are inert until an editor reviews restrictions and explicitly enables them.
// No credentials, story-specific URLs or account identifiers belong in this registry.
const EXISTING = [
  {
    id: "sbp",
    name: "State Bank of Pakistan",
    type: "html-index",
    url: "https://www.sbp.org.pk/press/2026/index.htm",
    hosts: ["www.sbp.org.pk", "sbp.org.pk"],
    category: "Economy",
    role: "primary",
    owner: "SBP",
    authority: 1,
    priority: 100,
    intervalMinutes: 120,
    linkPattern: "/press/",
    restrictionNote:
      "Primary release index; PDF documents require manual evidence completion.",
  },
  {
    id: "pbs",
    name: "Pakistan Bureau of Statistics",
    type: "rss",
    url: "https://www.pbs.gov.pk/feed/",
    hosts: ["www.pbs.gov.pk", "pbs.gov.pk"],
    category: "Economy",
    role: "primary",
    owner: "PBS",
    authority: 1,
    priority: 95,
    intervalMinutes: 120,
    restrictionNote:
      "Official RSS discovery; verify statistical release dates and original tables.",
  },
  {
    id: "fbr",
    name: "Federal Board of Revenue",
    type: "html-index",
    url: "https://www.fbr.gov.pk/",
    hosts: ["www.fbr.gov.pk", "fbr.gov.pk", "download1.fbr.gov.pk"],
    category: "Business",
    role: "primary",
    owner: "FBR",
    authority: 1,
    priority: 95,
    intervalMinutes: 180,
    linkPattern: "/pr/|/sros",
    restrictionNote:
      "Restrict discovery to releases and regulatory notifications; PDF evidence is manual.",
  },
  {
    id: "finance",
    name: "Finance Division",
    type: "html-index",
    url: "https://www.finance.gov.pk/",
    hosts: ["www.finance.gov.pk", "finance.gov.pk"],
    category: "Economy",
    role: "primary",
    owner: "Finance Division",
    authority: 1,
    priority: 95,
    intervalMinutes: 180,
    linkPattern: "press|notification",
    restrictionNote:
      "Official index; permission/robots review required before unattended polling.",
  },
  {
    id: "courts",
    name: "Supreme Court judicial material",
    type: "manual",
    url: "https://www.supremecourt.gov.pk/",
    hosts: ["www.supremecourt.gov.pk", "supremecourt.gov.pk"],
    category: "Politics",
    role: "primary",
    owner: "Supreme Court",
    authority: 1,
    priority: 100,
    intervalMinutes: 240,
    restrictionNote:
      "Manual URL and document evidence intake; no claim of automated judgment extraction.",
  },
  {
    id: "psx",
    name: "Pakistan Stock Exchange disclosures",
    type: "manual",
    url: "https://dps.psx.com.pk/",
    hosts: ["dps.psx.com.pk", "www.psx.com.pk"],
    category: "Business",
    role: "primary",
    owner: "PSX",
    authority: 1,
    priority: 95,
    intervalMinutes: 120,
    restrictionNote:
      "Manual disclosure evidence; authenticated/dynamic endpoints are not scraped.",
  },
  {
    id: "dawn",
    name: "Dawn discovery",
    type: "rss",
    url: "https://www.dawn.com/feeds/home",
    hosts: ["www.dawn.com", "dawn.com"],
    category: "Pakistan",
    role: "reporting",
    owner: "Dawn Media",
    authority: 0.85,
    priority: 70,
    intervalMinutes: 120,
    restrictionNote:
      "Disabled: documented permission for newsroom discovery is required; see RADAR-AUDIT.md. Earlier technical RSS access is not permission. Headlines/links only.",
  },
  {
    id: "reuters",
    name: "Reuters corroboration",
    type: "manual",
    url: "https://www.reuters.com/world/asia-pacific/",
    hosts: ["www.reuters.com", "reuters.com"],
    category: "World",
    role: "reporting",
    owner: "Reuters",
    authority: 0.95,
    priority: 80,
    intervalMinutes: 240,
    restrictionNote:
      "Manual attributed evidence only; no paywall bypass or automated article copying.",
  },
].map((s) => ({ ...s, purpose: s.role === "primary" ? "evidence" : "radar", enabled: false, restrictionsReviewed: false }));

// Preserve working endpoints. Desired placeholders have no polling connector.
export const SOURCES = [
 ...EXISTING.map(s=>{
  const desired=DESIRED_RADAR.find(d=>d.id===s.id);
  return desired ? {...s,...desired,type:s.type,url:s.url,hosts:s.hosts} :
   {...s,desiredEditorialRole:"primary-evidence",priorityTier:null,coverage:[s.category],
    disabledReason:s.restrictionNote,discovery:{mechanism:s.type,endpoint:s.type==="manual"?null:s.url,reference:s.url},
    discoveryPermission:{status:"unreviewed",endpoint:null,hosts:[]}};
 }),
 ...DESIRED_RADAR.filter(d=>!EXISTING.some(s=>s.id===d.id)),
];
