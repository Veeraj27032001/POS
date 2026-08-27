"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import type { Control, FieldValues } from "react-hook-form";
import { Controller, useForm, useWatch } from "react-hook-form";
import type { ZodType } from "zod";

import { FileUploadField } from "@/components/file-upload-field";
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

import type { ResourceFieldConfig } from "./types";

export interface ResourceFormProps<T extends FieldValues> {
  schema: ZodType<T>;
  fields: ResourceFieldConfig[];
  defaultValues?: Partial<T>;
  onSubmit: (values: T) => Promise<void>;
  submitLabel?: string;
}

function DynamicSelectField<T extends FieldValues>({
  field,
  control,
}: {
  field: ResourceFieldConfig;
  control: Control<T>;
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
      <Label htmlFor={field.name}>{field.label}</Label>
      <Controller
        name={field.name as never}
        control={control}
        render={({ field: f }) => (
          <SearchableSelect
            options={options}
            value={(f.value as string) ?? null}
            onChange={f.onChange}
            placeholder={field.placeholder}
          />
        )}
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
}: ResourceFormProps<T>) {
  const {
    register,
    handleSubmit,
    control,
    formState: { errors, isSubmitting },
  } = useForm<T>({
    resolver: zodResolver(schema as never) as never,
    defaultValues: defaultValues as never,
  });

  const guardedSubmit = useSubmitGuard(onSubmit);
  const fullWidthTypes = new Set(["textarea", "file", "boolean"]);

  return (
    <form
      onSubmit={handleSubmit(guardedSubmit)}
      className="flex min-h-0 flex-1 flex-col overflow-hidden"
    >
      <DialogFormBody>
        {fields.map((field) => {
          const fieldError = errors[field.name as keyof T];
          const spanClass = fullWidthTypes.has(field.type) ? "sm:col-span-2" : undefined;

          if (field.type === "select" && field.optionsResource) {
            return (
              <div key={field.name} className={spanClass}>
                <DynamicSelectField field={field} control={control} />
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
              {field.type !== "boolean" && <Label htmlFor={field.name}>{field.label}</Label>}

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
