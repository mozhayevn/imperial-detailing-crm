import { apiRequest } from "@/src/lib/api/client";
import type { RecentAuditEvent } from "@/src/features/audits/types";

export async function getRecentAuditEvents(
  limit = 50,
): Promise<RecentAuditEvent[]> {
  const searchParams = new URLSearchParams();

  searchParams.set("limit", String(limit));

  return apiRequest<RecentAuditEvent[]>(
    `/audit/recent?${searchParams.toString()}`,
    {
      method: "GET",
    },
  );
}