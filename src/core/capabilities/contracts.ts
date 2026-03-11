import { z } from "zod";

import {
  capabilityRevocationReasons,
  capabilityTokenStatuses
} from "../../shared/constants";

export const CapabilityTokenStatusSchema = z.enum(capabilityTokenStatuses);
export const CapabilityRevocationReasonSchema = z.enum(
  capabilityRevocationReasons
);

export const CapabilityTokenRecordSchema = z
  .object({
    token_id: z.string().min(1),
    run_id: z.string().min(1),
    action_id: z.string().min(1),
    approval_signature: z.string().min(1),
    execution_hash: z.string().min(1),
    session_id: z.string().min(1),
    issued_at: z.string().datetime({ offset: true }),
    expires_at: z.string().datetime({ offset: true }),
    remaining_uses: z.number().int().min(0),
    status: CapabilityTokenStatusSchema,
    revocation_reason: CapabilityRevocationReasonSchema.optional()
  })
  .strict();

export type CapabilityTokenRecord = z.infer<typeof CapabilityTokenRecordSchema>;
