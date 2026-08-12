"use client";

import useSWR from "swr";

import type { AnalyticsPeriod } from "@/dto/analytics/analytics-period.dto";
import type { LeaveAnalytics } from "@/dto/analytics/leave-analytics.dto";
import type { MovementAnalytics } from "@/dto/analytics/movement-analytics.dto";
import type { RejectionAnalytics } from "@/dto/analytics/rejection-analytics.dto";
import type { StudentAnalytics } from "@/dto/analytics/student-analytics.dto";
import {
  getLeaveAnalyticsUrl,
  getMovementAnalyticsUrl,
  getRejectionAnalyticsUrl,
  getStudentAnalyticsUrl,
} from "@/lib/api/analytics-api";

type SwrResponse<T> = {
  data: T | null;
  isLoading: boolean;
  isError: boolean;
  mutate: () => void;
};

export function useStudentAnalytics(period: AnalyticsPeriod): SwrResponse<StudentAnalytics> {
  const { data, error, isLoading, mutate } = useSWR<{ data: StudentAnalytics }>(
    getStudentAnalyticsUrl(period),
    { keepPreviousData: true },
  );
  return { data: data?.data ?? null, isLoading, isError: !!error, mutate };
}

export function useLeaveAnalytics(period: AnalyticsPeriod): SwrResponse<LeaveAnalytics> {
  const { data, error, isLoading, mutate } = useSWR<{ data: LeaveAnalytics }>(
    getLeaveAnalyticsUrl(period),
    { keepPreviousData: true },
  );
  return { data: data?.data ?? null, isLoading, isError: !!error, mutate };
}

export function useMovementAnalytics(period: AnalyticsPeriod): SwrResponse<MovementAnalytics> {
  const { data, error, isLoading, mutate } = useSWR<{ data: MovementAnalytics }>(
    getMovementAnalyticsUrl(period),
    { keepPreviousData: true },
  );
  return { data: data?.data ?? null, isLoading, isError: !!error, mutate };
}

export function useRejectionAnalytics(period: AnalyticsPeriod): SwrResponse<RejectionAnalytics> {
  const { data, error, isLoading, mutate } = useSWR<{ data: RejectionAnalytics }>(
    getRejectionAnalyticsUrl(period),
    { keepPreviousData: true },
  );
  return { data: data?.data ?? null, isLoading, isError: !!error, mutate };
}