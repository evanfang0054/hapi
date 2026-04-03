import { access, readdir, readFile } from 'fs/promises';
import { basename, dirname, join, resolve } from 'path';
import { homedir } from 'os';
import { parse as parseYaml } from 'yaml';

/**
 * Interface for installed_plugins.json structure
 */
interface PluginInstallation {
    scope: 'user' | 'project';
    projectPath?: string;
    installPath: string;
    version: string;
    installedAt: string;
    lastUpdated: string;
    gitCommitSha?: string;
}

interface InstalledPluginsFile {
    version: number;
    plugins: Record<string, PluginInstallation[]>;
}

export interface SkillSummary {
    name: string;
    description?: string;
}

export interface ListSkillsRequest {
}

export interface ListSkillsResponse {
    success: boolean;
    skills?: SkillSummary[];
    error?: string;
}

function getHomeDirectory(): string {
    return process.env.HOME ?? process.env.USERPROFILE ?? homedir();
}

function getUserSkillsRoots(): string[] {
    const home = getHomeDirectory();
    return [
        join(home, '.agents', 'skills'),
        join(home, '.claude', 'skills'),
    ];
}

function getAdminSkillsRoot(): string {
    return join('/etc', 'codex', 'skills');
}

function getProjectSkillsRoots(directory: string): string[] {
    return [
        join(directory, '.agents', 'skills'),
        join(directory, '.claude', 'skills'),
    ];
}

async function pathExists(path: string): Promise<boolean> {
    try {
        await access(path);
        return true;
    } catch {
        return false;
    }
}

async function listProjectSkillsRoots(workingDirectory?: string): Promise<string[]> {
    if (!workingDirectory) {
        return [];
    }

    const resolvedWorkingDirectory = resolve(workingDirectory);
    const directories = [resolvedWorkingDirectory];
    let currentDirectory = resolvedWorkingDirectory;

    while (true) {
        if (await pathExists(join(currentDirectory, '.git'))) {
            return directories.flatMap(getProjectSkillsRoots);
        }

        const parentDirectory = dirname(currentDirectory);
        if (parentDirectory === currentDirectory) {
            return getProjectSkillsRoots(resolvedWorkingDirectory);
        }

        currentDirectory = parentDirectory;
        directories.push(currentDirectory);
    }
}

function parseFrontmatter(fileContent: string): { frontmatter?: Record<string, unknown>; body: string } {
    const match = fileContent.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
    if (!match) {
        return { body: fileContent.trim() };
    }

    const yamlContent = match[1];
    const body = match[2].trim();
    try {
        const parsed = parseYaml(yamlContent) as Record<string, unknown> | null;
        return { frontmatter: parsed ?? undefined, body };
    } catch {
        return { body: fileContent.trim() };
    }
}

function extractSkillSummary(skillDir: string, fileContent: string): SkillSummary | null {
    const parsed = parseFrontmatter(fileContent);
    const nameFromFrontmatter = typeof parsed.frontmatter?.name === 'string' ? parsed.frontmatter.name.trim() : '';
    const name = nameFromFrontmatter || basename(skillDir);
    if (!name) {
        return null;
    }

    const description = typeof parsed.frontmatter?.description === 'string'
        ? parsed.frontmatter.description.trim()
        : undefined;

    return { name, description };
}

async function listTopLevelSkillDirs(skillsRoot: string): Promise<string[]> {
    try {
        const entries = await readdir(skillsRoot, { withFileTypes: true });
        const result: string[] = [];

        for (const entry of entries) {
            if (!entry.isDirectory() || entry.name.startsWith('.')) {
                continue;
            }

            result.push(join(skillsRoot, entry.name));
        }

        return result;
    } catch {
        return [];
    }
}

async function readSkillsFromDirs(skillDirs: string[]): Promise<SkillSummary[]> {
    const skills = await Promise.all(skillDirs.map(async (dir): Promise<SkillSummary | null> => {
        const filePath = join(dir, 'SKILL.md');
        try {
            const fileContent = await readFile(filePath, 'utf-8');
            return extractSkillSummary(dir, fileContent);
        } catch {
            return null;
        }
    }));

    return skills.filter((skill): skill is SkillSummary => skill !== null);
}

/**
 * Check if workingDirectory is under or equal to projectPath.
 */
function isWorkingDirectoryInProject(workingDirectory: string, projectPath: string): boolean {
    const resolvedWorkDir = resolve(workingDirectory);
    const resolvedProjectPath = resolve(projectPath);
    return resolvedWorkDir === resolvedProjectPath || resolvedWorkDir.startsWith(resolvedProjectPath + '/');
}

/**
 * Filter plugin installations based on scope and workingDirectory.
 * - scope: "user" → always included
 * - scope: "project" → only if workingDirectory is under projectPath
 */
function filterInstallationsByScope(
    installations: PluginInstallation[],
    workingDirectory?: string
): PluginInstallation[] {
    return installations.filter((inst) => {
        if (inst.scope === 'user') {
            return true;
        }
        if (inst.scope === 'project' && workingDirectory && inst.projectPath) {
            return isWorkingDirectoryInProject(workingDirectory, inst.projectPath);
        }
        return false;
    });
}

/**
 * Scan plugin skills from installed Claude plugins.
 * Reads ~/.claude/plugins/installed_plugins.json to find installed plugins,
 * then scans each plugin's skills directory.
 * Only loads plugins that match the scope (user or project with matching path).
 */
async function scanPluginSkills(workingDirectory?: string): Promise<SkillSummary[]> {
    const configDir = process.env.CLAUDE_CONFIG_DIR ?? join(getHomeDirectory(), '.claude');
    const installedPluginsPath = join(configDir, 'plugins', 'installed_plugins.json');

    try {
        const content = await readFile(installedPluginsPath, 'utf-8');
        const installedPlugins = JSON.parse(content) as InstalledPluginsFile;

        if (!installedPlugins.plugins) {
            return [];
        }

        const allSkills: SkillSummary[] = [];

        // Process each installed plugin
        for (const [pluginKey, installations] of Object.entries(installedPlugins.plugins)) {
            if (installations.length === 0) continue;

            // Filter by scope first
            const eligibleInstallations = filterInstallationsByScope(installations, workingDirectory);
            if (eligibleInstallations.length === 0) continue;

            // Sort eligible installations by lastUpdated descending to get the newest one
            const sortedInstallations = [...eligibleInstallations].sort((a, b) => {
                return new Date(b.lastUpdated).getTime() - new Date(a.lastUpdated).getTime();
            });

            const installation = sortedInstallations[0];
            if (!installation?.installPath) continue;

            const skillsDir = join(installation.installPath, 'skills');
            const skillDirs = await listTopLevelSkillDirs(skillsDir);
            const skills = await readSkillsFromDirs(skillDirs);
            allSkills.push(...skills);
        }

        return allSkills;
    } catch {
        // installed_plugins.json doesn't exist or is invalid
        return [];
    }
}

export async function listSkills(workingDirectory?: string): Promise<SkillSummary[]> {
    const projectRoots = await listProjectSkillsRoots(workingDirectory);
    const [projectSkillDirs, userSkillDirs, adminSkillDirs, pluginSkills] = await Promise.all([
        Promise.all(projectRoots.map(async (root) => await listTopLevelSkillDirs(root))).then((dirs) => dirs.flat()),
        Promise.all(getUserSkillsRoots().map(async (root) => await listTopLevelSkillDirs(root))).then((dirs) => dirs.flat()),
        listTopLevelSkillDirs(getAdminSkillsRoot()),
        scanPluginSkills(workingDirectory),
    ]);

    const [projectSkills, userSkills, adminSkills] = await Promise.all([
        readSkillsFromDirs(projectSkillDirs),
        readSkillsFromDirs(userSkillDirs),
        readSkillsFromDirs(adminSkillDirs),
    ]);

    const dedupedSkills = new Map<string, SkillSummary>();
    for (const skill of [
        ...projectSkills,
        ...userSkills,
        ...pluginSkills,
        ...adminSkills,
    ]) {
        if (!dedupedSkills.has(skill.name)) {
            dedupedSkills.set(skill.name, skill);
        }
    }

    return [...dedupedSkills.values()].sort((a, b) => a.name.localeCompare(b.name));
}
