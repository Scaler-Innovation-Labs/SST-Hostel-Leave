import useSWR from "swr";

import { getUsersUrl, getUserUrl } from "@/lib/api/user-api";

const fetcher = (url: string) => fetch(url).then((r) => r.json()).then((r) => r.data ?? r);

export function useUsers(params?: {
  search?: string;
  role?: string;
  isActive?: string;
  page?: number;
  limit?: number;
}) {
  const url = getUsersUrl(params);

  const { data, error, isLoading, mutate } = useSWR(url, fetcher);

  return {
    data: data as {
      items: Array<{
        id: string;
        fullName: string;
        email: string;
        phone?: string;
        gender?: string;
        isActive: boolean;
        lastLoginAt?: string;
        createdAt: string;
        userRoles: Array<{
          roleId: string;
          roleCode: string;
          roleName: string;
          assignedAt: string;
        }>;
      }>;
      total: number;
      page: number;
      totalPages: number;
    },
    isLoading,
    isError: !!error,
    error,
    mutate,
  };
}

export function useUser(id: string) {
  const url = id ? getUserUrl(id) : null;

  const { data, error, isLoading, mutate } = useSWR(url, fetcher);

  return {
    user: data as {
      id: string;
      fullName: string;
      email: string;
      phone?: string;
      gender?: string;
      isActive: boolean;
      lastLoginAt?: string;
      createdAt: string;
      userRoles: Array<{
        roleId: string;
        roleCode: string;
        roleName: string;
        assignedAt: string;
      }>;
    } | null,
    isLoading,
    isError: !!error,
    error,
    mutate,
  };
}
