// Conservative groups supported by first-party brand pages, reviewed 2026-09-13.
// Grouping does not establish editorial independence of syndicated reporting.
export const GROUPS = [
 {group:"jang-geo", ids:["geo","the-news","jang"], hosts:["geo.tv","thenews.com.pk","jang.com.pk"], reference:"https://solutions.jang.com.pk/"},
 {group:"express", ids:["tribune","express"], hosts:["tribune.com.pk","express.pk","express.com.pk"], reference:"https://tribune.com.pk/about"},
 {group:"recorder", ids:["aaj","business-recorder"], hosts:["english.aaj.tv","aaj.tv","brecorder.com"], reference:"https://english.aaj.tv/contact-us"},
];
export function knownGroup(source) {
 let host=""; try { host=new URL(source?.url).hostname.replace(/^www\./, ""); } catch {}
 return GROUPS.find(g=>g.ids.includes(source?.id)||g.hosts.includes(host));
}
export function ownershipGroup(source) {
 if (!source) return null;
 const known=knownGroup(source);
 if (known) return known.group; // A renamed owner cannot split known sister brands.
 if (source.role === "primary") return source.owner?.trim() || null;
 const review=source.ownership;
 return review?.status === "reviewed" && typeof review.group === "string" &&
   review.group.trim() && typeof review.reference === "string" && /^https:\/\//.test(review.reference)
   ? review.group.trim() : null;
}
