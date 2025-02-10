import { gptIndex } from "@/lib/db/pinecone";
import { prisma } from "@/lib/db/prisma";
import { getEmbedding } from "@/lib/openai";
import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";

import { openai } from "@ai-sdk/openai";
import { CoreMessage, streamText } from "ai";

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

    const vectorQueryResponse = await gptIndex.query({
      vector: embedding,
      topK: 6,
      filter: { userId },
    });

    const relevantNotes = await prisma.note.findMany({
      where: {
        id: {
          in: vectorQueryResponse.matches.map((match) => match.id),
        },
      },
    });

    console.log("Relevant notes found: ", relevantNotes);

    const systemMessage: CoreMessage = {
      role: "system",
      content:
        "You are an intelligent note-taking app. Here are some relevant notes for you: " +
        "The relevant notes for this query are:\n" +
        relevantNotes
          .map((note) => `Title: ${note.title}\n\nContent: ${note.content}`)
          .join("\n\n") +
        "Oh and make sure that you respond to the user with the corresponding language of the content.",
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
