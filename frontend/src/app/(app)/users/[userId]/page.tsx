import { UserPublicProfilePageClient } from "@/src/features/users/user-public-profile-page-client";

export default async function UserPublicProfilePage({
  params,
}: {
  params: Promise<{
    userId: string;
  }>;
}) {
  const { userId } = await params;

  return <UserPublicProfilePageClient userId={userId} />;
}