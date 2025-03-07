import { useAuth } from "@/hooks/use-auth";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertMessageSchema } from "@shared/schema";
import { LogOut, Send, Loader2, MessageSquare, UserPlus, User, Menu } from "lucide-react";
import { useState, useEffect, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem } from "@/components/ui/form";
import { Link } from "wouter";
import { ThemeToggle } from "@/components/theme-toggle";

// WebSocket connection setup
function useWebSocket() {
  const { user } = useAuth();
  const wsRef = useRef<WebSocket | null>(null);
  const [typingUsers, setTypingUsers] = useState<{ [key: number]: boolean }>({});
  const reconnectTimeoutRef = useRef<NodeJS.Timeout>();

  useEffect(() => {
    if (!user) return;

    function connect() {
      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      const wsUrl = `${protocol}//${window.location.host}/ws`;
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log('WebSocket connected');
        ws.send(JSON.stringify({ type: 'init', userId: user.id }));
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          switch (data.type) {
            case 'ping':
              console.log('Received ping from server');
              break;
            case 'typing':
              setTypingUsers(prev => ({
                ...prev,
                [data.userId]: data.isTyping
              }));
              break;
          }
        } catch (err) {
          console.error('Error processing WebSocket message:', err);
        }
      };

      ws.onerror = (error) => {
        console.error('WebSocket error:', error);
      };

      ws.onclose = () => {
        console.log('WebSocket disconnected, attempting to reconnect...');
        wsRef.current = null;
        // Attempt to reconnect after 3 seconds
        reconnectTimeoutRef.current = setTimeout(connect, 3000);
      };
    }

    connect();

    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
    };
  }, [user]);

  const sendTypingStatus = (conversationId: number, isTyping: boolean) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'typing',
        conversationId,
        isTyping
      }));
    }
  };

  return { typingUsers, sendTypingStatus };
}

export default function ChatPage() {
  const { user, logoutMutation } = useAuth();
  const [selectedConversation, setSelectedConversation] = useState<number | null>(null);
  const [showSidebar, setShowSidebar] = useState(true);
  const { toast } = useToast();

  // Close sidebar on mobile when conversation is selected
  useEffect(() => {
    if (window.innerWidth < 768 && selectedConversation) {
      setShowSidebar(false);
    }
  }, [selectedConversation]);

  const { data: conversations, isLoading: conversationsLoading } = useQuery({
    queryKey: ["/api/conversations"],
  });

  // Poll for new messages every 3 seconds
  useEffect(() => {
    if (!selectedConversation) return;

    const interval = setInterval(() => {
      queryClient.invalidateQueries({
        queryKey: [`/api/conversations/${selectedConversation}/messages`],
      });
    }, 3000);

    return () => clearInterval(interval);
  }, [selectedConversation]);

  if (conversationsLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="flex h-screen">
      {/* Mobile Menu Button */}
      <Button
        variant="ghost"
        size="icon"
        className="md:hidden fixed top-4 left-4 z-50"
        onClick={() => setShowSidebar(!showSidebar)}
      >
        <Menu className="h-4 w-4" />
      </Button>

      {/* Sidebar */}
      <div
        className={`${
          showSidebar ? 'translate-x-0' : '-translate-x-full'
        } md:translate-x-0 transition-transform duration-200 fixed md:relative z-40 w-80 h-full bg-background border-r flex flex-col`}
      >
        <div className="p-4 border-b flex items-center justify-between">
          <h2 className="font-semibold">Conversations</h2>
          <div className="flex gap-2">
            <NewConversationDialog />
            <Link href="/profile">
              <Button variant="ghost" size="icon" title="Profile Settings">
                <User className="h-4 w-4" />
              </Button>
            </Link>
            <ThemeToggle />
            <Button
              variant="ghost"
              size="icon"
              onClick={() => logoutMutation.mutate()}
            >
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <ScrollArea className="flex-1">
          {conversations?.map((conv: any) => {
            const unreadCount = conv.messages?.filter(
              (m: any) => m.senderId !== user?.id && !m.read
            ).length;

            return (
              <div
                key={conv.id}
                className={`p-4 cursor-pointer hover:bg-accent ${
                  selectedConversation === conv.id ? "bg-accent" : ""
                }`}
                onClick={() => setSelectedConversation(conv.id)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="relative">
                      <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center overflow-hidden">
                        {conv.otherUser?.profilePicture ? (
                          <img
                            src={conv.otherUser.profilePicture}
                            alt={conv.otherUser.username}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <User className="h-5 w-5 text-primary" />
                        )}
                      </div>
                    </div>
                    <div className="font-medium">{conv.otherUser?.username}</div>
                  </div>
                  {unreadCount > 0 && (
                    <div className="bg-primary text-primary-foreground rounded-full px-2 py-0.5 text-xs">
                      {unreadCount}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </ScrollArea>
      </div>

      {/* Chat Area */}
      <div className={`flex-1 flex flex-col ${!showSidebar ? 'ml-0' : 'md:ml-0 ml-80'}`}>
        {selectedConversation ? (
          <ChatArea conversationId={selectedConversation} />
        ) : (
          <div className="flex-1 flex items-center justify-center text-muted-foreground">
            <div className="text-center">
              <MessageSquare className="h-8 w-8 mx-auto mb-2" />
              <p>Select a conversation to start chatting</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function ChatArea({ conversationId }: { conversationId: number }) {
  const { user } = useAuth();
  const { typingUsers, sendTypingStatus } = useWebSocket();
  const [isTyping, setIsTyping] = useState(false);
  const typingTimeoutRef = useRef<NodeJS.Timeout>();

  const { data: messages, isLoading } = useQuery({
    queryKey: [`/api/conversations/${conversationId}/messages`],
  });

  const { data: conversations } = useQuery({
    queryKey: ["/api/conversations"],
  });

  const currentConversation = conversations?.find((conv: any) => conv.id === conversationId);
  const otherUser = currentConversation?.otherUser;

  const sendMessageMutation = useMutation({
    mutationFn: async ({ content }: { content: string }) => {
      const res = await apiRequest(
        "POST",
        `/api/conversations/${conversationId}/messages`,
        { content }
      );
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: [`/api/conversations/${conversationId}/messages`],
      });
    },
  });

  const form = useForm({
    resolver: zodResolver(insertMessageSchema.pick({ content: true })),
    defaultValues: {
      content: "",
    },
  });

  const handleTyping = () => {
    if (!isTyping) {
      setIsTyping(true);
      sendTypingStatus(conversationId, true);
    }

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    typingTimeoutRef.current = setTimeout(() => {
      setIsTyping(false);
      sendTypingStatus(conversationId, false);
    }, 1000);
  };

  const onSubmit = async (data: { content: string }) => {
    if (!data.content.trim()) {
      form.setError("content", { message: "Message cannot be empty" });
      return;
    }
    await sendMessageMutation.mutate({ content: data.content.trim() });
    form.reset();
    setIsTyping(false);
    sendTypingStatus(conversationId, false);
  };

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <>
      {/* Chat Header */}
      <div className="p-4 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-10">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center overflow-hidden">
                {otherUser?.profilePicture ? (
                  <img
                    src={otherUser.profilePicture}
                    alt={otherUser.username}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <User className="h-5 w-5 text-primary" />
                )}
              </div>
              {otherUser && typingUsers[otherUser.id] && (
                <div className="absolute -bottom-1 -right-1 h-3 w-3 rounded-full bg-green-500" />
              )}
            </div>
            <div>
              <h3 className="font-medium">{otherUser?.username}</h3>
              {otherUser && typingUsers[otherUser.id] && (
                <p className="text-xs text-muted-foreground">typing...</p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1 p-4">
        <div className="space-y-4">
          {messages?.map((message: any) => (
            <div
              key={message.id}
              className={`flex ${
                message.senderId === user?.id ? "justify-end" : "justify-start"
              }`}
            >
              <div
                className={`max-w-[70%] px-4 py-2 rounded-lg ${
                  message.senderId === user?.id
                    ? "bg-primary text-primary-foreground"
                    : "bg-accent"
                }`}
              >
                {message.content}
              </div>
            </div>
          ))}
        </div>
      </ScrollArea>

      {/* Message Input */}
      <div className="p-4 border-t">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="flex gap-2">
            <FormField
              control={form.control}
              name="content"
              render={({ field }) => (
                <FormItem className="flex-1">
                  <FormControl>
                    <Input
                      placeholder="Type a message..."
                      {...field}
                      disabled={sendMessageMutation.isPending}
                      onChange={(e) => {
                        field.onChange(e);
                        handleTyping();
                      }}
                    />
                  </FormControl>
                  <div className="text-sm text-destructive">
                    {form.formState.errors.content?.message}
                  </div>
                </FormItem>
              )}
            />
            <Button
              type="submit"
              disabled={sendMessageMutation.isPending || !form.watch("content").trim()}
              size="icon"
            >
              {sendMessageMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
          </form>
        </Form>
      </div>
    </>
  );
}

function NewConversationDialog() {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);

  const startConversationMutation = useMutation({
    mutationFn: async ({ username }: { username: string }) => {
      const res = await apiRequest("POST", "/api/conversations", { username });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/conversations"] });
      setOpen(false);
      toast({
        title: "Conversation created",
        description: "You can now start chatting!",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to create conversation",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const form = useForm({
    defaultValues: {
      username: "",
    },
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon">
          <UserPlus className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Start a new conversation</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit((data) =>
              startConversationMutation.mutate(data)
            )}
            className="space-y-4"
          >
            <FormField
              control={form.control}
              name="username"
              render={({ field }) => (
                <FormItem>
                  <FormControl>
                    <Input
                      placeholder="Enter username..."
                      {...field}
                      disabled={startConversationMutation.isPending}
                    />
                  </FormControl>
                </FormItem>
              )}
            />
            <Button
              type="submit"
              className="w-full"
              disabled={startConversationMutation.isPending}
            >
              {startConversationMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                "Start Conversation"
              )}
            </Button>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}