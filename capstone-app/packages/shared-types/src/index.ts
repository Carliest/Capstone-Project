import { z } from "zod";

export const HikerCheckInSchema = z.object({
  permitId: z.string().uuid(),
  checkpointId: z.string(),
  timestamp: z.string(),
});

export type HikerCheckIn = z.infer<typeof HikerCheckInSchema>;