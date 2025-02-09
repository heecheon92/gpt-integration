import z from "zod";

export const createNoteSchema = z.object({
  title: z
    .string()
    .min(1, { message: "Title must be at least 1 character long" }),
  content: z.string().optional(),
});

export const updateNoteSchema = createNoteSchema.extend({
  id: z.string().min(1),
});
export const deleteNoteSchema = z.object({
  id: z.string().min(1),
});

export type CreateNoteSchema = z.infer<typeof createNoteSchema>;
export type UpdateNoteSchema = z.infer<typeof updateNoteSchema>;
export type DeleteNoteSchema = z.infer<typeof deleteNoteSchema>;
