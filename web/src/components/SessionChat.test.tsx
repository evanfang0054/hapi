import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { SessionChat } from './SessionChat'

vi.mock('@tanstack/react-router', () => ({
    useNavigate: () => vi.fn(),
}))

vi.mock('@assistant-ui/react', () => ({
    AssistantRuntimeProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

vi.mock('@/chat/normalize', () => ({
    normalizeDecryptedMessage: (message: any) => message,
}))

vi.mock('@/chat/reducer', () => ({
    reduceChatBlocks: () => ({
        blocks: [],
        latestUsage: null,
    }),
}))

vi.mock('@/chat/reconcile', () => ({
    reconcileChatBlocks: () => ({
        blocks: [],
        byId: new Map(),
    }),
}))

vi.mock('@/components/AssistantChat/HappyComposer', () => ({
    HappyComposer: () => <div data-testid="happy-composer" />,
}))

vi.mock('@/components/AssistantChat/HappyThread', () => ({
    HappyThread: () => <div data-testid="happy-thread" />,
}))

vi.mock('@/components/SessionHeader', () => ({
    SessionHeader: () => <div data-testid="session-header" />,
}))

vi.mock('@/components/TeamPanel', () => ({
    TeamPanel: () => <div data-testid="team-panel" />,
}))

vi.mock('@/lib/assistant-runtime', () => ({
    useHappyRuntime: () => ({}),
}))

vi.mock('@/lib/attachmentAdapter', () => ({
    createAttachmentAdapter: () => ({}),
}))

vi.mock('@/lib/codexSlashCommands', () => ({
    findUnsupportedCodexBuiltinSlashCommand: () => null,
}))

vi.mock('@/lib/toast-context', () => ({
    useToast: () => ({
        addToast: vi.fn(),
    }),
}))

vi.mock('@/lib/use-translation', () => ({
    useTranslation: () => ({
        t: (key: string) => key,
    }),
}))

vi.mock('@/hooks/usePlatform', () => ({
    usePlatform: () => ({
        haptic: {
            impact: vi.fn(),
            notification: vi.fn(),
        },
        isTouch: false,
    }),
}))

vi.mock('@/hooks/mutations/useSessionActions', () => ({
    useSessionActions: () => ({
        abortSession: vi.fn(async () => {}),
        switchSession: vi.fn(async () => {}),
        setPermissionMode: vi.fn(async () => {}),
        setCollaborationMode: vi.fn(async () => {}),
        setModel: vi.fn(async () => {}),
        setEffort: vi.fn(async () => {}),
    }),
}))

vi.mock('@/lib/voice-context', () => ({
    useVoiceOptional: () => null,
}))

vi.mock('@/realtime', () => ({
    RealtimeVoiceSession: () => null,
    registerSessionStore: vi.fn(),
    registerVoiceHooksStore: vi.fn(),
    voiceHooks: {
        onMessages: vi.fn(),
        onReady: vi.fn(),
        onPermissionRequested: vi.fn(),
    },
}))

vi.mock('@/utils/terminalSupport', () => ({
    isRemoteTerminalSupported: () => false,
}))

afterEach(() => {
    cleanup()
})

function createSession(overrides: Record<string, unknown> = {}) {
    return {
        id: 'session-1',
        active: true,
        permissionMode: 'default',
        collaborationMode: null,
        model: 'sonnet',
        effort: null,
        thinking: false,
        metadata: {
            flavor: 'claude',
        },
        agentState: {
            requests: {},
            controlledByUser: false,
        },
        teamState: null,
        ...overrides,
    } as any
}

function renderSessionChat(overrides: Record<string, unknown> = {}) {
    const onRefresh = vi.fn()

    render(
        <SessionChat
            api={{} as any}
            session={createSession()}
            messages={[]}
            messagesWarning={null}
            hasMoreMessages={false}
            isLoadingMessages={false}
            isLoadingMoreMessages={false}
            isSending={false}
            pendingCount={0}
            messagesVersion={0}
            continuityState="connected"
            hasHydratedMessages={false}
            onBack={vi.fn()}
            onRefresh={onRefresh}
            onLoadMore={vi.fn(async () => {})}
            onSend={vi.fn()}
            onFlushPending={vi.fn()}
            onAtBottomChange={vi.fn()}
            onRetryMessage={vi.fn()}
            autocompleteSuggestions={vi.fn(async () => [])}
            availableSlashCommands={[]}
            {...overrides}
        />
    )

    return { onRefresh }
}

describe('SessionChat continuity recovery UI', () => {
    it('shows cached-content retry banner after refresh failure', () => {
        const { onRefresh } = renderSessionChat({
            continuityState: 'refresh_failed',
            hasHydratedMessages: true,
            messages: [{ id: 'msg-1' }],
        })

        expect(screen.getByText('网络恢复失败，当前显示的是缓存内容。')).toBeInTheDocument()

        fireEvent.click(screen.getByRole('button', { name: '重试' }))
        expect(onRefresh).toHaveBeenCalledTimes(1)
    })

    it('shows empty recovery card when refresh fails before any messages load', () => {
        const { onRefresh } = renderSessionChat({
            continuityState: 'refresh_failed',
            hasHydratedMessages: false,
            messages: [],
            isLoadingMessages: false,
        })

        expect(screen.getByText('当前无法刷新会话内容')).toBeInTheDocument()
        expect(screen.getByText('请检查网络后重试。')).toBeInTheDocument()

        fireEvent.click(screen.getByRole('button', { name: '重试' }))
        expect(onRefresh).toHaveBeenCalledTimes(1)
    })
})
