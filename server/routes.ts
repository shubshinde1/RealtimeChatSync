import type { Express } from "express";
import { createServer, type Server } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { setupAuth, hashPassword, comparePasswords } from "./auth";
import { storage } from "./storage";
import { insertMessageSchema } from "@shared/schema";
import { parse } from "url";

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

    // Check if conversation already exists
    const existingConversations = await storage.getConversations(req.user!.id);
    const existingConversation = existingConversations.find(conv =>
      (conv.user1Id === req.user!.id && conv.user2Id === otherUser.id) ||
      (conv.user1Id === otherUser.id && conv.user2Id === req.user!.id)
    );

    if (existingConversation) {
      const otherUserDetails = await storage.getUser(otherUser.id);
      return res.json({ ...existingConversation, otherUser: otherUserDetails });
    }

    const conversation = await storage.createConversation(req.user!.id, otherUser.id);
    res.status(201).json({ ...conversation, otherUser });
  });

  app.get("/api/conversations/:id/messages", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    const messages = await storage.getMessages(parseInt(req.params.id));
    // Mark messages as read when fetched
    await storage.markConversationMessagesAsRead(parseInt(req.params.id), req.user!.id);
    res.json(messages);
  });

  app.post("/api/conversations/:id/messages", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);

    const result = insertMessageSchema.safeParse({
      conversationId: parseInt(req.params.id),
      content: req.body.content,
      replyToId: req.body.replyToId
    });

    if (!result.success) {
      return res.status(400).json({ message: "Invalid message data" });
    }

    const message = await storage.createMessage(
      parseInt(req.params.id),
      req.user!.id,
      req.body.content,
      req.body.replyToId
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

  // Add this new route after the existing user-related routes
  app.post("/api/user/profile-picture", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);

    const { profilePicture } = req.body;
    await storage.updateUserProfilePicture(req.user!.id, profilePicture);

    const updatedUser = await storage.getUser(req.user!.id);
    res.json(updatedUser);
  });

  app.delete("/api/user/profile-picture", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);

    await storage.updateUserProfilePicture(req.user!.id, null);

    const updatedUser = await storage.getUser(req.user!.id);
    res.json(updatedUser);
  });

  const httpServer = createServer(app);

  // Setup WebSocket server
  const wss = new WebSocketServer({ server: httpServer, path: '/ws' });

  wss.on('connection', (ws: WebSocket, req) => {
    let userId: number | undefined;
    console.log('New WebSocket connection attempt');

    ws.on('message', (data: string) => {
      try {
        const message = JSON.parse(data);
        console.log('Received WebSocket message:', message.type);

        switch (message.type) {
          case 'init':
            userId = message.userId;
            if (userId) {
              console.log(`Initializing WebSocket for user ${userId}`);
              // Remove any existing connection for this user
              const existingClient = clients.get(userId);
              if (existingClient) {
                existingClient.ws.close();
                clients.delete(userId);
              }
              clients.set(userId, { userId, ws });
              console.log(`WebSocket connection established for user ${userId}`);
            }
            break;

          case 'typing':
            if (!userId) {
              console.log('Typing event received but no userId set');
              return;
            }
            const { conversationId, isTyping } = message;
            const conversation = clients.get(userId);
            if (conversation) {
              conversation.conversationId = conversationId;
            }

            // Notify the other user in the conversation
            for (const client of clients.values()) {
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
      } catch (err) {
        console.error('WebSocket message error:', err);
      }
    });

    ws.on('close', () => {
      if (userId) {
        console.log(`WebSocket connection closed for user ${userId}`);
        clients.delete(userId);
      }
    });

    // Send an initial ping to establish connection
    ws.send(JSON.stringify({ type: 'ping' }));
  });

  return httpServer;
}