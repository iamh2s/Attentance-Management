export class BackendError extends Error {
  code: string;

  constructor(
    message: string,
    code = "backend/unknown",
  ) {
    super(message);
    this.name = "BackendError";
    this.code = code;
  }
}