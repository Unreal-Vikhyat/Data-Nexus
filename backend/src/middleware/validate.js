export function validate(schema, source = "body") {
  return (req, _res, next) => {
    const parsed = schema.safeParse(req[source]);
    if (!parsed.success) {
      const error = new Error("Validation failed");
      error.status = 400;
      error.code = "VALIDATION_ERROR";
      error.details = Object.fromEntries(parsed.error.issues.map((issue) => [issue.path.join(".") || source, issue.message]));
      return next(error);
    }
    req[source] = parsed.data;
    return next();
  };
}
