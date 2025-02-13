import { Record } from "@/components/Record";
import { prisma } from "@/lib/db/prisma";
import { auth } from "@clerk/nextjs/server";

export default async function NotePages() {
  const { userId } = await auth();

  if (!userId) throw Error("userId undefined");

  const allRecords = await prisma.salesRecord.findMany({ where: { userId } });

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {allRecords.map((n) => (
        <Record record={n} key={n.id} />
      ))}
      {allRecords.length === 0 && (
        <div>No records found. Create a new record to get started!</div>
      )}
    </div>
  );
}
