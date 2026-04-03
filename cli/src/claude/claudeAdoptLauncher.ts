import { Session } from './session';
import { createSessionScanner } from './utils/sessionScanner';
import { isClaudeChatVisibleMessage } from './utils/chatVisibility';
import { BaseLocalLauncher } from '@/modules/common/launcher/BaseLocalLauncher';

export async function claudeAdoptLauncher(session: Session): Promise<'switch' | 'exit'> {
    if (!session.sessionId) {
        session.client.sendSessionEvent({
            type: 'message',
            message: 'Adopt mode requires a valid Claude session id'
        });
        return 'exit';
    }

    session.client.sendSessionEvent({
        type: 'message',
        message: `Observing Claude session ${session.sessionId}. Send a new message to take over in remote mode.`
    });

    const scanner = await createSessionScanner({
        sessionId: session.sessionId,
        workingDirectory: session.path,
        includeInitialMessages: session.adoptReplayHistory,
        onMessage: (message) => {
            if (message.type === 'summary') {
                return;
            }
            if (message.isMeta || message.isCompactSummary) {
                return;
            }
            if (!isClaudeChatVisibleMessage(message)) {
                return;
            }
            session.client.sendClaudeSessionMessage(message);
        }
    });

    const launcher = new BaseLocalLauncher({
        label: 'adopt',
        failureLabel: 'Adopt observer failed',
        queue: session.queue,
        rpcHandlerManager: session.client.rpcHandlerManager,
        startedBy: session.startedBy,
        startingMode: session.startingMode,
        launch: async (abortSignal) => {
            await new Promise<void>((resolve) => {
                if (abortSignal.aborted) {
                    resolve();
                    return;
                }
                abortSignal.addEventListener('abort', () => resolve(), { once: true });
            });
        },
        sendFailureMessage: (message) => {
            session.client.sendSessionEvent({ type: 'message', message });
        },
        recordLocalLaunchFailure: (message, exitReason) => {
            session.recordLocalLaunchFailure(message, exitReason);
        },
        abortLogMessage: 'doAbort',
        switchLogMessage: 'doTakeOver'
    });

    const takeOver = async () => {
        launcher.control.requestSwitch();
    };

    session.client.rpcHandlerManager.registerHandler('take-over', takeOver);
    session.client.rpcHandlerManager.registerHandler('takeover', takeOver);

    try {
        return await launcher.run();
    } finally {
        session.client.rpcHandlerManager.registerHandler('take-over', async () => {});
        session.client.rpcHandlerManager.registerHandler('takeover', async () => {});
        await scanner.cleanup();
    }
}
