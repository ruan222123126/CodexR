import * as vscode from 'vscode';
import { CodexProvider } from './CodexProvider'; // 下一步我们写这个

export function activate(context: vscode.ExtensionContext) {
    // 实例化 Provider
    const provider = new CodexProvider(context.extensionUri);

    // 注册 Provider 到我们在 package.json 里定义的 view id
    context.subscriptions.push(
        vscode.window.registerWebviewViewProvider("codex.chatView", provider)
    );
}