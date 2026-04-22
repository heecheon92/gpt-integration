"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import type { SalesRecord } from "@prisma/client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import type { CreateRecordSchema } from "@/lib/validation/record";
import { createRecordSchema } from "@/lib/validation/record";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";
import { Field, FieldError, FieldLabel } from "./ui/field";
import { Input } from "./ui/input";
import { LoadingButton } from "./ui/loading-button";
import { Textarea } from "./ui/textarea";

type AddSalesRecordDialogProps = {
  open: boolean;
  setOpen: (open: boolean) => void;
  recordToEdit?: SalesRecord;
};

export function AddSalesRecordDialog({
  open,
  setOpen,
  recordToEdit,
}: AddSalesRecordDialogProps) {
  const [deleteInProgress, setDeleteInProgress] = useState(false);
  const router = useRouter();
  const form = useForm<CreateRecordSchema>({
    resolver: zodResolver(createRecordSchema),
    defaultValues: {
      productName: recordToEdit?.productName ?? "",
      price: recordToEdit?.amount ?? 0,
      soldAt: recordToEdit?.soldAt
        ? new Date(recordToEdit.soldAt).toISOString().slice(0, 16)
        : new Date().toISOString().slice(0, 16),
    },
  });

  async function onSubmit(input: CreateRecordSchema) {
    try {
      if (recordToEdit) {
        const response = await fetch("/api/sales", {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            id: recordToEdit.id,
            ...input,
          }),
        });
        if (!response.ok) {
          throw new Error("Failed to update sales record.");
        }
      } else {
        const response = await fetch("/api/sales", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(input),
        });
        if (!response.ok) {
          throw new Error("Failed to create sales record.");
        }
        form.reset();
      }

      router.refresh();
      setOpen(false);
    } catch (error) {
      console.error(error);
      alert("Something went wrong.");
    }
  }

  async function deleteRecord() {
    if (!recordToEdit) return;
    setDeleteInProgress(true);
    try {
      const response = await fetch("/api/sales", {
        method: "DELETE",
        body: JSON.stringify({ id: recordToEdit.id }),
      });
      if (!response.ok) throw new Error("Failed to delete sales record.");
      router.refresh();
      setOpen(false);
    } catch (error) {
      console.error(error);
      alert("Something went wrong.");
    } finally {
      setDeleteInProgress(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {recordToEdit ? "Edit Sales Record" : "Add Sales Record"}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-3">
          <Controller
            control={form.control}
            name="productName"
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <FieldLabel htmlFor={field.name}>제품명</FieldLabel>
                <Input
                  {...field}
                  id={field.name}
                  placeholder="product name"
                  aria-invalid={fieldState.invalid}
                />
                <FieldError errors={[fieldState.error]} />
              </Field>
            )}
          />

          <Controller
            control={form.control}
            name="price"
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <FieldLabel htmlFor={field.name}>가격</FieldLabel>
                <Textarea
                  {...field}
                  id={field.name}
                  placeholder="얼마?"
                  aria-invalid={fieldState.invalid}
                />
                <FieldError errors={[fieldState.error]} />
              </Field>
            )}
          />

          <Controller
            control={form.control}
            name="soldAt"
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <FieldLabel htmlFor={field.name}>판매일</FieldLabel>
                <Input
                  {...field}
                  id={field.name}
                  type="datetime-local"
                  aria-invalid={fieldState.invalid}
                />
                <FieldError errors={[fieldState.error]} />
              </Field>
            )}
          />

          <DialogFooter className="gap-1 sm:gap-0">
            {recordToEdit && (
              <LoadingButton
                type="button"
                variant="destructive"
                loading={deleteInProgress}
                onClick={deleteRecord}
                disabled={form.formState.isSubmitting}
              >
                Delete Sales Record
              </LoadingButton>
            )}
            <LoadingButton type="submit" loading={form.formState.isSubmitting}>
              Submit
            </LoadingButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
