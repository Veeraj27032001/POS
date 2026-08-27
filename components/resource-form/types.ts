export type ResourceFieldType =
  "text" | "textarea" | "number" | "boolean" | "select" | "multi-select" | "date" | "file";

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
