import { AppError } from "./app-error";

export class TooManyRequestsError extends AppError {
  constructor(
    message: string,
    public readonly retryAfterSeconds: number
  ) {
    super(message, 429, "TOO_MANY_REQUESTS");
    this.name = "TooManyRequestsError";
  }
}
