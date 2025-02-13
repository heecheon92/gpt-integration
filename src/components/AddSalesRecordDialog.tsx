"use client";

import {
  createRecordSchema,
  CreateRecordSchema,
} from "@/lib/validation/record";
import { zodResolver } from "@hookform/resolvers/zod";
import { SalesRecord } from "@prisma/client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "./ui/form";
import { Input } from "./ui/input";
import { LoadingButton } from "./ui/loading-button";
import { Textarea } from "./ui/textarea";

type AddSalesRecordDialogProps = {
  open: boolean;
  setOpen: (open: boolean) => void;
  recordToDelete?: SalesRecord;
};

export function AddSalesRecordDialog({
  open,
  setOpen,
  recordToDelete,
}: AddSalesRecordDialogProps) {
  const [deleteInProgress, setDeleteInProgress] = useState(false);
  const router = useRouter();
  const form = useForm<CreateRecordSchema>({
    resolver: zodResolver(createRecordSchema),
    defaultValues: {
      productName: recordToDelete?.productName ?? "",
      price: recordToDelete?.amount ?? 0,
      soldAt: recordToDelete?.soldAt
        ? new Date(recordToDelete.soldAt).toISOString().slice(0, 16)
        : new Date().toISOString().slice(0, 16),
    },
  });

  async function onSubmit(input: CreateRecordSchema) {
    try {
      if (recordToDelete) return;
      else {
        const response = await fetch("/api/sales", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(input),
        });
        if (!response.ok) {
          throw new Error("Failed to create note.");
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
    if (!recordToDelete) return;
    setDeleteInProgress(true);
    try {
      const response = await fetch(`/api/sales`, {
        method: "DELETE",
        body: JSON.stringify({ id: recordToDelete.id }),
      });
      if (!response.ok) throw new Error("Failed to delete note.");
      router.refresh();
      setOpen(false);
    } catch (error) {
      console.error(error);
      alert("Something went wrong.");
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{recordToDelete ? "Edit Note" : "Add Note"}</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-3">
            <FormField
              control={form.control}
              name="productName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>제품명</FormLabel>
                  <FormControl>
                    <Input placeholder="product name" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
              disabled={!!recordToDelete}
            />

            <FormField
              control={form.control}
              name="price"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>가격</FormLabel>
                  <FormControl>
                    <Textarea placeholder="얼마?" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
              disabled={!!recordToDelete}
            />

            <FormField
              control={form.control}
              name="soldAt"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>판매일</FormLabel>
                  <FormControl>
                    <Input type="datetime-local" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
              disabled={!!recordToDelete}
            />

            <DialogFooter className="gap-1 sm:gap-0">
              {recordToDelete && (
                <LoadingButton
                  type="button"
                  variant={"destructive"}
                  loading={deleteInProgress}
                  onClick={deleteRecord}
                  disabled={form.formState.isSubmitting}
                >
                  Delete Note
                </LoadingButton>
              )}
              <LoadingButton
                type="submit"
                loading={form.formState.isSubmitting}
              >
                Submit
              </LoadingButton>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
