import { openai } from "@ai-sdk/openai";
import { auth } from "@clerk/nextjs/server";
import {
  convertToModelMessages,
  generateId,
  generateText,
  Output,
  stepCountIs,
  streamText,
  UIMessage,
} from "ai";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  EMBEDDING_FILTER_TAG_KEY,
  EMBEDDING_GENERAL_FILTER_TAG,
  EMBEDDING_NOTES_FILTER_TAG,
  EMBEDDING_SALES_FILTER_TAG,
} from "@/constants";
import { gptIndex } from "@/lib/db/pinecone";
import { prisma } from "@/lib/db/prisma";
import { getEmbedding } from "@/lib/openai";
import { noteTools } from "../notes/tools";
import { salesTools } from "../sales/tools";

const embeddingFilterTags = [
  EMBEDDING_NOTES_FILTER_TAG,
  EMBEDDING_SALES_FILTER_TAG,
  EMBEDDING_GENERAL_FILTER_TAG,
] as const;

const embeddingFilterSchema = z.object({
  tag: z.enum(embeddingFilterTags),
});

type EmbeddingFilterTag = (typeof embeddingFilterTags)[number];

export async function POST(req: NextRequest) {
  try {
    const timezone = req.headers.get("timezone");
    const body = await req.json();
    const messages = Array.isArray(body.messages)
      ? (body.messages as UIMessage[])
      : [];

    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const messagesTruncated = messages.slice(-6);
    const embeddingInput = getMessagesText(messagesTruncated);
    const embedding = await getEmbedding(embeddingInput);

    const embeddingFilterTag = await classifyEmbeddingFilterTag(messages);

    console.log("query classification result: ", embeddingFilterTag);

    if (embeddingFilterTag === EMBEDDING_NOTES_FILTER_TAG)
      return handleNoteRequest({ messages, userId, embedding, timezone });
    if (embeddingFilterTag === EMBEDDING_SALES_FILTER_TAG)
      return handleSalesRecordRequest({
        messages,
        userId,
        embedding,
        timezone,
      });

    const queryFilter =
      embeddingFilterTag === EMBEDDING_GENERAL_FILTER_TAG
        ? { userId }
        : { userId, [EMBEDDING_FILTER_TAG_KEY]: embeddingFilterTag };
    const vectorQueryResponse = await gptIndex.query({
      vector: embedding,
      topK: 20,
      filter: queryFilter,
    });

    const relevantNotes =
      embeddingFilterTag === EMBEDDING_GENERAL_FILTER_TAG ||
      embeddingFilterTag === EMBEDDING_NOTES_FILTER_TAG
        ? await prisma.note.findMany({
            where: {
              id: {
                in: vectorQueryResponse.matches.map((match) => match.id),
              },
            },
          })
        : [];

    const relevantRecords =
      embeddingFilterTag === EMBEDDING_GENERAL_FILTER_TAG ||
      embeddingFilterTag === EMBEDDING_SALES_FILTER_TAG
        ? await prisma.salesRecord.findMany({
            where: {
              id: {
                in: vectorQueryResponse.matches.map((match) => match.id),
              },
            },
          })
        : [];

    console.log("Relevant notes found: ", relevantNotes.length);
    console.log("Relevant records found: ", relevantRecords.length);

    const result = streamText({
      model: openai.chat("gpt-4o"),
      system:
        "You are an intelligent note-taking app. Here are some relevant notes for you: " +
        "The relevant notes for this query are:\n" +
        relevantNotes
          .map((note) => `Title: ${note.title}\n\nContent: ${note.content}`)
          .join("\n\n") +
        "By the way, some users may ask about revenues on products they sold\n" +
        "The relevant sales records for this query are:\n" +
        relevantRecords
          .map(
            (record) =>
              `Product Name: ${record.productName}\n\nPrice: ${record.amount}\n\nSold At: ${record.soldAt}`,
          )
          .join("\n\n") +
        "Make sure that you respond to the user with the corresponding language of the content.",
      messages: await convertToModelMessages(messagesTruncated),
    });

    return result.toUIMessageStreamResponse({
      originalMessages: messages,
      generateMessageId: generateId,
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "An error occurred" }, { status: 500 });
  }
}

async function classifyEmbeddingFilterTag(
  messages: UIMessage[],
): Promise<EmbeddingFilterTag> {
  try {
    const { output } = await generateText({
      model: openai.chat("gpt-4o"),
      output: Output.object({
        schema: embeddingFilterSchema,
      }),
      prompt:
        `Classify the user's query.\n` +
        `Return one of: ${embeddingFilterTags.join(", ")}.\n` +
        `User's query is as follows:\n` +
        `${getLatestUserText(messages)}`,
    });

    return output.tag;
  } catch (error) {
    console.error("Failed to classify query. Falling back to general.", error);
    return EMBEDDING_GENERAL_FILTER_TAG;
  }
}

async function handleNoteRequest({
  messages,
  userId,
  embedding,
  timezone,
}: {
  messages: UIMessage[];
  userId: string;
  embedding: number[];
  timezone?: string | null;
}) {
  console.log("handleNoteRequest called");
  const tools = noteTools({ userId, embedding, timezone });
  const result = streamText({
    model: openai.chat("gpt-4o"),
    system:
      "This is a system message to ask you to create a response message for the user's query.\n" +
      "Upon user's request to create a note, if user's initial query include both title and content,\n" +
      "create a note based on user's request.\n" +
      "Do not create the note if the user's query does not include any title or content.\n" +
      "If the user's query does not include any title or content, provide a UI to receive note data.\n" +
      "If both title and content are available via prompt, ask for the confirmation.\n" +
      "If user's request is not related to creating a note, respond to the user accordingly on your discretion.\n" +
      "Make sure that you respond to the user with the corresponding language of the content.\n",
    messages: await convertToModelMessages(messages, { tools }),
    tools,
    stopWhen: stepCountIs(5),
  });

  return result.toUIMessageStreamResponse({
    originalMessages: messages,
    generateMessageId: generateId,
  });
}

async function handleSalesRecordRequest({
  messages,
  userId,
  embedding,
  timezone,
}: {
  messages: UIMessage[];
  userId: string;
  embedding: number[];
  timezone?: string | null;
}) {
  const tools = salesTools({ userId, embedding, timezone });
  const result = streamText({
    model: openai.chat("gpt-4o"),
    system:
      "This is a system message to ask you to create a response message for the user's query.\n" +
      "You can lookup user's sales record but not allowed to create, edit or delete a record\n" +
      `Please respond to the user accordingly.\n` +
      `Make sure that you respond to the user with the corresponding language of the content.\n`,
    messages: await convertToModelMessages(messages, { tools }),
    tools,
    stopWhen: stepCountIs(5),
  });

  return result.toUIMessageStreamResponse({
    originalMessages: messages,
    generateMessageId: generateId,
  });
}

function getLatestUserText(messages: UIMessage[]) {
  return getMessageText(
    messages.findLast((message) => message.role === "user"),
  );
}

function getMessagesText(messages: UIMessage[]) {
  return messages.map(getMessageText).filter(Boolean).join("\n");
}

function getMessageText(message: UIMessage | undefined) {
  return (
    message?.parts
      .filter((part) => part.type === "text")
      .map((part) => part.text)
      .join("\n") ?? ""
  );
}
