import type { Express } from "express";
import { createServer, type Server } from "http";
import { setupAuth } from "./auth";
import { storage } from "./storage";
import { insertMessageSchema } from "@shared/schema";

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

  const httpServer = createServer(app);
  return httpServer;
}
