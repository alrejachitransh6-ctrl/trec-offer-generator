/** Static, app-wide configuration and metadata. */
export const siteConfig = {
  name: "TREC Offer Generator",
  description:
    "Generate filled TREC real-estate contract forms from structured offer data.",
  url: process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000",
} as const;

export type SiteConfig = typeof siteConfig;
