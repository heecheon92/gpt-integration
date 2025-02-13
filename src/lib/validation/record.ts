import z from "zod";

export const createRecordSchema = z.object({
  productName: z
    .string()
    .min(1, { message: "Product name must be at least 1 character long" }),
  price: z.coerce.number(),
  soldAt: z.preprocess((val) => {
    if (typeof val === "string") {
      const date = new Date(val);
      if (isNaN(date.getTime())) {
        return undefined;
      }
      // date.toISOString()는 UTC 기준의 ISO 문자열을 반환합니다.
      return date.toISOString();
    }
    return val;
  }, z.string()),
});

export const deleteRecordSchema = z.object({
  id: z.string().min(1),
});

export type CreateRecordSchema = z.infer<typeof createRecordSchema>;
export type DeleteRecordSchema = z.infer<typeof deleteRecordSchema>;
