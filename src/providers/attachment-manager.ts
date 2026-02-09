import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import type { AttachmentItem } from './types';

export class AttachmentManager {
    private static readonly MAX_ATTACHMENT_COUNT = 8;
    private static readonly MAX_ATTACHMENT_CHARS_PER_FILE = 12_000;
    private static readonly MAX_ATTACHMENT_CHARS_TOTAL = 50_000;

    normalizeAttachments(value: unknown): AttachmentItem[] {
        if (!Array.isArray(value)) {
            return [];
        }

        const byPath = new Map<string, AttachmentItem>();
        for (const item of value) {
            if (!item || typeof item !== 'object') {
                continue;
            }

            const raw = item as { path?: unknown; name?: unknown; size?: unknown };
            const filePath = typeof raw.path === 'string' ? raw.path.trim() : '';
            if (!filePath) {
                continue;
            }

            const name = typeof raw.name === 'string' && raw.name.trim()
                ? raw.name.trim()
                : path.basename(filePath);

            const size = typeof raw.size === 'number' && Number.isFinite(raw.size) && raw.size >= 0
                ? raw.size
                : undefined;

            byPath.set(filePath, { path: filePath, name, size });
            if (byPath.size >= AttachmentManager.MAX_ATTACHMENT_COUNT) {
                break;
            }
        }

        return Array.from(byPath.values());
    }

    async pickAttachments(postToWebview: (type: string, value: unknown) => void): Promise<void> {
        const workspaceUri = vscode.workspace.workspaceFolders?.[0]?.uri;
        const selected = await vscode.window.showOpenDialog({
            canSelectMany: true,
            canSelectFiles: true,
            canSelectFolders: false,
            defaultUri: workspaceUri,
            openLabel: 'Attach',
        });

        if (!selected || selected.length === 0) {
            return;
        }

        const attachments: AttachmentItem[] = [];
        for (const uri of selected) {
            try {
                const stat = await vscode.workspace.fs.stat(uri);
                attachments.push({
                    path: uri.fsPath,
                    name: path.basename(uri.fsPath),
                    size: stat.size,
                });
            } catch {
                attachments.push({
                    path: uri.fsPath,
                    name: path.basename(uri.fsPath),
                });
            }
        }

        postToWebview('attachments-update', { attachments });
    }

    buildPromptWithAttachments(prompt: string, attachments: AttachmentItem[]): string {
        if (attachments.length === 0) {
            return prompt;
        }

        let totalChars = 0;
        const chunks: string[] = [];

        for (const attachment of attachments.slice(0, AttachmentManager.MAX_ATTACHMENT_COUNT)) {
            const remain = AttachmentManager.MAX_ATTACHMENT_CHARS_TOTAL - totalChars;
            if (remain <= 0) {
                break;
            }

            const perFileBudget = Math.min(AttachmentManager.MAX_ATTACHMENT_CHARS_PER_FILE, remain);
            const contentResult = this.readAttachmentContent(attachment.path, perFileBudget);
            const languageHint = this.detectLanguageFromPath(attachment.path);
            const text = contentResult.text;
            const truncated = contentResult.truncated;

            totalChars += text.length;

            const truncatedHint = truncated ? '\n[Attachment content truncated]' : '';
            chunks.push([
                `### ${attachment.name}`,
                `Path: ${attachment.path}`,
                '',
                '```' + languageHint,
                text,
                '```',
                truncatedHint,
            ].join('\n'));
        }

        if (chunks.length === 0) {
            return prompt;
        }

        return [
            prompt,
            '',
            'Attached file context:',
            chunks.join('\n\n'),
            '',
            'Please use these attachments as additional context when answering.',
            ].join('\n');
    }

    private readAttachmentContent(filePath: string, maxChars: number): { text: string; truncated: boolean } {
        const safeMaxChars = Number.isFinite(maxChars) ? Math.floor(maxChars) : 0;
        if (safeMaxChars <= 0) {
            return { text: '', truncated: true };
        }

        let fd: number | undefined;
        try {
            fd = fs.openSync(filePath, 'r');

            const sampleBuffer = Buffer.alloc(4096);
            const sampleBytes = fs.readSync(fd, sampleBuffer, 0, sampleBuffer.length, 0);
            if (sampleBytes <= 0) {
                return { text: '[Empty file]', truncated: false };
            }

            const sample = sampleBytes === sampleBuffer.length
                ? sampleBuffer
                : sampleBuffer.subarray(0, sampleBytes);
            if (this.isProbablyBinary(sample)) {
                return { text: '[Binary file omitted]', truncated: false };
            }

            const byteLimit = Math.max(4, safeMaxChars * 4 + 4);
            const initialBytes = Math.min(sample.length, byteLimit);
            const chunks: Buffer[] = [sample.subarray(0, initialBytes)];
            let keptBytes = initialBytes;
            let position = sample.length;

            while (keptBytes < byteLimit) {
                const readSize = Math.min(8192, byteLimit - keptBytes);
                const chunk = Buffer.alloc(readSize);
                const bytesRead = fs.readSync(fd, chunk, 0, readSize, position);
                if (bytesRead <= 0) {
                    break;
                }

                chunks.push(bytesRead === readSize ? chunk : chunk.subarray(0, bytesRead));
                keptBytes += bytesRead;
                position += bytesRead;
            }

            const rawText = Buffer.concat(chunks, keptBytes).toString('utf8');
            const fileSize = fs.fstatSync(fd).size;
            const truncatedByByteLimit = fileSize > keptBytes;

            if (rawText.length > safeMaxChars) {
                return {
                    text: rawText.slice(0, safeMaxChars),
                    truncated: true,
                };
            }

            return {
                text: rawText,
                truncated: truncatedByByteLimit,
            };
        } catch {
            return { text: '[Failed to read file]', truncated: false };
        } finally {
            if (fd !== undefined) {
                try {
                    fs.closeSync(fd);
                } catch {
                }
            }
        }
    }

    private isProbablyBinary(buffer: Buffer): boolean {
        const sample = buffer.subarray(0, 4096);
        for (let i = 0; i < sample.length; i++) {
            if (sample[i] === 0) {
                return true;
            }
        }
        return false;
    }

    private detectLanguageFromPath(filePath: string): string {
        const ext = path.extname(filePath).toLowerCase();
        if (!ext) {
            return '';
        }

        const map: Record<string, string> = {
            '.ts': 'ts',
            '.tsx': 'tsx',
            '.js': 'js',
            '.jsx': 'jsx',
            '.json': 'json',
            '.md': 'markdown',
            '.py': 'python',
            '.go': 'go',
            '.java': 'java',
            '.rs': 'rust',
            '.cpp': 'cpp',
            '.c': 'c',
            '.h': 'c',
            '.css': 'css',
            '.html': 'html',
            '.yml': 'yaml',
            '.yaml': 'yaml',
            '.xml': 'xml',
            '.sh': 'bash',
            '.sql': 'sql',
        };

        return map[ext] ?? ext.slice(1);
    }
}
