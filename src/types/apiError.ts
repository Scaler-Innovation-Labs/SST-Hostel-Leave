export default class ApiError<TDetails = unknown> {
  code: string;
  message: string;
  details?: TDetails;

  /**
   * @param code - Unique error code
   * @param message - Human-readable message
   * @param details - Optional additional info about the error
   */
  constructor(code: string, message: string, details?: TDetails) {
    this.code = code;
    this.message = message;
    this.details = details;
  }
}