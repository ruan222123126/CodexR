import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export interface ProviderStatus {
    provider: 'claude' | 'codex' | 'pi';
    type: 'mcp' | 'extension';
    status: 'success' | 'error' | 'empty';
    items: string[];
    error?: string;
}

function parseClaudeMcpOutput(output: string): string[] {
    const trimmed = output.trim();
    if (!trimmed || trimmed.includes('No MCP servers configured')) {
        return [];
    }
    return trimmed.split('\n').filter(line => line.trim());
}

function parseCodexMcpOutput(output: string): string[] {
    const trimmed = output.trim();
    if (!trimmed || trimmed.includes('No MCP servers configured')) {
        return [];
    }
    return trimmed.split('\n').filter(line => line.trim());
}

function parsePiListOutput(output: string): string[] {
    const trimmed = output.trim();
    if (!trimmed || trimmed.includes('No packages installed')) {
        return [];
    }
    return trimmed.split('\n').filter(line => line.trim());
}

export async function checkClaudeMcp(): Promise<ProviderStatus> {
    try {
        const { stdout } = await execAsync('claude mcp list', { timeout: 10000 });
        const items = parseClaudeMcpOutput(stdout);
        return {
            provider: 'claude',
            type: 'mcp',
            status: items.length > 0 ? 'success' : 'empty',
            items,
        };
    } catch (err) {
        return {
            provider: 'claude',
            type: 'mcp',
            status: 'error',
            items: [],
            error: err instanceof Error ? err.message : String(err),
        };
    }
}

export async function checkCodexMcp(): Promise<ProviderStatus> {
    try {
        const { stdout } = await execAsync('codex mcp list', { timeout: 10000 });
        const items = parseCodexMcpOutput(stdout);
        return {
            provider: 'codex',
            type: 'mcp',
            status: items.length > 0 ? 'success' : 'empty',
            items,
        };
    } catch (err) {
        return {
            provider: 'codex',
            type: 'mcp',
            status: 'error',
            items: [],
            error: err instanceof Error ? err.message : String(err),
        };
    }
}

export async function checkPiExtensions(): Promise<ProviderStatus> {
    try {
        const { stdout } = await execAsync('pi list', { timeout: 10000 });
        const items = parsePiListOutput(stdout);
        return {
            provider: 'pi',
            type: 'extension',
            status: items.length > 0 ? 'success' : 'empty',
            items,
        };
    } catch (err) {
        return {
            provider: 'pi',
            type: 'extension',
            status: 'error',
            items: [],
            error: err instanceof Error ? err.message : String(err),
        };
    }
}

export async function checkAllStatus(): Promise<ProviderStatus[]> {
    return Promise.all([
        checkClaudeMcp(),
        checkCodexMcp(),
        checkPiExtensions(),
    ]);
}
