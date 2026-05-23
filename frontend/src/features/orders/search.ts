import type { OrderFilters } from "@/src/features/orders/types";

export type ParsedOrderSearch =
  | {
      type: "empty";
      label: string;
      filters: OrderFilters;
      orderId: null;
    }
  | {
      type: "order_id";
      label: string;
      filters: OrderFilters;
      orderId: number;
    }
  | {
      type: "phone";
      label: string;
      filters: OrderFilters;
      orderId: null;
    }
  | {
      type: "plate_number";
      label: string;
      filters: OrderFilters;
      orderId: null;
    }
  | {
      type: "client_name";
      label: string;
      filters: OrderFilters;
      orderId: null;
    };

function normalizeSearch(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

function isPhoneLike(value: string) {
  const digits = value.replace(/\D/g, "");

  return (
    value.startsWith("+") ||
    digits.length >= 7 ||
    value.startsWith("87") ||
    value.startsWith("77")
  );
}

function isOrderIdLike(value: string) {
  return /^#?\d+$/.test(value) || /^order:\d+$/i.test(value);
}

function extractOrderId(value: string) {
  const normalized = value.toLowerCase().replace("order:", "").replace("#", "");
  const id = Number(normalized);

  return Number.isFinite(id) && id > 0 ? id : null;
}

function hasCyrillic(value: string) {
  return /[а-яё]/i.test(value);
}

function looksLikePlateNumber(value: string) {
  const compact = value.replace(/\s+/g, "");

  return /^[a-zа-я0-9-]{2,12}$/i.test(compact) && !hasCyrillic(value);
}

export function parseOrderSearch(value: string): ParsedOrderSearch {
  const search = normalizeSearch(value);

  if (!search) {
    return {
      type: "empty",
      label: "Все заказы",
      filters: {},
      orderId: null,
    };
  }

  if (isOrderIdLike(search)) {
    const orderId = extractOrderId(search);

    if (orderId) {
      return {
        type: "order_id",
        label: `Заказ #${orderId}`,
        filters: {},
        orderId,
      };
    }
  }

  if (isPhoneLike(search)) {
    return {
      type: "phone",
      label: `Телефон: ${search}`,
      filters: {
        phone: search,
      },
      orderId: null,
    };
  }

  if (hasCyrillic(search) || search.includes(" ")) {
    return {
      type: "client_name",
      label: `Клиент: ${search}`,
      filters: {
        client_name: search,
      },
      orderId: null,
    };
  }

  if (looksLikePlateNumber(search)) {
    return {
      type: "plate_number",
      label: `Госномер: ${search.toUpperCase()}`,
      filters: {
        plate_number: search,
      },
      orderId: null,
    };
  }

  return {
    type: "client_name",
    label: `Клиент: ${search}`,
    filters: {
      client_name: search,
    },
    orderId: null,
  };
}