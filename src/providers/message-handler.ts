import type {
    ChatSession,
    ChatMessage,
    AttachmentItem,
} from './types';
import type { StreamSegment } from '../streamTypes';

export class MessageHandler {
    constructor(
        private readonly createId: () => string,
    ) {}

    appendUserMessage(session: ChatSession, prompt: string, attachments: AttachmentItem[]): ChatSession {
        const message: ChatMessage = {
            id: this.createId(),
            role: 'user',
            prompt,
            attachments: attachments.length > 0 ? attachments : undefined,
            createdAt: Date.now(),
        };

        const updated = {
            ...session,
            messages: [...session.messages, message],
            updatedAt: Date.now(),
        };

        return updated;
    }

    appendAssistantMessage(
        session: ChatSession,
        thought: string,
        content: string,
        segments?: StreamSegment[],
    ): ChatSession {
        const message: ChatMessage = {
            id: this.createId(),
            role: 'assistant',
            thought: thought || undefined,
            content: content || undefined,
            segments: Array.isArray(segments) && segments.length > 0 ? segments : undefined,
            createdAt: Date.now(),
        };

        const updated = {
            ...session,
            messages: [...session.messages, message],
            updatedAt: Date.now(),
        };

        return updated;
    }

    appendSystemMessage(session: ChatSession, content: string): ChatSession | null {
        const text = content.trim();
        if (!text) {
            return null;
        }

        const message: ChatMessage = {
            id: this.createId(),
            role: 'system',
            content: text,
            createdAt: Date.now(),
        };

        const updated = {
            ...session,
            messages: [...session.messages, message],
            updatedAt: Date.now(),
        };

        return updated;
    }
}
