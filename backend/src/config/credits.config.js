/**
 * credits.config.js
 *
 * Centralized credit consumption policy and pricing tiers.
 */

export const CREDIT_COSTS = Object.freeze({
  ASSISTANT_QUERY: 3,
  REPORT_PDF: 5,
  REPORT_XLSX: 2,
  REPORT_CSV: 1,
  ANALYTICS_QUERY: 1,
});

export const CREDIT_PACKS = Object.freeze([
  {
    id: "pack_starter",
    name: "Starter Pack",
    credits: 300,
    priceInPaise: 29900, // ₹299.00
    currency: "INR",
    description: "Ideal for individual data analysis and weekly reporting.",
  },
  {
    id: "pack_growth",
    name: "Growth Pack",
    credits: 1200,
    priceInPaise: 99900, // ₹999.00 (20% bonus credits)
    currency: "INR",
    description: "Great for teams running regular AI queries and exporting executive summaries.",
  },
  {
    id: "pack_scale",
    name: "Scale Pack",
    credits: 3500,
    priceInPaise: 249900, // ₹2,499.00 (40% bonus credits)
    currency: "INR",
    description: "For high-volume organizations running automated pipelines and advanced analytics.",
  },
]);

export const WELCOME_CREDIT_BONUS = 50.00;
