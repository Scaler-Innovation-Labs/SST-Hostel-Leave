"use client";

import useSWR from "swr";

import type { AnalyticsPeriod } from "@/dto/analytics/analytics-period.dto";
import type { LeaveAnalytics } from "@/dto/analytics/leave-analytics.dto";
import type { MovementAnalytics } from "@/dto/analytics/movement-analytics.dto";
import type { RejectionAnalytics } from "@/dto/analytics/rejection-analytics.dto";
import type { StaffAnalytics } from "@/dto/analytics/staff-analytics.dto";
import type { StudentAnalytics } from "@/dto/analytics/student-analytics.dto";
import {
  getLeaveAnalyticsUrl,
  getMovementAnalyticsUrl,
  getRejectionAnalyticsUrl,
  getStaffAnalyticsUrl,
  getStudentAnalyticsUrl,
} from "@/lib/api/analytics-api";

type SwrResponse<T> = {
  data: T | null;
  isLoading: boolean;
  isError: boolean;
  mutate: () => void;
};

export function useStudentAnalytics(
  period: AnalyticsPeriod,
  startDate?: string,
  endDate?: string
): SwrResponse<StudentAnalytics> {
  const { data, error, isLoading, mutate } = useSWR<{ data: StudentAnalytics }>(
    getStudentAnalyticsUrl(period, startDate, endDate),
    { keepPreviousData: true },
  );
  return { data: data?.data ?? null, isLoading, isError: !!error, mutate };
}

export function useLeaveAnalytics(
  period: AnalyticsPeriod,
  startDate?: string,
  endDate?: string
): SwrResponse<LeaveAnalytics> {
  const { data, error, isLoading, mutate } = useSWR<{ data: LeaveAnalytics }>(
    getLeaveAnalyticsUrl(period, startDate, endDate),
    { keepPreviousData: true },
  );
  return { data: data?.data ?? null, isLoading, isError: !!error, mutate };
}

export function useMovementAnalytics(
  period: AnalyticsPeriod,
  startDate?: string,
  endDate?: string
): SwrResponse<MovementAnalytics> {
  const { data, error, isLoading, mutate } = useSWR<{ data: MovementAnalytics }>(
    getMovementAnalyticsUrl(period, startDate, endDate),
    { keepPreviousData: true },
  );
  return { data: data?.data ?? null, isLoading, isError: !!error, mutate };
}

export function useRejectionAnalytics(
  period: AnalyticsPeriod,
  startDate?: string,
  endDate?: string
): SwrResponse<RejectionAnalytics> {
  const { data, error, isLoading, mutate } = useSWR<{ data: RejectionAnalytics }>(
    getRejectionAnalyticsUrl(period, startDate, endDate),
    { keepPreviousData: true },
  );
  return { data: data?.data ?? null, isLoading, isError: !!error, mutate };
}

export function useStaffAnalytics(
  period: AnalyticsPeriod,
  startDate?: string,
  endDate?: string
): SwrResponse<StaffAnalytics> {
  const { data, error, isLoading, mutate } = useSWR<{ data: StaffAnalytics }>(
    getStaffAnalyticsUrl(period, startDate, endDate),
    { keepPreviousData: true },
  );
  return { data: data?.data ?? null, isLoading, isError: !!error, mutate };
}
