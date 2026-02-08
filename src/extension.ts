import * as vscode from 'vscode';
import { CodexProvider } from './CodexProvider';

export function activate(context: vscode.ExtensionContext) {
    const provider = new CodexProvider(context.extensionUri, context);

    context.subscriptions.push(
        vscode.window.registerWebviewViewProvider('codex.chatView', provider),
        vscode.commands.registerCommand('codexSidebar.restoreLatestCheckpoint', () => provider.restoreLatestCheckpoint()),
        vscode.commands.registerCommand('codexSidebar.restoreCheckpoint', () => provider.restoreCheckpointInteractive()),
    );
}
