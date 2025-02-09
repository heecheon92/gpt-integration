import { Note } from "@/components/Note";
import { prisma } from "@/lib/db/prisma";
import { auth } from "@clerk/nextjs/server";

export default async function NotePages() {
  const { userId } = await auth();

  if (!userId) throw Error("userId undefined");

  const allNotes = await prisma.note.findMany({ where: { userId } });

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {allNotes.map((n) => (
        <Note note={n} key={n.id} />
      ))}
      {allNotes.length === 0 && (
        <div>No notes found. Create a new note to get started!</div>
      )}
    </div>
  );
}
