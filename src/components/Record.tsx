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
          <CardDescription className="flex flex-col space-y-2">
            <span>{`written at: ${createdUpdatedAtTimestamp}`}</span>
            <span className="font-extrabold text-blue-600">
              {`sold at: ${new Date(record.soldAt).toLocaleDateString()}`}
            </span>
          </CardDescription>
        </CardHeader>

        <CardContent>
          <p className="whitespace-pre-line">{record.amount}</p>
        </CardContent>
      </Card>
      <AddSalesRecordDialog
        open={showDeleteDialog}
        setOpen={setShowDeleteDialog}
        recordToEdit={record}
      />
    </>
  );
}
