import {
  EMBEDDING_FILTER_TAG_KEY,
  EMBEDDING_SALES_FILTER_TAG,
} from "@/constants";
import { gptIndex } from "@/lib/db/pinecone";
import { prisma } from "@/lib/db/prisma";
import { getEmbedding } from "@/lib/openai";
import {
  createRecordSchema,
  deleteRecordSchema,
  updateRecordSchema,
} from "@/lib/validation/record";

import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parseResult = createRecordSchema.safeParse(body);
    if (!parseResult.success) {
      console.error(parseResult.error);
      return NextResponse.json({ error: parseResult.error }, { status: 400 });
    }

    const { productName, price, soldAt } = parseResult.data;

    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const embedding = await getEmbeddingForRecord(productName, price, soldAt);

    // if any error occurs in $transaction block will rollback the transaction
    const record = await prisma.$transaction(async (tx) => {
      const record = await tx.salesRecord.create({
        data: {
          productName,
          amount: price,
          soldAt: new Date(soldAt),
          userId,
        },
      });

      await gptIndex.upsert([
        {
          id: record.id,
          values: embedding,
          metadata: {
            userId,
            productName,
            price,
            soldAt,
            [EMBEDDING_FILTER_TAG_KEY]: EMBEDDING_SALES_FILTER_TAG,
          },
        },
      ]);

      return record;
    });

    return NextResponse.json(record, { status: 201 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "An error occurred" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    const parseResult = updateRecordSchema.safeParse(body);
    if (!parseResult.success) {
      console.error(parseResult.error);
      return NextResponse.json({ error: "Invalid input" }, { status: 400 });
    }

    const { id, productName, price, soldAt } = parseResult.data;

    const record = await prisma.salesRecord.findUnique({ where: { id } });
    if (!record) {
      return NextResponse.json({ error: "Record not found" }, { status: 404 });
    }
    const { userId } = await auth();

    if (!userId || userId !== record.userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const embedding = await getEmbeddingForRecord(productName, price, soldAt);
    const updatedRecord = await prisma.$transaction(async (tx) => {
      const updatedRecord = await tx.salesRecord.update({
        where: { id },
        data: {
          productName,
          amount: price,
          soldAt: new Date(soldAt),
          userId,
        },
      });
      await gptIndex.upsert([
        {
          id: updatedRecord.id,
          values: embedding,
          metadata: {
            userId,
            [EMBEDDING_FILTER_TAG_KEY]: EMBEDDING_SALES_FILTER_TAG,
          },
        },
      ]);
      return updatedRecord;
    });
    return NextResponse.json(updatedRecord, { status: 200 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "An error occurred" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const body = await req.json();
    const parseResult = deleteRecordSchema.safeParse(body);
    if (!parseResult.success) {
      console.error(parseResult.error);
      return NextResponse.json({ error: "Invalid input" }, { status: 400 });
    }

    const { id } = parseResult.data;

    const record = await prisma.salesRecord.findUnique({ where: { id } });
    if (!record) {
      return NextResponse.json({ error: "Record not found" }, { status: 404 });
    }
    const { userId } = await auth();

    if (!userId || userId !== record.userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const deletedRecord = await prisma.$transaction(async (tx) => {
      const deletedRecord = await tx.salesRecord.delete({
        where: { id },
      });
      try {
        await gptIndex.deleteOne(id);
      } catch (error) {
        console.error(error);
      }
      return deletedRecord;
    });
    return NextResponse.json(deletedRecord, { status: 200 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "An error occurred" }, { status: 500 });
  }
}

async function getEmbeddingForRecord(
  productName: string,
  price: number | undefined,
  soldAt: string | undefined,
) {
  return getEmbedding(
    `product ${productName} was sold for ${price} WON on ${soldAt}`,
  );
}
