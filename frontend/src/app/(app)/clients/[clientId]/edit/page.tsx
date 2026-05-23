import { ClientEditPageClient } from "@/src/features/clients/client-edit-page-client";

type ClientEditPageProps = {
  params: Promise<{
    clientId: string;
  }>;
};

export default async function ClientEditPage({ params }: ClientEditPageProps) {
  const { clientId } = await params;

  return <ClientEditPageClient clientId={Number(clientId)} />;
}