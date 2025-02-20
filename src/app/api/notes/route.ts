import { gptIndex } from "@/lib/db/pinecone";
import { prisma } from "@/lib/db/prisma";
import {
  createNoteSchema,
  deleteNoteSchema,
  updateNoteSchema,
} from "@/lib/validation/note";
import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { createNote, updateNote } from "./util";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parseResult = createNoteSchema.safeParse(body);
    if (!parseResult.success) {
      console.error(parseResult.error);
      return NextResponse.json({ error: parseResult.error }, { status: 400 });
    }

    const { title, content } = parseResult.data;

    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const note = await createNote({ userId, title, content });

    return NextResponse.json(note, { status: 201 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "An error occurred" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    const parseResult = updateNoteSchema.safeParse(body);
    if (!parseResult.success) {
      console.error(parseResult.error);
      return NextResponse.json({ error: "Invalid input" }, { status: 400 });
    }

    const { id, title, content } = parseResult.data;

    const note = await prisma.note.findUnique({ where: { id } });
    if (!note) {
      return NextResponse.json({ error: "Note not found" }, { status: 404 });
    }
    const { userId } = await auth();

    if (!userId || userId !== note.userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const updatedNote = await updateNote({
      noteId: id,
      title,
      content,
      userId,
    });
    return NextResponse.json(updatedNote, { status: 200 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "An error occurred" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const body = await req.json();
    const parseResult = deleteNoteSchema.safeParse(body);
    if (!parseResult.success) {
      console.error(parseResult.error);
      return NextResponse.json({ error: "Invalid input" }, { status: 400 });
    }

    const { id } = parseResult.data;

    const note = await prisma.note.findUnique({ where: { id } });
    if (!note) {
      return NextResponse.json({ error: "Note not found" }, { status: 404 });
    }
    const { userId } = await auth();

    if (!userId || userId !== note.userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const deletedNote = await prisma.$transaction(async (tx) => {
      const deletedNote = await tx.note.delete({
        where: { id },
      });
      try {
        await gptIndex.deleteOne(id);
      } catch (error) {
        console.error(error);
      }
      return deletedNote;
    });
    return NextResponse.json(deletedNote, { status: 200 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "An error occurred" }, { status: 500 });
  }
}
