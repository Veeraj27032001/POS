export type ResourceFieldType =
  "text" | "textarea" | "number" | "boolean" | "select" | "date" | "file";

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
}
