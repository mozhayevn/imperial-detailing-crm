import { LeadDetailsPageClient } from "@/src/features/leads/lead-details-page-client";

export default async function LeadDetailsPage({
  params,
}: {
  params: Promise<{
    leadId: string;
  }>;
}) {
  const { leadId } = await params;

  return <LeadDetailsPageClient leadId={leadId} />;
}