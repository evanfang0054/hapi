export type {
    AgentState,
    AgentStateCompletedRequest,
    AgentStateRequest,
    AttachmentMetadata,
    DecryptedMessage,
    Metadata,
    Session,
    SyncEvent,
    TeamMember,
    TeamMessage,
    TeamState,
    TeamTask,
    TodoItem,
    WorktreeMetadata
} from './schemas'

export type PermissionContextAction = 'keep_context' | 'clear_context'

export type PermissionAnswers = Record<string, string[]> | Record<string, { answers: string[] }>

export type PermissionApprovalDecision = 'approved' | 'approved_for_session' | 'denied' | 'abort'

export type PermissionApprovalPayload = {
    mode?: import('./modes').PermissionMode
    decision?: PermissionApprovalDecision
    allowTools?: string[]
    answers?: PermissionAnswers
    contextAction?: PermissionContextAction
}

export type { SessionSummary, SessionSummaryMetadata } from './sessionSummary'
export { AGENT_MESSAGE_PAYLOAD_TYPE } from './modes'

export type {
    AgentFlavor,
    ClaudePermissionMode,
    CodexCollaborationMode,
    CodexCollaborationModeOption,
    CodexPermissionMode,
    CursorPermissionMode,
    GeminiPermissionMode,
    OpencodePermissionMode,
    ClaudeModelPreset,
    PermissionMode,
    PermissionModeOption,
    PermissionModeTone
} from './modes'
