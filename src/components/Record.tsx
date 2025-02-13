"use client";
import { SalesRecord } from "@prisma/client";
import { useState } from "react";
import { AddSalesRecordDialog } from "./AddSalesRecordDialog";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "./ui/card";

type RecordProps = {
  record: SalesRecord;
};
export function Record({ record }: RecordProps) {
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const wasUpdated = record.updatedAt > record.createdAt;
  const createdUpdatedAtTimestamp = (
    wasUpdated ? record.updatedAt : record.createdAt
  ).toDateString();

  return (
    <>
      <Card
        className="cursor-pointer transition-shadow hover:shadow-lg"
        onClick={() => setShowDeleteDialog(true)}
      >
        <CardHeader>
          <CardTitle>{record.productName}</CardTitle>
          <CardDescription>
            {createdUpdatedAtTimestamp}
            {wasUpdated && " (updated)"}
          </CardDescription>
        </CardHeader>

        <CardContent>
          <p className="whitespace-pre-line">{record.amount}</p>
        </CardContent>
      </Card>
      <AddSalesRecordDialog
        open={showDeleteDialog}
        setOpen={setShowDeleteDialog}
        recordToDelete={record}
      />
    </>
  );
}
