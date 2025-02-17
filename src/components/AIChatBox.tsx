"use client";
import { cn } from "@/lib/utils";
import { useUser } from "@clerk/nextjs";
import { ToolInvocation } from "ai";
import { Message, useChat } from "ai/react";
import { Bot, Trash, UserRound, XCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { KeyboardEvent, useCallback, useEffect, useRef, useState } from "react";
import Markdown from "react-markdown";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Textarea } from "./ui/textarea";

type AIChatBoxProps = {
  open: boolean;
  onClose: () => void;
};
type AddToolResult = ReturnType<typeof useChat>["addToolResult"];
export function AIChatBox({ open, onClose }: AIChatBoxProps) {
  const {
    messages,
    input,
    handleInputChange,
    handleSubmit,
    setMessages,
    isLoading,
    addToolResult,
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
      ) {
        console.log(
          "There was a tool-invocation part in the message, refreshing the page",
        );
        router.refresh();
      }
    },
  });

  const inputRef = useRef<HTMLTextAreaElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const handleEnterKey = useDebounceCallback(() => {
    formRef.current?.requestSubmit();
  }, 100);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  useEffect(() => {
    if (open) {
      inputRef.current?.focus();
      if (scrollRef.current) {
        scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
      }
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
          {messages.map((message, index) => (
            <ChatMessage
              key={`${message.id}-${index}`}
              message={message}
              addToolResult={addToolResult}
            />
          ))}
          {isLoading && lastMessageIsUser && (
            <ChatMessage
              message={{ role: "assistant", content: "Thinking...", id: "999" }}
              addToolResult={addToolResult}
            />
          )}
        </div>
        <form
          className="m-3 flex flex-col gap-2"
          ref={formRef}
          id="chat-form"
          onSubmit={handleSubmit}
        >
          <Textarea
            ref={inputRef}
            value={input}
            onChange={handleInputChange}
            onKeyDown={(e: KeyboardEvent) => {
              if (e.key === "Enter" && !e.shiftKey) {
                if (formRef.current) {
                  console.log("onKeyDown called");
                  e.preventDefault();
                  handleEnterKey();
                }
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
            <Button type="submit">Send</Button>
          </div>
        </form>
      </div>
    </div>
  );
}

function ChatMessage({
  message: { role, content, parts },
  addToolResult,
}: {
  message: Message;
  addToolResult: AddToolResult;
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

      {parts?.map((part, index) => {
        switch (part.type) {
          case "text":
            return (
              <Markdown
                key={`${part.type}-${index}`}
                className={cn(
                  "rounded-md border px-3 py-2 leading-6",
                  isAIMessage
                    ? "bg-background"
                    : "bg-primary text-primary-foreground",
                )}
              >
                {content}
              </Markdown>
            );
          case "tool-invocation":
            const toolInvocation = part.toolInvocation;
            if (toolInvocation.state === "call") {
              switch (toolInvocation.toolName) {
                case "askForConfirmation":
                  return (
                    <HandleConfirmation
                      toolInvocation={toolInvocation}
                      addToolResult={addToolResult}
                      key={`${part.type}-${index}`}
                    />
                  );
                case "promptForNoteData":
                  return (
                    <HandleNotePrompt
                      toolInvocation={toolInvocation}
                      addToolResult={addToolResult}
                      key={`${part.type}-${index}`}
                    />
                  );
                default:
                  return null;
              }
            }
        }
      })}
      {!isAIMessage && user?.imageUrl && (
        <UserRound size={20} className="ml-2 shrink-0" />
      )}
    </div>
  );
}

function useDebounceCallback<T extends (...args: any[]) => void>(
  callback: T,
  delay: number,
): (...args: Parameters<T>) => void {
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const debouncedCallback = useCallback(
    (...args: Parameters<T>) => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      timeoutRef.current = setTimeout(() => {
        callback(...args);
      }, delay);
    },
    [callback, delay],
  );

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return debouncedCallback;
}

function HandleConfirmation({
  toolInvocation,
  addToolResult,
}: {
  toolInvocation: ToolInvocation;
  addToolResult: AddToolResult;
}) {
  const toolCallId = toolInvocation.toolCallId;
  return (
    <div
      key={toolCallId}
      className="flex w-full flex-col space-y-4 whitespace-pre-line rounded-md border px-3 py-2"
    >
      <p className="whitespace-pre-wrap">
        {(toolInvocation.args.message as string).replaceAll("\\n", "\n")}
      </p>
      <div className="flex w-full flex-row justify-between space-x-4">
        <Button
          variant={"outline"}
          className="w-full bg-blue-600 text-secondary hover:bg-blue-600/80"
          onClick={() => {
            addToolResult({
              toolCallId,
              result: "Yes, confirmed.",
            });
            console.log("ToolResult Added");
          }}
        >
          Yes
        </Button>
        <Button
          variant={"destructive"}
          className="w-full"
          onClick={() =>
            addToolResult({
              toolCallId,
              result: "No, denied.",
            })
          }
        >
          No
        </Button>
      </div>
    </div>
  );
}

function HandleNotePrompt({
  toolInvocation,
  addToolResult,
}: {
  toolInvocation: ToolInvocation;
  addToolResult: AddToolResult;
}) {
  const toolCallId = toolInvocation.toolCallId;
  const [title, setTitle] = useState(toolInvocation.args.title ?? "");
  const [content, setContent] = useState(toolInvocation.args.content ?? "");

  return (
    <div
      key={toolCallId}
      className="flex w-full flex-col space-y-4 whitespace-pre-line rounded-md border px-3 py-2"
    >
      <p className="whitespace-pre-wrap">
        {(toolInvocation.args.message as string).replaceAll("\\n", "\n")}
      </p>
      <div className="flex w-full flex-col space-y-4">
        {!toolInvocation.args.title && (
          <div className="flex flex-row items-center space-x-2">
            <Label htmlFor="note-title" className="whitespace-nowrap">
              {toolInvocation.args.titleLabel}
            </Label>
            <Input
              id="note-title"
              value={title}
              onChange={(e) => setTitle(e.currentTarget.value)}
            />
          </div>
        )}

        {!toolInvocation.args.content && (
          <div className="flex flex-row items-center space-x-2">
            <Label htmlFor="note-content" className="whitespace-nowrap">
              {toolInvocation.args.contentLabel}
            </Label>
            <Input
              id="note-content"
              value={content}
              onChange={(e) => setContent(e.currentTarget.value)}
            />
          </div>
        )}

        <Button
          disabled={!title || !content}
          variant={"outline"}
          className="w-full bg-blue-600 text-secondary hover:bg-blue-600/80"
          onClick={() => {
            addToolResult({
              toolCallId,
              result: {
                title,
                content,
              },
            });
            console.log("ToolResult Added");
          }}
        >
          {toolInvocation.args.createButtonLabel}
        </Button>
      </div>
    </div>
  );
}
