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

    logger.error("Unhandled API error", { error: error instanceof Error ? error.message : String(error) });
    return this.error("INTERNAL_ERROR", "An unexpected error occurred", 500);
  }
}
