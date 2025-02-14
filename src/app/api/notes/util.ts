import {
  EMBEDDING_FILTER_TAG_KEY,
  EMBEDDING_NOTES_FILTER_TAG,
} from "@/constants";
import { gptIndex } from "@/lib/db/pinecone";
import { prisma } from "@/lib/db/prisma";
import { getEmbedding } from "@/lib/openai";

export async function createNote({
  userId,
  title,
  content,
}: {
  userId: string;
  title: string;
  content: string | undefined;
}) {
  const embedding = await getEmbeddingForNote(title, content);

  // if any error occurs in $transaction block will rollback the transaction
  const note = await prisma.$transaction(async (tx) => {
    const note = await tx.note.create({
      data: {
        title,
        content,
        userId,
      },
    });

    await gptIndex.upsert([
      {
        id: note.id,
        values: embedding,
        metadata: {
          userId,
          [EMBEDDING_FILTER_TAG_KEY]: EMBEDDING_NOTES_FILTER_TAG,
        },
      },
    ]);

    return note;
  });

  return note;
}

export async function updateNote({
  noteId,
  title,
  content,
  userId,
}: {
  noteId: string;
  title: string;
  content: string | undefined;
  userId: string;
}) {
  const embedding = await getEmbeddingForNote(title, content);
  const updatedNote = await prisma.$transaction(async (tx) => {
    const updatedNote = await tx.note.update({
      where: { id: noteId },
      data: {
        title,
        content,
      },
    });

    await gptIndex.upsert([
      {
        id: updatedNote.id,
        values: embedding,
        metadata: {
          userId,
          [EMBEDDING_FILTER_TAG_KEY]: EMBEDDING_NOTES_FILTER_TAG,
        },
      },
    ]);

    return updatedNote;
  });

  return updatedNote;
}

export async function getEmbeddingForNote(
  title: string,
  content: string | undefined,
) {
  return getEmbedding(title + "\n\n" + (content ?? ""));
}
