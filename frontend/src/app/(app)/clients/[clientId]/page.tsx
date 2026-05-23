import { ClientDetailsPageClient } from "@/src/features/clients/client-details-page-client";

type ClientDetailsPageProps = {
  params: Promise<{
    clientId: string;
  }>;
};

export default async function ClientDetailsPage({
  params,
}: ClientDetailsPageProps) {
  const { clientId } = await params;

  return <ClientDetailsPageClient clientId={Number(clientId)} />;
}