import { LeadContactDetailsPageClient } from "@/src/features/leads/lead-contact-details-page-client";

export default async function LeadContactDetailsPage({
  params,
}: {
  params: Promise<{
    leadContactId: string;
  }>;
}) {
  const { leadContactId } = await params;

  return <LeadContactDetailsPageClient leadContactId={leadContactId} />;
}