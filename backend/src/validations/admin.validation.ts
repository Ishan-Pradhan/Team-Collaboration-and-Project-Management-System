import z from "zod";

const uuid = z.uuid('Invalid UUID');


export const toggleBlockUserSchema = {
    params: z.object({
        id: uuid,
    }),
};
