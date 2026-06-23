import { AppError } from "./app-error";

export class ConfigurationError extends AppError {
  constructor(message = "Configuration error") {
    super(message, 500, "CONFIGURATION_ERROR");
    this.name = "ConfigurationError";
  }
}
