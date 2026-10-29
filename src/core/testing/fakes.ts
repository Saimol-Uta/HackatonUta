// In-memory implementations of the core ports, for unit tests.
import type { Course, Promotion } from "../catalog/course";
import type { Conversation, ConversationPatch, EventType, Message, NewMessage } from "../conversation/types";
import type {
  CatalogRepository,
  ChatTurn,
  Classification,
  ContactProfile,
  ConversationRepository,
  LanguageModel,
  Messenger,
} from "../ports";

export class InMemoryConversations implements ConversationRepository {
  conversations: Conversation[] = [];
  messages: Message[] = [];
  events: { conversationId: number; type: EventType; meta: Record<string, unknown> }[] = [];
  /** Runs right after a message is appended; lets a test simulate a concurrent operator. */
  onAppend: ((message: Message) => void) | null = null;

  async findOrCreateByChat(contact: ContactProfile): Promise<Conversation> {
    const existing = this.conversations.find((c) => c.telegramChatId === contact.telegramChatId);
    if (existing) return { ...existing };
    const created: Conversation = {
      id: this.conversations.length + 1,
      telegramChatId: contact.telegramChatId,
      mode: "ai",
      intentState: "interested",
      needsAttention: false,
      interestedCourseId: null,
      summary: null,
      summarizedUntilMessageId: null,
    };
    this.conversations.push(created);
    return { ...created };
  }

  async get(conversationId: number): Promise<Conversation | null> {
    const found = this.conversations.find((c) => c.id === conversationId);
    return found ? { ...found } : null;
  }

  async appendMessage(message: NewMessage): Promise<Message> {
    const stored: Message = { ...message, id: this.messages.length + 1, createdAt: new Date().toISOString() };
    this.messages.push(stored);
    this.onAppend?.(stored);
    return stored;
  }

  async recentMessages(conversationId: number, limit: number): Promise<Message[]> {
    return this.messages.filter((m) => m.conversationId === conversationId).slice(-limit);
  }

  async messagesAfter(conversationId: number, afterId: number): Promise<Message[]> {
    return this.messages.filter((m) => m.conversationId === conversationId && m.id > afterId);
  }

  async update(conversationId: number, patch: ConversationPatch): Promise<void> {
    const conversation = this.conversations.find((c) => c.id === conversationId);
    if (!conversation) throw new Error(`conversation ${conversationId} not found`);
    Object.assign(conversation, patch);
  }

  async recordEvent(conversationId: number, type: EventType, meta: Record<string, unknown> = {}): Promise<void> {
    this.events.push({ conversationId, type, meta });
  }

  conversation(id = 1): Conversation {
    const found = this.conversations.find((c) => c.id === id);
    if (!found) throw new Error(`conversation ${id} not found`);
    return found;
  }
}

export class InMemoryCatalog implements CatalogRepository {
  constructor(
    public courses: Course[] = [],
    public promotions: Promotion[] = [],
  ) {}

  async listCourses(): Promise<Course[]> {
    return this.courses;
  }

  async listActivePromotions(): Promise<Promotion[]> {
    return this.promotions;
  }
}

export class RecordingMessenger implements Messenger {
  sent: { telegramChatId: number; text: string }[] = [];

  async sendText(telegramChatId: number, text: string): Promise<void> {
    this.sent.push({ telegramChatId, text });
  }
}

export class ScriptedModel implements LanguageModel {
  classification: Classification = {
    intentState: "interested",
    wantsHuman: false,
    injectionSuspected: false,
    courseSlug: null,
  };
  /** Replies returned in order; the last one repeats. */
  replies: string[] = ["¡Hola! Con gusto te ayudo."];
  summary = "Resumen.";
  replyCalls: { system: string; summary: string | null; history: ChatTurn[] }[] = [];
  summarizeCalls: { previousSummary: string | null; history: ChatTurn[] }[] = [];

  async classify(): Promise<Classification> {
    return this.classification;
  }

  async reply(input: { system: string; summary: string | null; history: ChatTurn[] }) {
    this.replyCalls.push(input);
    const text = this.replies[Math.min(this.replyCalls.length - 1, this.replies.length - 1)];
    return { text, usage: { inputTokens: 100, outputTokens: 20 } };
  }

  async summarize(input: { previousSummary: string | null; history: ChatTurn[] }): Promise<string> {
    this.summarizeCalls.push(input);
    return this.summary;
  }
}

export function makeCourse(overrides: Partial<Course> = {}): Course {
  return {
    id: 21,
    slug: "curso21",
    name: "FUNDAMENTOS DE PYTHON 2",
    fullTitle: "Fundamentos de Python 2",
    trainingHours: 40,
    url: "https://ctt-talleresfisei.uta.edu.ec/curso21.php",
    imageUrl: null,
    description: "Módulos, paquetes, excepciones y POO.",
    objectives: null,
    location: "Virtual, plataforma Cisco NetAcad.",
    organizers: null,
    enrollmentStart: "2026-10-30",
    enrollmentEnd: "2026-11-15",
    startDate: "2026-11-16",
    endDate: "2026-12-16",
    schedule: "Modalidad autodidacta.",
    modality: "Virtual autodidacta (Self-paced)",
    certificate: "Certificado digital de asistencia y aprobación con validación QR.",
    prices: { utaStudent: 40, utaStaff: 50, public: 60 },
    detailsText: "Módulo 1: Módulos, paquetes y PIP",
    ...overrides,
  };
}
