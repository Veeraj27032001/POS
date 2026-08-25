"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import type { FieldValues } from "react-hook-form";
import { Controller, useForm } from "react-hook-form";
import type { ZodType } from "zod";

import { FileUploadField } from "@/components/file-upload-field";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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

import type { ResourceFieldConfig } from "./types";

export interface ResourceFormProps<T extends FieldValues> {
  schema: ZodType<T>;
  fields: ResourceFieldConfig[];
  defaultValues?: Partial<T>;
  onSubmit: (values: T) => Promise<void>;
  submitLabel?: string;
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

  return (
    <form onSubmit={handleSubmit(guardedSubmit)} className="space-y-4">
      {fields.map((field) => {
        const fieldError = errors[field.name as keyof T];
        return (
          <div key={field.name} className="space-y-1.5">
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
                type={field.type === "number" ? "number" : field.type === "date" ? "date" : "text"}
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

      <Button type="submit" disabled={isSubmitting}>
        {isSubmitting ? "Saving…" : submitLabel}
      </Button>
    </form>
  );
}
