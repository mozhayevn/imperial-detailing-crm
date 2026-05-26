import { apiRequest } from "@/src/lib/api/client";
import type {
  Lead,
  LeadAuditLog,
  LeadConfirmPayload,
  LeadConfirmResponse,
  LeadContact,
  LeadCreatePayload,
  LeadStatus,
} from "@/src/features/leads/types";

export type GetLeadsParams = {
  status?: LeadStatus | "all";
  source?: string;
  phone?: string;
  assigned_user_id?: number;
};

export async function getLeads(params: GetLeadsParams = {}): Promise<Lead[]> {
  const searchParams = new URLSearchParams();

  if (params.status && params.status !== "all") {
    searchParams.set("status", params.status);
  }

  if (params.source) {
    searchParams.set("source", params.source);
  }

  if (params.phone) {
    searchParams.set("phone", params.phone);
  }

  if (params.assigned_user_id) {
    searchParams.set("assigned_user_id", String(params.assigned_user_id));
  }

  const query = searchParams.toString();

  return apiRequest<Lead[]>(query ? `/leads?${query}` : "/leads", {
    method: "GET",
  });
}

export async function createLead(payload: LeadCreatePayload): Promise<Lead> {
  return apiRequest<Lead>("/leads", {
    method: "POST",
    body: payload,
  });
}

export async function getLead(leadId: string | number): Promise<Lead> {
  return apiRequest<Lead>(`/leads/${leadId}`, {
    method: "GET",
  });
}

export async function updateLeadStatus(
  leadId: string | number,
  payload: {
    status: LeadStatus;
    comment?: string | null;
  },
): Promise<Lead> {
  return apiRequest<Lead>(`/leads/${leadId}/status`, {
    method: "PATCH",
    body: payload,
  });
}

export async function getLeadAuditLogs(
  leadId: string | number,
): Promise<LeadAuditLog[]> {
  return apiRequest<LeadAuditLog[]>(`/leads/${leadId}/audit-logs`, {
    method: "GET",
  });
}

export async function confirmLead(
  leadId: string | number,
  payload: LeadConfirmPayload,
): Promise<LeadConfirmResponse> {
  return apiRequest<LeadConfirmResponse>(`/leads/${leadId}/confirm`, {
    method: "POST",
    body: payload,
  });
}

export async function getLeadContacts(): Promise<LeadContact[]> {
  return apiRequest<LeadContact[]>("/leads/contacts", {
    method: "GET",
  });
}

export async function getLeadContact(
  leadContactId: string | number,
): Promise<LeadContact> {
  return apiRequest<LeadContact>(`/leads/contacts/${leadContactId}`, {
    method: "GET",
  });
}

export async function getLeadContactLeads(
  leadContactId: string | number,
): Promise<Lead[]> {
  return apiRequest<Lead[]>(`/leads/contacts/${leadContactId}/leads`, {
    method: "GET",
  });
}