import {
  EMBEDDING_FILTER_TAG_KEY,
  EMBEDDING_SALES_FILTER_TAG,
} from "@/constants";
import { gptIndex } from "@/lib/db/pinecone";
import { prisma } from "@/lib/db/prisma";
import { tool } from "ai";
import { toZonedTime } from "date-fns-tz/toZonedTime";
import { endOfDay } from "date-fns/endOfDay";
import { startOfDay } from "date-fns/startOfDay";
import { z } from "zod";

export function salesTools({
  userId,
  embedding,
  timezone,
}: {
  userId: string;
  embedding: number[];
  timezone?: string | null;
}) {
  return {
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
                {
                  soldAt: daterange
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
  };
}
