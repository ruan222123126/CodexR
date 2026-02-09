import * as vscode from 'vscode';
import type { ProviderType } from './types';
import type { SupportedLanguage } from '../i18n';

export type TitleGenerationMode = 'currentProvider' | 'fixedProvider' | 'firstMessage';

export class Config {
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

    static shouldHideCodexThinking(): boolean {
        return vscode.workspace
            .getConfiguration('codexSidebar')
            .get<boolean>('codexHideThinking', false);
    }

    static shouldAutoResumeCodexSession(): boolean {
        return vscode.workspace
            .getConfiguration('codexSidebar')
            .get<boolean>('codexAutoResumeSession', true);
    }

    static shouldAutoResumeClaudeSession(): boolean {
        return vscode.workspace
            .getConfiguration('codexSidebar')
            .get<boolean>('claudeAutoResumeSession', true);
    }

    static shouldDisableClaudeThinking(): boolean {
        return vscode.workspace
            .getConfiguration('codexSidebar')
            .get<boolean>('claudeDisableThinking', false);
    }

    static shouldAutoResumePiSession(): boolean {
        return vscode.workspace
            .getConfiguration('codexSidebar')
            .get<boolean>('piAutoResumeSession', true);
    }

    static shouldDisablePiThinking(): boolean {
        return vscode.workspace
            .getConfiguration('codexSidebar')
            .get<boolean>('piDisableThinking', false);
    }

    static getTitleGenerationMode(): TitleGenerationMode {
        const configured = vscode.workspace
            .getConfiguration('codexSidebar')
            .get<string>('titleGenerationMode', 'currentProvider');
        if (configured === 'fixedProvider') {
            return 'fixedProvider';
        }
        if (configured === 'firstMessage') {
            return 'firstMessage';
        }
        return 'currentProvider';
    }

    static getTitleFixedProvider(): ProviderType {
        const configured = vscode.workspace
            .getConfiguration('codexSidebar')
            .get<string>('titleFixedProvider', 'codex');
        return this.normalizeProvider(configured);
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

    static getLanguage(): SupportedLanguage {
        const configured = vscode.workspace
            .getConfiguration('codexSidebar')
            .get<string>('language', 'en');
        if (configured === 'zh-CN') {
            return 'zh-CN';
        }
        return 'en';
    }
}
