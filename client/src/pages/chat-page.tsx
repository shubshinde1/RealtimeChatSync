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
import { LogOut, Send, Loader2, MessageSquare, UserPlus } from "lucide-react";
import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem } from "@/components/ui/form";

export default function ChatPage() {
  const { user, logoutMutation } = useAuth();
  const [selectedConversation, setSelectedConversation] = useState<number | null>(null);
  const { toast } = useToast();

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
      {/* Sidebar */}
      <div className="w-80 border-r flex flex-col">
        <div className="p-4 border-b flex items-center justify-between">
          <h2 className="font-semibold">Conversations</h2>
          <div className="flex gap-2">
            <NewConversationDialog />
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
          {conversations?.map((conv: any) => (
            <div
              key={conv.id}
              className={`p-4 cursor-pointer hover:bg-accent ${
                selectedConversation === conv.id ? "bg-accent" : ""
              }`}
              onClick={() => setSelectedConversation(conv.id)}
            >
              <div className="font-medium">{conv.otherUser?.username}</div>
            </div>
          ))}
        </ScrollArea>
      </div>

      {/* Chat Area */}
      <div className="flex-1 flex flex-col">
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
  const { data: messages, isLoading } = useQuery({
    queryKey: [`/api/conversations/${conversationId}/messages`],
  });

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

  const onSubmit = async (data: { content: string }) => {
    await sendMessageMutation.mutate(data);
    form.reset();
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
                    />
                  </FormControl>
                </FormItem>
              )}
            />
            <Button
              type="submit"
              disabled={sendMessageMutation.isPending}
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
