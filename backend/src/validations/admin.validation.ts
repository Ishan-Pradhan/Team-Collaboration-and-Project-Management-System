import z from "zod";

const uuid = z.uuid('Invalid UUID');


export const toggleBlockUserSchema = {
    params: z.object({
        id: uuid,
    }),
};

export const growthStatsQuerySchema = {
  query: z.object({
    days: z.coerce.number().int().min(1).max(90).optional(),
  }),
};

export const promoteUserSchema = {
  params: z.object({
    id: uuid,
  }),
};

export const organizationIdParamSchema = {
  params: z.object({
    organizationId: uuid,
  }),
};

export const toggleOrgFeatureSchema = {
  params: z.object({
    organizationId: uuid,
  }),
  body: z.object({
    flag: z.enum(['chatEnabled', 'calendarEnabled']),
    enabled: z.boolean(),
  }),
};

export const auditLogQuerySchema = {
  query: z.object({
    page: z.coerce.number().int().min(1).optional(),
    limit: z.coerce.number().int().min(1).max(100).optional(),
  }),
};
