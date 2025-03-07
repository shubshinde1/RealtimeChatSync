import type { Express } from "express";
import { createServer, type Server } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { setupAuth } from "./auth";
import { storage } from "./storage";
import { insertMessageSchema } from "@shared/schema";

type Client = {
  userId: number;
  ws: WebSocket;
  conversationId?: number;
};

const clients = new Map<number, Client>();

export async function registerRoutes(app: Express): Promise<Server> {
  setupAuth(app);

  app.get("/api/conversations", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    const conversations = await storage.getConversations(req.user!.id);

    // Get user details for each conversation
    const conversationsWithUsers = await Promise.all(
      conversations.map(async (conv) => {
        const otherUserId = conv.user1Id === req.user!.id ? conv.user2Id : conv.user1Id;
        const otherUser = await storage.getUser(otherUserId);
        return {
          ...conv,
          otherUser,
        };
      })
    );

    res.json(conversationsWithUsers);
  });

  app.post("/api/conversations", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    const { username } = req.body;

    const otherUser = await storage.getUserByUsername(username);
    if (!otherUser) {
      return res.status(404).json({ message: "User not found" });
    }

    const conversation = await storage.createConversation(req.user!.id, otherUser.id);
    res.status(201).json({ ...conversation, otherUser });
  });

  app.get("/api/conversations/:id/messages", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    const messages = await storage.getMessages(parseInt(req.params.id));
    res.json(messages);
  });

  app.post("/api/conversations/:id/messages", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);

    const result = insertMessageSchema.safeParse({
      conversationId: parseInt(req.params.id),
      content: req.body.content
    });

    if (!result.success) {
      return res.status(400).json({ message: "Invalid message data" });
    }

    const message = await storage.createMessage(
      parseInt(req.params.id),
      req.user!.id,
      req.body.content
    );

    res.status(201).json(message);
  });

  app.post("/api/user/change-password", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);

    const { currentPassword, newPassword } = req.body;
    const user = await storage.getUser(req.user!.id);

    if (!user || !(await comparePasswords(currentPassword, user.password))) {
      return res.status(400).json({ message: "Current password is incorrect" });
    }

    await storage.updateUserPassword(user.id, await hashPassword(newPassword));
    res.sendStatus(200);
  });

  const httpServer = createServer(app);

  // Setup WebSocket server
  const wss = new WebSocketServer({ server: httpServer, path: '/ws' });

  wss.on('connection', (ws: WebSocket) => {
    let userId: number | undefined;

    ws.on('message', (data: string) => {
      const message = JSON.parse(data);

      switch (message.type) {
        case 'init':
          userId = message.userId;
          clients.set(userId, { userId, ws });
          break;

        case 'typing':
          if (!userId) return;
          const { conversationId, isTyping } = message;
          const conversation = clients.get(userId);
          if (conversation) {
            conversation.conversationId = conversationId;
          }

          // Notify the other user in the conversation
          for (const [_, client] of clients) {
            if (client.conversationId === conversationId && client.userId !== userId) {
              client.ws.send(JSON.stringify({
                type: 'typing',
                userId,
                isTyping
              }));
            }
          }
          break;
      }
    });

    ws.on('close', () => {
      if (userId) {
        clients.delete(userId);
      }
    });
  });

  return httpServer;
}