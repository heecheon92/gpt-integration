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
import { CoreMessage, generateObject, streamText } from "ai";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const messages: CoreMessage[] = body.messages;
    const messagesTruncated = messages.slice(-6);
    const embedding = await getEmbedding(
      messagesTruncated.map((m) => m.content).join("\n"),
    );

    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { object: embeddingFilterTag } = await generateObject({
      model: openai("gpt-4o"),
      output: "enum",
      enum: [
        EMBEDDING_NOTES_FILTER_TAG,
        EMBEDDING_SALES_FILTER_TAG,
        EMBEDDING_GENERAL_FILTER_TAG,
      ],
      prompt:
        `Classify if the user is asking about sales or note he or she has written.\n` +
        `If you think user's query is not sales related, assume that it is likely to be note related.\n` +
        `If you think user's query is too broad, assume that it is general question.\n` +
        `User's query is as follow:\n` +
        `${messages[messages.length - 1].content}`,
    });

    console.log("query classification result: ", embeddingFilterTag);

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
