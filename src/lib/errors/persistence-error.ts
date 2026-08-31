import { AppError } from "./app-error";

/**
 * A write reached the database but came back in a shape the repository cannot
 * honour — a RETURNING clause with no row, say.
 *
 * This is an invariant violation rather than a user-facing condition: it means
 * the query and the schema disagree, so it surfaces as a 500 and should be
 * investigated, not retried.
 */
export class PersistenceError extends AppError {
  constructor(message: string) {
    super(message, 500, "PERSISTENCE_ERROR");
    this.name = "PersistenceError";
  }
}
