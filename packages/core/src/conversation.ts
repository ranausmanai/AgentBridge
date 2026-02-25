import { randomUUID } from 'crypto';
import type { Session, Message } from './types.js';

export class ConversationManager {
  private sessions: Map<string, Session> = new Map();

  create(): Session {
    const session: Session = {
      id: randomUUID(),
      messages: [],
      metadata: {},
    };
    this.sessions.set(session.id, session);
    return session;
  }

  get(sessionId: string): Session | undefined {
    return this.sessions.get(sessionId);
  }

  addMessage(sessionId: string, message: Message): void {
    const session = this.sessions.get(sessionId);
    if (!session) throw new Error(`Session not found: ${sessionId}`);
    session.messages.push(message);
  }

  getMessages(sessionId: string): Message[] {
    return this.sessions.get(sessionId)?.messages ?? [];
  }

  destroy(sessionId: string): void {
    this.sessions.delete(sessionId);
  }
}
