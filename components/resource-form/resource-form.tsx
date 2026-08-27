"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import type { Control, FieldValues } from "react-hook-form";
import { Controller, useForm, useWatch } from "react-hook-form";
import type { ZodType } from "zod";

import { FileUploadField } from "@/components/file-upload-field";
import { MultiSearchableSelect } from "@/components/multi-searchable-select";
import { RequiredMark } from "@/components/required-mark";
import { SearchableSelect } from "@/components/searchable-select";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { DialogFormActions, DialogFormBody } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useSubmitGuard } from "@/lib/forms/useSubmitGuard";
import { useOptionsList } from "@/lib/masters/useOptionsList";
import { cn } from "@/lib/utils";

import { getRequiredFieldNames } from "./types";
import type { ResourceFieldConfig } from "./types";

export interface ResourceFormProps<T extends FieldValues> {
  schema: ZodType<T>;
  fields: ResourceFieldConfig[];
  defaultValues?: Partial<T>;
  onSubmit: (values: T) => Promise<void>;
  submitLabel?: string;
  /** Schema to derive the required-field (*) indicator from — pass the
   * *create* schema even on an edit form, since .partial() update schemas
   * mark every field optional. Defaults to `schema`. */
  requiredFieldsSchema?: ZodType;
}

function FieldLabel({
  htmlFor,
  label,
  required,
}: {
  htmlFor: string;
  label: string;
  required: boolean;
}) {
  return (
    <Label htmlFor={htmlFor}>
      {label}
      {required && <RequiredMark />}
    </Label>
  );
}

function DynamicSelectField<T extends FieldValues>({
  field,
  control,
  required,
}: {
  field: ResourceFieldConfig;
  control: Control<T>;
  required: boolean;
}) {
  const watched = useWatch({ control, name: (field.dependsOn ?? "") as never }) as unknown;
  const dependsOnValue = field.dependsOn ? (watched as string | undefined) : undefined;
  const ready = !field.dependsOn || Boolean(dependsOnValue);
  const options = useOptionsList(
    ready ? field.optionsResource! : "",
    field.optionsLabelField ?? "name",
    field.dependsOn && dependsOnValue ? `${field.dependsOn}=${dependsOnValue}` : undefined,
  );

  // Nothing to show yet (dependency not chosen), or the dependency has no
  // options for it (e.g. a country other than India has no seeded states) —
  // either way, this field just isn't relevant right now.
  if (field.dependsOn && (!ready || options.length === 0)) return null;

  return (
    <div className="space-y-1.5">
      <FieldLabel htmlFor={field.name} label={field.label} required={required} />
      <Controller
        name={field.name as never}
        control={control}
        render={({ field: f }) =>
          field.type === "multi-select" ? (
            <MultiSearchableSelect
              options={options}
              value={(f.value as string[]) ?? []}
              onChange={f.onChange}
              placeholder={field.placeholder}
            />
          ) : (
            <SearchableSelect
              options={options}
              value={(f.value as string) ?? null}
              onChange={f.onChange}
              placeholder={field.placeholder}
            />
          )
        }
      />
    </div>
  );
}

export function ResourceForm<T extends FieldValues>({
  schema,
  fields,
  defaultValues,
  onSubmit,
  submitLabel = "Save",
  requiredFieldsSchema,
}: ResourceFormProps<T>) {
  const requiredFields = getRequiredFieldNames(requiredFieldsSchema ?? schema);
  // Multi-select fields need to start as [] rather than undefined — Zod's
  // array().min(1) reports "expected array, received undefined" otherwise,
  // not the field's actual custom message.
  const resolvedDefaults: Record<string, unknown> = { ...defaultValues };
  for (const field of fields) {
    if (field.type === "multi-select" && resolvedDefaults[field.name] === undefined) {
      resolvedDefaults[field.name] = [];
    }
  }

  const {
    register,
    handleSubmit,
    control,
    formState: { errors, isSubmitting },
  } = useForm<T>({
    resolver: zodResolver(schema as never) as never,
    defaultValues: resolvedDefaults as never,
  });

  const guardedSubmit = useSubmitGuard(onSubmit);
  const fullWidthTypes = new Set(["textarea", "file", "boolean", "multi-select"]);

  return (
    <form
      onSubmit={handleSubmit(guardedSubmit)}
      className="flex min-h-0 flex-1 flex-col overflow-hidden"
    >
      <DialogFormBody>
        {fields.map((field) => {
          const fieldError = errors[field.name as keyof T];
          const spanClass = fullWidthTypes.has(field.type) ? "sm:col-span-2" : undefined;

          if ((field.type === "select" || field.type === "multi-select") && field.optionsResource) {
            return (
              <div key={field.name} className={spanClass}>
                <DynamicSelectField
                  field={field}
                  control={control}
                  required={requiredFields.has(field.name)}
                />
                {fieldError && (
                  <p className="text-sm text-red-600">
                    {String(fieldError.message ?? "Invalid value")}
                  </p>
                )}
              </div>
            );
          }

          return (
            <div key={field.name} className={cn("space-y-1.5", spanClass)}>
              {field.type !== "boolean" && (
                <FieldLabel
                  htmlFor={field.name}
                  label={field.label}
                  required={requiredFields.has(field.name)}
                />
              )}

              {field.type === "boolean" && (
                <Controller
                  name={field.name as never}
                  control={control}
                  render={({ field: f }) => (
                    <div className="flex items-center gap-2">
                      <Checkbox
                        id={field.name}
                        checked={Boolean(f.value)}
                        onCheckedChange={(checked) => f.onChange(checked)}
                      />
                      <Label htmlFor={field.name}>{field.label}</Label>
                    </div>
                  )}
                />
              )}

              {field.type === "textarea" && (
                <Textarea
                  id={field.name}
                  placeholder={field.placeholder}
                  {...register(field.name as never)}
                />
              )}

              {field.type === "select" && (
                <Controller
                  name={field.name as never}
                  control={control}
                  render={({ field: f }) => (
                    <Select
                      value={f.value as string}
                      onValueChange={f.onChange}
                      items={field.options}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder={field.placeholder} />
                      </SelectTrigger>
                      <SelectContent>
                        {field.options?.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              )}

              {field.type === "file" && (
                <Controller
                  name={field.name as never}
                  control={control}
                  render={({ field: f }) => (
                    <FileUploadField value={(f.value as string) ?? null} onChange={f.onChange} />
                  )}
                />
              )}

              {(field.type === "text" || field.type === "number" || field.type === "date") && (
                <Input
                  id={field.name}
                  type={
                    field.type === "number" ? "number" : field.type === "date" ? "date" : "text"
                  }
                  placeholder={field.placeholder}
                  {...register(
                    field.name as never,
                    field.type === "number"
                      ? { setValueAs: (v) => (v === "" || v === null ? undefined : Number(v)) }
                      : {},
                  )}
                />
              )}

              {fieldError && (
                <p className="text-sm text-red-600">
                  {String(fieldError.message ?? "Invalid value")}
                </p>
              )}
            </div>
          );
        })}
      </DialogFormBody>

      <DialogFormActions>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Saving…" : submitLabel}
        </Button>
      </DialogFormActions>
    </form>
  );
}
