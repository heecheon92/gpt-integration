import { gptIndex } from "@/lib/db/pinecone";
import { prisma } from "@/lib/db/prisma";
import { getEmbedding } from "@/lib/openai";
import { auth } from "@clerk/nextjs/server";
import { endOfDay, startOfDay } from "date-fns";
import { toZonedTime } from "date-fns-tz";
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
import { z } from "zod";
import { createNote } from "../notes/util";

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
      return handleCreateNoteRequest({ messages, userId, embedding, timezone });
    if (embeddingFilterTag === EMBEDDING_SALES_FILTER_TAG)
      return handleCreateSalesRecordRequest({ messages, userId });

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

function handleCreateNoteRequest({
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
  console.log("handleCreateNoteRequest called");
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
    tools: {
      getNotes: tool({
        description: "Get the notes for the user",
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
            "getNotes tool called with daterange: ",
            JSON.stringify(daterange, null, 2),
          );

          try {
            const queryFilter = {
              userId,
              [EMBEDDING_FILTER_TAG_KEY]: EMBEDDING_NOTES_FILTER_TAG,
            };
            const vectorQueryResponse = await gptIndex.query({
              vector: embedding,
              topK: 20,
              filter: queryFilter,
            });
            const relevantNotes = await prisma.note.findMany({
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

            return relevantNotes
              .map((note) => `Title: ${note.title}\n\nContent: ${note.content}`)
              .join("\n\n");
          } catch (error) {
            console.error(error);
            return "An error occurred while fetching the notes. Please try again.";
          }
        },
      }),
      makeNote: tool({
        description: "Create a note based on user's request",
        parameters: z.object({
          title: z.string(),
          content: z.string(),
        }),
        execute: async ({ title, content }) => {
          console.log("makeNote tool called");
          try {
            const note = await createNote({ userId, title, content });
            return `Note created successfully with title: ${note.title} and content: ${note.content}`;
          } catch (error) {
            console.error(error);
            return "An error occurred while creating the note. Please try again.";
          }
        },
      }),
      askForConfirmation: {
        description: "Ask the user for confirmation to create the note.",
        parameters: z.object({
          message: z
            .string()
            .describe(
              "The message to ask for confirmation with summary of the note including the title and content.",
            ),
        }),
      },
      promptForNoteData: {
        description: "Prompt the user to provide the note data.",
        parameters: z.object({
          message: z
            .string()
            .describe(
              "The message to prompt the user to provide the note data.\n" +
                "If title is missing, ask for the title.\n" +
                "If content is missing, ask for the content.\n" +
                "If both are missing, ask for both.",
            ),
          title: z.string().optional(),
          content: z.string().optional(),
          titleLabel: z.string().optional(),
          contentLabel: z.string().optional(),
          createButtonLabel: z.string().optional(),
        }),
      },
      getUserDatetime: {
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
      },
    },
    maxSteps: 5,
  });

  return result.toDataStreamResponse();
}

function handleCreateSalesRecordRequest({
  messages,
  userId: _,
}: {
  messages: Message[];
  userId: string;
}) {
  const result = streamText({
    model: openai("gpt-4o"),
    prompt:
      `This is a system message to ask you to create a response message for the user's query.\n` +
      `This is likely that the user wants to create a sales record.\n ` +
      `However, creating a sales record via AI is not supported yet.\n` +
      `Please respond to the user accordingly.\n` +
      `Make sure that you respond to the user with the corresponding language of the content.\n` +
      `User's query is as follow:\n` +
      `${messages[messages.length - 1].content}\n`,
  });

  return result.toDataStreamResponse();
}
