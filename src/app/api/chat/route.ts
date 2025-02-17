import { gptIndex } from "@/lib/db/pinecone";
import { prisma } from "@/lib/db/prisma";
import { getEmbedding } from "@/lib/openai";
import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";

import {
  EMBEDDING_FILTER_TAG_KEY,
  EMBEDDING_GENERAL_FILTER_TAG,
  EMBEDDING_NOTES_FILTER_TAG,
  EMBEDDING_SALES_FILTER_TAG,
} from "@/constants";
import { openai } from "@ai-sdk/openai";
import {
  convertToCoreMessages,
  CoreMessage,
  generateObject,
  Message,
  streamText,
  tool,
} from "ai";
import { endOfDay, startOfDay } from "date-fns";
import { toZonedTime } from "date-fns-tz";
import { z } from "zod";
import { noteTools } from "../notes/tools";

export async function POST(req: NextRequest) {
  try {
    const timezone = req.headers.get("timezone");
    const body = await req.json();
    const messages: Message[] = body.messages;
    const messagesTruncated = messages.slice(-6);
    const embedding = await getEmbedding(
      messagesTruncated.map((m) => m.content).join("\n"),
    );

    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    console.log("Chat route handler called", JSON.stringify(messages, null, 2));

    const { object: embeddingFilterTag } = await generateObject({
      model: openai("gpt-4o"),
      output: "enum",
      enum: [
        EMBEDDING_NOTES_FILTER_TAG,
        EMBEDDING_SALES_FILTER_TAG,
        EMBEDDING_GENERAL_FILTER_TAG,
      ],
      prompt:
        `Classify the user's query.\n` +
        `User's query is as follow:\n` +
        `${messages.findLast((m) => m.role === "user")?.content}`,
    });

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

    console.log("Relevant notes found: ", relevantNotes);
    console.log("Relevant records found: ", relevantRecords);

    const systemMessage: CoreMessage = {
      role: "system",
      content:
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
    };

    // below is deprecated due to the new streamText function
    // const response = await openai.chat.completions.create({
    //   // model: "o3-mini",
    //   model: "gpt-3.5-turbo",
    //   stream: true,
    //   messages: [systemMessage, ...messagesTruncated],
    // });

    // using the new streamText function from ai package
    // refer to https://sdk.vercel.ai/docs/getting-started/nextjs-app-router#configure-openai-api-key
    const result = streamText({
      model: openai("gpt-4o"),
      messages: [systemMessage, ...messagesTruncated],
    });

    return result.toDataStreamResponse();
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "An error occurred" }, { status: 500 });
  }
}

function handleNoteRequest({
  messages,
  userId,
  embedding,
  timezone,
}: {
  messages: Message[];
  userId: string;
  embedding: number[];
  timezone?: string | null;
}) {
  console.log("handleNoteRequest called");
  const systemMessage: CoreMessage = {
    role: "system",
    content:
      "This is a system message to ask you to create a response message for the user's query.\n" +
      "Upon user's request to create a note, if user's initial query include both title and content,\n" +
      "create a note based on user's request.\n" +
      "Do not create the note if the user's query does not include any title or content.\n" +
      "Let the user know if the user's query does not include any title or content and prompt for note data.\n" +
      "If both title and content are available via prompt, ask for the confirmation.\n" +
      "If user's request is not related to creating a note, respond to the user accordingly on your discretion.\n" +
      "Make sure that you respond to the user with the corresponding language of the content.\n",
  };

  const result = streamText({
    model: openai("gpt-4o"),
    messages: [systemMessage, ...convertToCoreMessages(messages)],
    tools: noteTools({ userId, embedding, timezone }),
    maxSteps: 5,
  });

  return result.toDataStreamResponse();
}

function handleSalesRecordRequest({
  messages,
  userId,
  embedding,
  timezone,
}: {
  messages: Message[];
  userId: string;
  embedding: number[];
  timezone?: string | null;
}) {
  const systemMessage: CoreMessage = {
    role: "system",
    content:
      "This is a system message to ask you to create a response message for the user's query.\n" +
      "You can lookup user's sales record but not allowed to create, edit or delete a record\n" +
      `Please respond to the user accordingly.\n` +
      `Make sure that you respond to the user with the corresponding language of the content.\n`,
  };

  const result = streamText({
    model: openai("gpt-4o"),
    messages: [systemMessage, ...convertToCoreMessages(messages)],
    tools: {
      getSalesRecord: tool({
        description: "Get the sales record from the user's query",
        parameters: z.object({
          daterange: z
            .object({
              from: z.string().datetime(),
              to: z.string().datetime(),
            })
            .optional(),
        }),
        execute: async ({ daterange }) => {
          console.log(
            "getSalesRecord tool called with daterange: ",
            JSON.stringify(daterange, null, 2),
          );

          try {
            const queryFilter = {
              userId,
              [EMBEDDING_FILTER_TAG_KEY]: EMBEDDING_SALES_FILTER_TAG,
            };
            const vectorQueryResponse = await gptIndex.query({
              vector: embedding,
              topK: 20,
              filter: queryFilter,
            });
            const relevantRecords = await prisma.salesRecord.findMany({
              where: {
                id: {
                  in: vectorQueryResponse.matches.map((match) => match.id),
                },
                OR: [
                  {
                    createdAt: daterange
                      ? {
                          gte: daterange.from,
                          lte: daterange.to,
                        }
                      : undefined,
                  },
                  {
                    updatedAt: daterange
                      ? {
                          gte: daterange.from,
                          lte: daterange.to,
                        }
                      : undefined,
                  },
                ],
              },
            });

            return relevantRecords
              .map(
                (record) =>
                  `Product Name: ${record.productName}\n\nPrice: ${record.amount}\n\nSold At: ${record.soldAt}`,
              )
              .join("\n\n");
          } catch (error) {
            console.error(error);
            return "An error occurred while fetching the notes. Please try again.";
          }
        },
      }),

      getUserDatetime: tool({
        description: "Get the current datetime",
        parameters: z.object({}),
        execute: async () => {
          const now = new Date();
          if (!timezone) {
            return {
              from: startOfDay(now).toISOString(),
              to: endOfDay(now).toISOString(),
            };
          }

          return {
            from: startOfDay(toZonedTime(now, timezone)).toISOString(),
            to: endOfDay(toZonedTime(now, timezone)).toISOString(),
          };
        },
      }),
    },
    maxSteps: 5,
  });

  return result.toDataStreamResponse();
}
