/**
 * This file contains the code to generate embeddings using the OpenAI API.
 * For general purpose openai operation, use one from the `ai` package.
 */

import { openai } from "@ai-sdk/openai";
import { embed } from "ai";

const apiKey = process.env.OPENAI_API_KEY;

if (!apiKey) {
  throw new Error("OPENAI_API_KEY is required");
}

export async function getEmbedding(value: string) {
  const { embedding } = await embed({
    model: openai.embedding("text-embedding-ada-002"),
    value,
  });
  if (!embedding) throw new Error("Error generating embedding.");

  console.log(embedding);
  return embedding;
}
