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

    static getStepDetailLevel(): 'compact' | 'full' {
        const configured = vscode.workspace
            .getConfiguration('codexSidebar')
            .get<string>('stepDetailLevel', 'compact');
        return configured === 'full' ? 'full' : 'compact';
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

    static getClaudeModel(): string {
        return vscode.workspace
            .getConfiguration('codexSidebar')
            .get<string>('claudeModel', '');
    }

    static getClaudeAgent(): string {
        return vscode.workspace
            .getConfiguration('codexSidebar')
            .get<string>('claudeAgent', '');
    }

    static getClaudeTools(): string {
        return vscode.workspace
            .getConfiguration('codexSidebar')
            .get<string>('claudeTools', '');
    }

    static getClaudePermissionMode(): 'dangerouslySkip' | 'allowDangerouslySkip' | 'default' {
        const configured = vscode.workspace
            .getConfiguration('codexSidebar')
            .get<string>('claudePermissionMode', 'dangerouslySkip');
        if (configured === 'allowDangerouslySkip') {
            return 'allowDangerouslySkip';
        }
        if (configured === 'default') {
            return 'default';
        }
        return 'dangerouslySkip';
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

    static getPiModel(): string {
        return vscode.workspace
            .getConfiguration('codexSidebar')
            .get<string>('piModel', '');
    }

    static getPiApiKey(): string {
        return vscode.workspace
            .getConfiguration('codexSidebar')
            .get<string>('piApiKey', '');
    }

    static getPiThinkingLevel(): string {
        return vscode.workspace
            .getConfiguration('codexSidebar')
            .get<string>('piThinkingLevel', 'default');
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

    static getCodexConfigOverrides(): string {
        return vscode.workspace
            .getConfiguration('codexSidebar')
            .get<string>('codexConfigOverrides', '');
    }

    static getCodexModel(): string {
        return vscode.workspace
            .getConfiguration('codexSidebar')
            .get<string>('codexModel', '');
    }

    static shouldUseCodexOss(): boolean {
        return vscode.workspace
            .getConfiguration('codexSidebar')
            .get<boolean>('codexOss', false);
    }

    static getCodexProfile(): string {
        return vscode.workspace
            .getConfiguration('codexSidebar')
            .get<string>('codexProfile', '');
    }

    static getCodexSandboxMode(): 'default' | 'read-only' | 'workspace-write' | 'danger-full-access' {
        const configured = vscode.workspace
            .getConfiguration('codexSidebar')
            .get<string>('codexSandboxMode', 'default');
        if (configured === 'read-only') {
            return 'read-only';
        }
        if (configured === 'workspace-write') {
            return 'workspace-write';
        }
        if (configured === 'danger-full-access') {
            return 'danger-full-access';
        }
        return 'default';
    }

    static getCodexApprovalPolicy(): 'default' | 'untrusted' | 'on-failure' | 'never' {
        const configured = vscode.workspace
            .getConfiguration('codexSidebar')
            .get<string>('codexApprovalPolicy', 'default');
        if (configured === 'untrusted') {
            return 'untrusted';
        }
        if (configured === 'on-failure') {
            return 'on-failure';
        }
        if (configured === 'never') {
            return 'never';
        }
        return 'default';
    }

    static shouldUseCodexFullAuto(): boolean {
        return vscode.workspace
            .getConfiguration('codexSidebar')
            .get<boolean>('codexFullAuto', false);
    }
}
