import type { ZodType } from "zod";

export type ResourceFieldType =
  "text" | "textarea" | "number" | "boolean" | "select" | "multi-select" | "date" | "file";

/** Field names a schema requires (not .optional()/.nullable()) — used to
 * show a required-field indicator without hand-maintaining it per field.
 * Pass the *create* schema even for an edit form, since .partial() update
 * schemas make every field optional and would defeat the point. */
export function getRequiredFieldNames(schema: ZodType): Set<string> {
  const shape = (schema as unknown as { shape?: Record<string, { isOptional(): boolean }> }).shape;
  if (!shape) return new Set();
  return new Set(
    Object.entries(shape)
      .filter(([, fieldSchema]) => !fieldSchema.isOptional())
      .map(([name]) => name),
  );
}

export interface ResourceFieldOption {
  value: string;
  label: string;
}

export interface ResourceFieldConfig {
  name: string;
  label: string;
  type: ResourceFieldType;
  options?: ResourceFieldOption[];
  placeholder?: string;
  /** Fetches options from /api/{optionsResource} instead of using a static `options` list. */
  optionsResource?: string;
  /** Field the label comes from in each fetched row (default "name"). */
  optionsLabelField?: string;
  /** Name of another field this one depends on — refetches when it changes,
   * querying `?{dependsOn}={value}`, and renders nothing until it's set or
   * the fetch comes back empty (e.g. State, which only has options for
   * countries that actually have states seeded). */
  dependsOn?: string;
}
