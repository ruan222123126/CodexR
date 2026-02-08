import * as vscode from 'vscode';
import { CodexProvider } from './CodexProvider';

export function activate(context: vscode.ExtensionContext) {
    const provider = new CodexProvider(context.extensionUri);

    context.subscriptions.push(
        vscode.window.registerWebviewViewProvider('codex.chatView', provider),
    );
}
