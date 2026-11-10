export const VERTICALS = [
  { value: "sports_picks", label: "Sports Picks" },
  { value: "crypto_trading", label: "Crypto Trading" },
  { value: "coaching_courses", label: "Coaching & Courses" },
  { value: "communities", label: "Communities" },
  { value: "software_saas", label: "Software / SaaS" },
  { value: "templates", label: "Templates" },
  { value: "agency", label: "Agency" },
  { value: "content_media", label: "Content & Media" },
  { value: "affiliate_networks", label: "Affiliate Networks" },
] as const;

export type VerticalValue = (typeof VERTICALS)[number]["value"];

export { VERTICAL_COLORS } from "@/lib/constants/brand-colors";
