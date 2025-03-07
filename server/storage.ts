import { users, conversations, messages } from "@shared/schema";
import type { User, InsertUser, Conversation, Message } from "@shared/schema";
import session from "express-session";
import createMemoryStore from "memorystore";

const MemoryStore = createMemoryStore(session);

export interface IStorage {
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUserPassword(userId: number, hashedPassword: string): Promise<void>;
  getConversations(userId: number): Promise<Conversation[]>;
  createConversation(user1Id: number, user2Id: number): Promise<Conversation>;
  getMessages(conversationId: number): Promise<Message[]>;
  createMessage(conversationId: number, senderId: number, content: string): Promise<Message>;
  sessionStore: session.SessionStore;
  updateMessageReadStatus(messageId: number, read: boolean): Promise<void>;
  markConversationMessagesAsRead(conversationId: number, userId: number): Promise<void>;
}

export class MemStorage implements IStorage {
  private users: Map<number, User>;
  private conversations: Map<number, Conversation>;
  private messages: Map<number, Message>;
  private currentUserId: number;
  private currentConversationId: number;
  private currentMessageId: number;
  sessionStore: session.SessionStore;

  constructor() {
    this.users = new Map();
    this.conversations = new Map();
    this.messages = new Map();
    this.currentUserId = 1;
    this.currentConversationId = 1;
    this.currentMessageId = 1;
    this.sessionStore = new MemoryStore({
      checkPeriod: 86400000,
    });
  }

  async getUser(id: number): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.username === username,
    );
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = this.currentUserId++;
    const user: User = { ...insertUser, id };
    this.users.set(id, user);
    return user;
  }

  async getConversations(userId: number): Promise<Conversation[]> {
    return Array.from(this.conversations.values()).filter(
      (conv) => conv.user1Id === userId || conv.user2Id === userId,
    );
  }

  async createConversation(user1Id: number, user2Id: number): Promise<Conversation> {
    const id = this.currentConversationId++;
    const conversation: Conversation = { id, user1Id, user2Id };
    this.conversations.set(id, conversation);
    return conversation;
  }

  async getMessages(conversationId: number): Promise<Message[]> {
    return Array.from(this.messages.values())
      .filter((msg) => msg.conversationId === conversationId)
      .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  }

  async createMessage(conversationId: number, senderId: number, content: string): Promise<Message> {
    const id = this.currentMessageId++;
    const message: Message = {
      id,
      conversationId,
      senderId,
      content,
      timestamp: new Date(),
      read: false,
    };
    this.messages.set(id, message);
    return message;
  }

  async updateUserPassword(userId: number, hashedPassword: string): Promise<void> {
    const user = this.users.get(userId);
    if (user) {
      this.users.set(userId, { ...user, password: hashedPassword });
    }
  }

  async updateMessageReadStatus(messageId: number, read: boolean): Promise<void> {
    const message = this.messages.get(messageId);
    if (message) {
      this.messages.set(messageId, { ...message, read });
    }
  }

  async markConversationMessagesAsRead(conversationId: number, userId: number): Promise<void> {
    for (const [id, message] of this.messages) {
      if (message.conversationId === conversationId && message.senderId !== userId) {
        this.messages.set(id, { ...message, read: true });
      }
    }
  }
}

export const storage = new MemStorage();