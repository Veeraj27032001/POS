import type { ZodType } from "zod";

export interface FieldError {
  field: string;
  code: string;
  message: string;
}

export type ParseOutcome<T> =
  { success: true; data: T } | { success: false; fieldErrors: FieldError[] };

export function parseOrFieldErrors<T>(schema: ZodType<T>, input: unknown): ParseOutcome<T> {
  const result = schema.safeParse(input);
  if (result.success) {
    return { success: true, data: result.data };
  }

  const fieldErrors: FieldError[] = result.error.issues.map((issue) => ({
    field: issue.path.join(".") || "_root",
    code: issue.code,
    message: issue.message,
  }));
  return { success: false, fieldErrors };
}
