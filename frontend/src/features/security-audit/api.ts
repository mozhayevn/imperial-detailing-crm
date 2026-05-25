import { apiRequest } from "@/src/lib/api/client";
import type { SecurityAuditLog } from "@/src/features/security-audit/types";

export async function getSecurityAuditLogs(
  limit = 10,
): Promise<SecurityAuditLog[]> {
  const searchParams = new URLSearchParams();

  searchParams.set("limit", String(limit));

  return apiRequest<SecurityAuditLog[]>(
    `/security-audit?${searchParams.toString()}`,
    {
      method: "GET",
    },
  );
}