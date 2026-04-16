import { z } from 'zod'

export const WorkerFlavorSchema = z.enum(['claude', 'codex', 'cursor', 'gemini', 'opencode'])
const UnknownPayloadSchema = z.record(z.string(), z.unknown())

export const WorkerCommandSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('start-session'),
    sessionId: z.string(),
    flavor: WorkerFlavorSchema,
    payload: UnknownPayloadSchema,
  }),
  z.object({
    type: z.literal('resume-session'),
    sessionId: z.string(),
    flavor: WorkerFlavorSchema,
    payload: UnknownPayloadSchema,
  }),
  z.object({
    type: z.literal('send-message'),
    sessionId: z.string(),
    payload: UnknownPayloadSchema,
  }),
  z.object({
    type: z.literal('abort'),
    sessionId: z.string(),
  }),
  z.object({
    type: z.literal('terminate'),
    sessionId: z.string(),
  }),
  z.object({
    type: z.literal('update-config'),
    sessionId: z.string(),
    payload: UnknownPayloadSchema,
  }),
])

export const WorkerEventSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('started'), sessionId: z.string() }),
  z.object({ type: z.literal('active'), sessionId: z.string() }),
  z.object({ type: z.literal('thinking'), sessionId: z.string() }),
  z.object({ type: z.literal('message-emitted'), sessionId: z.string(), payload: UnknownPayloadSchema }),
  z.object({ type: z.literal('tool-call-requested'), sessionId: z.string(), payload: UnknownPayloadSchema }),
  z.object({ type: z.literal('completed'), sessionId: z.string() }),
  z.object({
    type: z.literal('failed'),
    sessionId: z.string(),
    scope: z.enum(['worker', 'host', 'adapter']),
    recoverable: z.boolean(),
    error: z.string(),
  }),
  z.object({ type: z.literal('terminated'), sessionId: z.string() }),
  z.object({ type: z.literal('heartbeat'), sessionId: z.string(), rssBytes: z.number().int().nonnegative() }),
  z.object({ type: z.literal('idle-timeout-reached'), sessionId: z.string() }),
  z.object({ type: z.literal('reclaim-completed'), sessionId: z.string() }),
])

export type WorkerFlavor = z.infer<typeof WorkerFlavorSchema>
export type WorkerCommand = z.infer<typeof WorkerCommandSchema>
export type WorkerEvent = z.infer<typeof WorkerEventSchema>
