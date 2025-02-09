import { PrismaClient } from "@prisma/client";

const prismaClientSingleton = () => {
  return new PrismaClient();
};

type PrismaClientSingleton = ReturnType<typeof prismaClientSingleton>;

const globalFormPrisma = globalThis as unknown as {
  prisma: PrismaClientSingleton | undefined;
};

export const prisma = globalFormPrisma.prisma ?? prismaClientSingleton();

if (process.env.NODE_ENV !== "production") globalFormPrisma.prisma = prisma;
