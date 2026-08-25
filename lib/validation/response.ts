import { NextResponse } from "next/server";
import type { ZodType } from "zod";

import type { FieldError } from "./fieldErrors";
import { parseOrFieldErrors } from "./fieldErrors";

export interface ApiErrorBody {
  error: {
    code: string;
    message: string;
    fields?: FieldError[];
  };
}

export function validationErrorResponse(fieldErrors: FieldError[]): NextResponse<ApiErrorBody> {
  return NextResponse.json(
    {
      error: {
        code: "validation_error",
        message: "One or more fields are invalid.",
        fields: fieldErrors,
      },
    },
    { status: 400 },
  );
}

export function apiErrorResponse(
  code: string,
  message: string,
  status: number,
): NextResponse<ApiErrorBody> {
  return NextResponse.json({ error: { code, message } }, { status });
}

export type ParsedJsonBody<T> = { data: T } | { response: NextResponse<ApiErrorBody> };

export async function parseJsonOrRespond<T>(
  request: Request,
  schema: ZodType<T>,
): Promise<ParsedJsonBody<T>> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return {
      response: validationErrorResponse([
        { field: "_root", code: "invalid_json", message: "Request body must be valid JSON." },
      ]),
    };
  }

  const result = parseOrFieldErrors(schema, body);
  if (!result.success) {
    return { response: validationErrorResponse(result.fieldErrors) };
  }
  return { data: result.data };
}
