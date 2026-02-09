import * as vscode from 'vscode';
import type { ProviderType } from './types';

export class Config {
    static getDefaultProvider(): ProviderType {
        const configured = vscode.workspace.getConfiguration('codexSidebar').get<string>('defaultProvider', 'codex');
        if (configured === 'claude') {
            return 'claude';
        }
        if (configured === 'pi') {
            return 'pi';
        }
        return 'codex';
    }

    static getParserMode(): 'v2' | 'legacy' {
        const configured = vscode.workspace.getConfiguration('codexSidebar').get<string>('parserMode', 'v2');
        return configured === 'legacy' ? 'legacy' : 'v2';
    }

    static shouldShowToolUsageIndicator(): boolean {
        return vscode.workspace
            .getConfiguration('codexSidebar')
            .get<boolean>('showToolUsageIndicator', true);
    }

    static shouldEnableCodexThinkingNoiseFilter(): boolean {
        return vscode.workspace
            .getConfiguration('codexSidebar')
            .get<boolean>('codexThinkingNoiseFilterEnabled', true);
    }

    static shouldAutoResumeCodexSession(): boolean {
        return vscode.workspace
            .getConfiguration('codexSidebar')
            .get<boolean>('codexAutoResumeSession', true);
    }

    static normalizeProvider(value: unknown): ProviderType {
        if (value === 'claude') {
            return 'claude';
        }
        if (value === 'pi') {
            return 'pi';
        }
        return 'codex';
    }
}
