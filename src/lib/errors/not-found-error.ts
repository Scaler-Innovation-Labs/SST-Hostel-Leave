import { AppError } from "./app-error";

export class NotFoundError extends AppError {
  constructor(resource: string) {
    super(
      `${resource} not found`,
      404,
      "NOT_FOUND"
    );
    this.name = "NotFoundError";
  }
}