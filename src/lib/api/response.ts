import { ZodError } from "zod";

import { AppError } from "@/lib/errors/app-error";
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

  static error(code: string, message: string, status: number = 500) {
    return Response.json(
      {
        success: false,
        error: {
          code,
          message,
        },
      },
      { status }
    );
  }

  static fromError(error: unknown) {
    if (error instanceof AppError) {
      return this.error(error.code, error.message, error.statusCode);
    }

    if (error instanceof ZodError) {
      return this.error("VALIDATION_ERROR", error.message, 400);
    }

    if (error instanceof Error) {
      const meta: Record<string, unknown> = { error: error.message, name: error.name };
      if ("cause" in error && error.cause instanceof Error) {
        meta.cause = error.cause.message;
        meta.causeStack = error.cause.stack;
      }
      if ("query" in error) meta.query = (error as any).query;
      if ("params" in error) meta.params = (error as any).params;
      logger.error("Unhandled API error", meta);
    } else {
      logger.error("Unhandled API error", { error: String(error) });
    }
    return this.error("INTERNAL_ERROR", "An unexpected error occurred", 500);
  }
}
