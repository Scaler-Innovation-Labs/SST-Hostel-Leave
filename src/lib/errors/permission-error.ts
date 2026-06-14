import { AppError } from "./app-error";

export class PermissionError extends AppError {
  constructor(message = "Permission denied") {
    super(message, 403, "PERMISSION_DENIED");
    this.name = "PermissionError";
  }
}
