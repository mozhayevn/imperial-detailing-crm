import { apiRequest } from "@/src/lib/api/client";
import type {
  UserListItem,
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