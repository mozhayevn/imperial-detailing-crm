export const DEFAULT_PAGE_SIZE = 20;

export const orderStatuses = [
  "new",
  "confirmed",
  "in_progress",
  "completed",
  "delivered",
  "canceled",
] as const;

export type OrderStatus = (typeof orderStatuses)[number];

export const pricingWarningLevels = ["none", "low_margin", "negative_profit"] as const;

export type PricingWarningLevel = (typeof pricingWarningLevels)[number];