"use client";
import { cn } from "@/lib/utils";
import { useUser } from "@clerk/nextjs";
import { Message, useChat } from "ai/react";
import { Bot, Trash, UserRound, XCircle } from "lucide-react";
import { useEffect, useRef } from "react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";

type AIChatBoxProps = {
  open: boolean;
  onClose: () => void;
};
export function AIChatBox({ open, onClose }: AIChatBoxProps) {
  const {
    messages,
    input,
    handleInputChange,
    handleSubmit,
    setMessages,
    isLoading,
  } = useChat();

  const inputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  useEffect(() => {
    if (open) {
      inputRef.current?.focus();
    }
  }, [open]);

  const lastMessageIsUser = messages[messages.length - 1]?.role === "user";
  return (
    <div
      className={cn(
        "bottom-0 right-0 z-10 w-full max-w-[500px] p-1 xl:right-36",
        open ? "absolute" : "hidden",
      )}
    >
      <button onClick={onClose} className="mb-1 ms-auto block">
        <XCircle size={30} />
      </button>
      <div className="flex h-[600px] flex-col justify-between rounded border bg-background shadow-xl">
        <div
          className="flex h-full flex-col space-y-2 overflow-y-auto p-4"
          ref={scrollRef}
        >
          {messages.map((message) => (
            <ChatMessage key={message.id} message={message} />
          ))}
          {isLoading && lastMessageIsUser && (
            <ChatMessage
              message={{ role: "assistant", content: "Thinking..." }}
            />
          )}
        </div>
        <form onSubmit={handleSubmit} className="m-3 flex gap-2">
          <Button
            title="Clear chat"
            variant="outline"
            size="icon"
            className="shrink-0"
            type="button"
            onClick={() => setMessages([])}
          >
            <Trash />
          </Button>
          <Input
            ref={inputRef}
            value={input}
            onChange={handleInputChange}
            placeholder="Type a message..."
          />
          <Button type="submit">Send</Button>
        </form>
      </div>
    </div>
  );
}

function ChatMessage({
  message: { role, content },
}: {
  message: Pick<Message, "role" | "content">;
}) {
  const { user } = useUser();
  const isAIMessage = role === "assistant";

  return (
    <div
      className={cn(
        "mb-3 flex items-center",
        isAIMessage ? "me-5 justify-start" : "ms-5 justify-end",
      )}
    >
      {isAIMessage && <Bot size={20} className="mr-2 shrink-0" />}
      <p
        className={cn(
          "whitespace-pre-line rounded-md border px-3 py-2",
          isAIMessage ? "bg-background" : "bg-primary text-primary-foreground",
        )}
      >
        {content}
      </p>
      {!isAIMessage && user?.imageUrl && (
        <UserRound size={20} className="ml-2 shrink-0" />
      )}
    </div>
  );
}
