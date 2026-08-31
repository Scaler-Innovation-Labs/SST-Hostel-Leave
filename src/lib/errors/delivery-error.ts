import { AppError } from "./app-error";

/**
 * An outbound notification did not reach its recipient.
 *
 * Distinct from the other domain errors because it is *retryable* and it is
 * never the caller's fault: the outbox worker catches it, leaves the event
 * unprocessed, and tries again. Swallowing it would mark the event PROCESSED
 * while nothing was actually sent.
 */
export class DeliveryError extends AppError {
  constructor(message: string) {
    super(message, 502, "DELIVERY_FAILED");
    this.name = "DeliveryError";
  }
}
