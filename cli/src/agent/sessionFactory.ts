import os from 'node:os'
import { randomUUID } from 'node:crypto'
import { resolve } from 'node:path'

import { ApiClient } from '@/api/api'
import type { ApiSessionClient } from '@/api/apiSession'
import type { AgentState, MachineMetadata, Metadata, Session } from '@/api/types'
import { notifyRunnerSessionStarted, listRunnerSessions } from '@/runner/controlClient'
import { readSettings } from '@/persistence'
import { configuration } from '@/configuration'
import { logger } from '@/ui/logger'
import { runtimePath } from '@/projectPath'
import { getInvokedCwd } from '@/utils/invokedCwd'
import { readWorktreeEnv } from '@/utils/worktreeEnv'
import packageJson from '../../package.json'

export type SessionStartedBy = 'runner' | 'terminal'

export type SessionBootstrapOptions = {
    flavor: string
    startedBy?: SessionStartedBy
    workingDirectory?: string
    tag?: string
    agentState?: AgentState | null
    model?: string
    effort?: string
    metadataOverrides?: Partial<Metadata>
}

export type SessionBootstrapResult = {
    api: ApiClient
    session: ApiSessionClient
    sessionInfo: Session
    metadata: Metadata
    machineId: string
    startedBy: SessionStartedBy
    workingDirectory: string
}

export function buildMachineMetadata(): MachineMetadata {
    return {
        host: process.env.HAPI_HOSTNAME || os.hostname(),
        platform: os.platform(),
        happyCliVersion: packageJson.version,
        homeDir: os.homedir(),
        happyHomeDir: configuration.happyHomeDir,
        happyLibDir: runtimePath()
    }
}

export function buildSessionMetadata(options: {
    flavor: string
    startedBy: SessionStartedBy
    workingDirectory: string
    machineId: string
    now?: number
    metadataOverrides?: Partial<Metadata>
}): Metadata {
    const happyLibDir = runtimePath()
    const worktreeInfo = readWorktreeEnv()
    const now = options.now ?? Date.now()

    return {
        path: options.workingDirectory,
        host: os.hostname(),
        version: packageJson.version,
        os: os.platform(),
        machineId: options.machineId,
        homeDir: os.homedir(),
        happyHomeDir: configuration.happyHomeDir,
        happyLibDir,
        happyToolsDir: resolve(happyLibDir, 'tools', 'unpacked'),
        startedFromRunner: options.startedBy === 'runner',
        hostPid: process.pid,
        startedBy: options.startedBy,
        lifecycleState: 'running',
        lifecycleStateSince: now,
        flavor: options.flavor,
        worktree: worktreeInfo ?? undefined,
        ...options.metadataOverrides
    }
}

async function getMachineIdOrExit(): Promise<string> {
    const settings = await readSettings()
    const machineId = settings?.machineId
    if (!machineId) {
        console.error(`[START] No machine ID found in settings, which is unexpected since authAndSetupMachineIfNeeded should have created it. Please report this issue on ${packageJson.bugs}`)
        process.exit(1)
    }
    logger.debug(`Using machineId: ${machineId}`)
    return machineId
}

async function reportSessionStarted(sessionId: string, metadata: Metadata): Promise<void> {
    const hostPid = metadata.hostPid
    
    // Retry a few times in case runner is restarting (version mismatch detection)
    for (let attempt = 0; attempt < 15; attempt++) {
        try {
            logger.debug(`[START] Reporting session ${sessionId} to runner (attempt ${attempt + 1})`)
            const result = await notifyRunnerSessionStarted(sessionId, metadata)
            if (result?.error) {
                logger.debug(`[START] Failed to report to runner (may not be running):`, result.error)
                if (attempt < 14) {
                    await new Promise(resolve => setTimeout(resolve, 500))
                }
                continue
            }
            
            // Verify the session was actually registered by checking the list
            // Wait a bit first to let any runner restarts settle
            await new Promise(resolve => setTimeout(resolve, 300))
            
            const sessions = await listRunnerSessions()
            const registered = sessions.some((s: { pid?: number; happySessionId?: string }) => 
                s.pid === hostPid || s.happySessionId === sessionId
            )
            
            if (registered) {
                // Double-check after a short delay to ensure runner didn't restart
                await new Promise(resolve => setTimeout(resolve, 500))
                const sessionsAfter = await listRunnerSessions()
                const stillRegistered = sessionsAfter.some((s: { pid?: number; happySessionId?: string }) => 
                    s.pid === hostPid || s.happySessionId === sessionId
                )
                
                if (stillRegistered) {
                    logger.debug(`[START] Verified session ${sessionId} is stably registered in runner`)
                    return
                }
                logger.debug(`[START] Session ${sessionId} was registered but runner restarted, retrying...`)
            } else {
                logger.debug(`[START] Session ${sessionId} not found in runner list, retrying...`)
            }
            
            if (attempt < 14) {
                await new Promise(resolve => setTimeout(resolve, 500))
            }
        } catch (error) {
            logger.debug('[START] Failed to report to runner (may not be running):', error)
            if (attempt < 14) {
                await new Promise(resolve => setTimeout(resolve, 500))
            }
        }
    }
    logger.debug(`[START] Gave up reporting session ${sessionId} to runner after 15 attempts`)
}

export async function bootstrapSession(options: SessionBootstrapOptions): Promise<SessionBootstrapResult> {
    const workingDirectory = options.workingDirectory ?? getInvokedCwd()
    const startedBy = options.startedBy ?? 'terminal'
    const sessionTag = options.tag ?? randomUUID()
    const agentState = options.agentState === undefined ? {} : options.agentState

    const api = await ApiClient.create()

    const machineId = await getMachineIdOrExit()
    await api.getOrCreateMachine({
        machineId,
        metadata: buildMachineMetadata()
    })

    const metadata = buildSessionMetadata({
        flavor: options.flavor,
        startedBy,
        workingDirectory,
        machineId,
        metadataOverrides: options.metadataOverrides
    })

    const sessionInfo = await api.getOrCreateSession({
        tag: sessionTag,
        metadata,
        state: agentState,
        model: options.model,
        effort: options.effort
    })

    const session = api.sessionSyncClient(sessionInfo)

    await reportSessionStarted(sessionInfo.id, metadata)

    return {
        api,
        session,
        sessionInfo,
        metadata,
        machineId,
        startedBy,
        workingDirectory
    }
}
