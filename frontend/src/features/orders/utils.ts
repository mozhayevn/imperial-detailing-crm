import type {
  OrderAuditLog,
  ParsedOrderAuditDetails,
} from "@/src/features/orders/types";

export function isOrderPricingLocked(pricingLocked: boolean): boolean {
  return pricingLocked;
}

export function canEditOrder(pricingLocked: boolean): boolean {
  return !pricingLocked;
}

export function getOrderItemsCountLabel(itemsCount: number): string {
  if (itemsCount === 1) {
    return "1 позиция";
  }

  if (itemsCount >= 2 && itemsCount <= 4) {
    return `${itemsCount} позиции`;
  }

  return `${itemsCount} позиций`;
}

export function parseOrderAuditDetails(
  log: OrderAuditLog,
): ParsedOrderAuditDetails | null {
  if (!log.details) {
    return null;
  }

  try {
    const parsed = JSON.parse(log.details);

    if (typeof parsed === "object" && parsed !== null) {
      return parsed as ParsedOrderAuditDetails;
    }

    return null;
  } catch {
    return null;
  }
}