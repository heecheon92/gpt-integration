/**
 * This file contains the code to generate embeddings using the OpenAI API.
 * For general purpose openai operation, use one from the `ai` package.
 */

import OpenAI from "openai";

const apiKey = process.env.OPENAI_API_KEY;

if (!apiKey) {
  throw new Error("OPENAI_API_KEY is required");
}

const openai = new OpenAI({ apiKey });

export async function getEmbedding(text: string) {
  const response = await openai.embeddings.create({
    model: "text-embedding-ada-002",
    input: text,
  });

  const embedding = response.data[0].embedding;
  if (!embedding) throw new Error("Error generating embedding.");

  console.log(embedding);
  return embedding;
}
