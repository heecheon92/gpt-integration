"use client";
import { cn, debounce } from "@/lib/utils";
import { useUser } from "@clerk/nextjs";
import { Message, useChat } from "ai/react";
import { Bot, Trash, UserRound, XCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import { Button } from "./ui/button";
import { Textarea } from "./ui/textarea";

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
  } = useChat({
    onFinish: (message) => {
      console.log(
        "useChat onFinish message: ",
        JSON.stringify(message, null, 2),
      );

      if (
        message.parts &&
        message.parts.length > 0 &&
        message.parts.some((part) => part.type === "tool-invocation")
      )
        router.refresh();
    },
  });

  const inputRef = useRef<HTMLTextAreaElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

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
        open ? "fixed" : "hidden",
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
        <form
          className="m-3 flex flex-col gap-2"
          ref={formRef}
          id="chat-form"
          onSubmit={(e) => e.preventDefault()}
        >
          <Textarea
            ref={inputRef}
            value={input}
            onChange={handleInputChange}
            onKeyUp={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                debounce(() => {
                  e.preventDefault();
                  handleSubmit(e);
                }, 100)();
              }
            }}
            placeholder="Type a message..."
            form="chat-form"
          />
          <div className="flex flex-row items-center justify-between">
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
            {/* <Button type="submit">Send</Button> */}
          </div>
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
