import type ApiError from "./apiError";
import type { HttpStatusCode } from "./statusCodes";

export default class ApiResponse<T> {
  success: boolean;
  statusCode: HttpStatusCode;
  message: string;
  data?: T;
  errors?: ApiError[];

  constructor(
    success: boolean,
    statusCode: HttpStatusCode,
    message: string,
    data?: T,
    errors?: ApiError[],
  ) {
    this.success = success;
    this.statusCode = statusCode;
    this.message = message;
    this.data = data;
    this.errors = errors;
  }
}