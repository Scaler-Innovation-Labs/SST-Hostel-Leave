import { ZodError } from "zod";

import { AppError } from "@/lib/errors/app-error";
import { TooManyRequestsError } from "@/lib/errors/rate-limit-error";
import { logger } from "@/lib/logger";

export class ApiResponse {
  static success<T>(data: T, status = 200) {
    return Response.json(
      {
        success: true,
        data,
      },
      { status }
    );
  }

  static created<T>(data: T) {
    return this.success(data, 201);
  }

  static error(code: string, message: string, status: number = 500, headers?: Record<string, string>) {
    return Response.json(
      {
        success: false,
        error: {
          code,
          message,
        },
      },
      { status, headers }
    );
  }

  static fromError(error: unknown) {
    if (error instanceof TooManyRequestsError) {
      // Rate-limit responses carry Retry-After so clients/WAFs can back
      // off instead of mistaking throttling for a validation failure.
      return this.error(error.code, error.message, error.statusCode, {
        "Retry-After": String(error.retryAfterSeconds),
      });
    }
    if (error instanceof AppError) {
      return this.error(error.code, error.message, error.statusCode);
    }

    if (error instanceof ZodError) {
      const messages = error.issues.map((issue) => {
        const field = issue.path.length > 0 ? `${issue.path.join(".")}: ` : "";
        return `${field}${issue.message}`;
      });
      return this.error("VALIDATION_ERROR", messages.join("; "), 400);
    }

    if (error instanceof Error) {
      const meta: Record<string, unknown> = { error: error.message, name: error.name };
      if ("cause" in error && error.cause instanceof Error) {
        meta.cause = error.cause.message;
        meta.causeStack = error.cause.stack;
      }
      if ("query" in error) {
        const queryError = error as { query?: unknown };
        meta.query = queryError.query;
      }
      if ("params" in error) {
        const paramsError = error as { params?: unknown };
        meta.params = paramsError.params;
      }
      logger.error("Unhandled API error", meta);
    } else {
      logger.error("Unhandled API error", { error: String(error) });
    }
    return this.error("INTERNAL_ERROR", "An unexpected error occurred", 500);
  }
}
