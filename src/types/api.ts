export type ApiResponse<T = unknown> = {
  success: boolean;
  data?: T;
  error?: ApiError;
}

export type ApiError = {
  code: string;
  message: string;
  details?: unknown;
}
