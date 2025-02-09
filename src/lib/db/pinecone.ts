import { Pinecone } from "@pinecone-database/pinecone";

const apiKey = process.env.PINECONE_API_KEY;

if (!apiKey) {
  throw new Error("PINECONE_API_KEY is required");
}

const pinecone = new Pinecone({
  apiKey,
});

export const gptIndex = pinecone.Index(process.env.PINECONE_DB_INDEX_NAME!);
