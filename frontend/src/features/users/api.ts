import { apiRequest } from "@/src/lib/api/client";
import type {
  UserListItem,
  UserPublicListItem,
  UserPublicProfile,
  UserRolesResponse,
  UserWithRoles,
} from "@/src/features/users/types";

export async function getUsers(): Promise<UserListItem[]> {
  return apiRequest<UserListItem[]>("/users/", {
    method: "GET",
  });
}

export async function getUserRoles(userId: number): Promise<UserRolesResponse> {
  return apiRequest<UserRolesResponse>(`/users/${userId}/roles`, {
    method: "GET",
  });
}

export async function getUsersWithRoles(): Promise<UserWithRoles[]> {
  const users = await getUsers();

  const usersWithRoles = await Promise.all(
    users.map(async (user) => {
      try {
        const roleInfo = await getUserRoles(user.id);

        return {
          ...user,
          roles: roleInfo.roles,
        };
      } catch {
        return {
          ...user,
          roles: [],
        };
      }
    }),
  );

  return usersWithRoles;
}

export async function getUserPublicProfile(
  userId: string | number,
): Promise<UserPublicProfile> {
  return apiRequest<UserPublicProfile>(`/users/${userId}/public-profile`, {
    method: "GET",
  });
}

export async function getPublicUsers(): Promise<UserPublicListItem[]> {
  return apiRequest<UserPublicListItem[]>("/users/public", {
    method: "GET",
  });
}