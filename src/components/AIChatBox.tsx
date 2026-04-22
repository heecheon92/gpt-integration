"use client";

import type { UIMessage } from "@ai-sdk/react";
import { useChat } from "@ai-sdk/react";
import { useUser } from "@clerk/nextjs";
import type { InferUITools } from "ai";
import {
  DefaultChatTransport,
  lastAssistantMessageIsCompleteWithToolCalls,
} from "ai";
import { Bot, Trash, UserRound, XCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import {
  FormEvent,
  KeyboardEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import Markdown from "react-markdown";
import type { noteTools } from "@/app/api/notes/tools";
import type { salesTools } from "@/app/api/sales/tools";
import { cn } from "@/lib/utils";
import { AIThinkingIndicator } from "./AIThinkingIndicator";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Textarea } from "./ui/textarea";

type AIChatBoxProps = {
  open: boolean;
  onClose: () => void;
};

type ChatTools = InferUITools<
  ReturnType<typeof noteTools> & ReturnType<typeof salesTools>
>;

type ChatUIMessage = UIMessage<unknown, never, ChatTools>;
type AddToolOutput = ReturnType<typeof useChat<ChatUIMessage>>["addToolOutput"];
type ConfirmationPart = Extract<
  ChatUIMessage["parts"][number],
  { type: "tool-askForConfirmation" }
>;
type NotePromptPart = Extract<
  ChatUIMessage["parts"][number],
  { type: "tool-renderNoteUI" }
>;

const chatTransport = new DefaultChatTransport<ChatUIMessage>({
  headers: () => ({
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  }),
});

export function AIChatBox({ open, onClose }: AIChatBoxProps) {
  const [input, setInput] = useState("");
  const router = useRouter();
  const { messages, sendMessage, setMessages, status, addToolOutput } =
    useChat<ChatUIMessage>({
      transport: chatTransport,
      sendAutomaticallyWhen: lastAssistantMessageIsCompleteWithToolCalls,
      onFinish: ({ message }) => {
        console.log(
          "useChat onFinish message: ",
          JSON.stringify(message, null, 2),
        );

        if (hasCompletedMakeNoteTool(message)) {
          console.log("A note was created by a tool call, refreshing the page");
          router.refresh();
        }
      },
    });

  const inputRef = useRef<HTMLTextAreaElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const handleEnterKey = useDebounceCallback(() => {
    formRef.current?.requestSubmit();
  }, 100);
  const isAwaitingClientToolOutput = useMemo(
    () => needsClientToolOutput(messages),
    [messages],
  );
  const isRequestInFlight = status === "submitted" || status === "streaming";
  const isInputDisabled = isRequestInFlight || isAwaitingClientToolOutput;

  const handleSubmit = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      const text = input.trim();
      if (!text || isInputDisabled) return;

      setInput("");
      await sendMessage({ text });
    },
    [input, isInputDisabled, sendMessage],
  );

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

  return (
    <div
      className={cn(
        "bottom-0 right-0 z-10 w-full max-w-[500px] p-1 xl:right-36",
        open ? "fixed" : "hidden",
      )}
    >
      <button type="button" onClick={onClose} className="mb-1 ms-auto block">
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
              addToolOutput={addToolOutput}
            />
          ))}
          {isRequestInFlight && <AIThinkingIndicator />}
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
            onChange={(e) => setInput(e.currentTarget.value)}
            disabled={isInputDisabled}
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
            <Button type="submit" disabled={isInputDisabled || !input.trim()}>
              Send
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

function ChatMessage({
  message,
  addToolOutput,
}: {
  message: ChatUIMessage;
  addToolOutput: AddToolOutput;
}) {
  const { user } = useUser();
  const isAIMessage = message.role === "assistant";

  if (isAIMessage) {
    console.log("AI Message: ", JSON.stringify(message, null, 2));
  }

  return (
    <div
      className={cn(
        "mb-3 flex items-center",
        isAIMessage ? "me-5 justify-start" : "ms-5 justify-end",
      )}
    >
      {isAIMessage && <Bot size={20} className="mr-2 shrink-0" />}
      {message.parts.map((part, index) => {
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
                {part.text}
              </Markdown>
            );
          case "tool-askForConfirmation":
            return (
              <HandleConfirmation
                part={part}
                addToolOutput={addToolOutput}
                key={`${part.type}-${part.toolCallId}`}
              />
            );
          case "tool-renderNoteUI":
            return (
              <HandleNotePrompt
                part={part}
                addToolOutput={addToolOutput}
                key={`${part.type}-${part.toolCallId}`}
              />
            );
          default:
            return null;
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
  part,
  addToolOutput,
}: {
  part: ConfirmationPart;
  addToolOutput: AddToolOutput;
}) {
  if (part.state !== "input-available") return null;

  return (
    <div className="flex w-full flex-col space-y-4 whitespace-pre-line rounded-md border px-3 py-2">
      <p className="whitespace-pre-wrap">
        {part.input.message.replaceAll("\\n", "\n")}
      </p>
      <div className="flex w-full flex-row justify-between space-x-4">
        <Button
          variant="outline"
          className="w-full bg-blue-600 text-secondary hover:bg-blue-600/80"
          onClick={() => {
            addToolOutput({
              tool: "askForConfirmation",
              toolCallId: part.toolCallId,
              output: "Yes, confirmed.",
            });
            console.log("Tool output added");
          }}
        >
          Yes
        </Button>
        <Button
          variant="destructive"
          className="w-full"
          onClick={() =>
            addToolOutput({
              tool: "askForConfirmation",
              toolCallId: part.toolCallId,
              output: "No, denied.",
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
  part,
  addToolOutput,
}: {
  part: NotePromptPart;
  addToolOutput: AddToolOutput;
}) {
  const [title, setTitle] = useState(part.input?.title ?? "");
  const [content, setContent] = useState(part.input?.content ?? "");

  if (part.state !== "input-available") return null;

  return (
    <form
      className="flex w-full flex-col space-y-4 whitespace-pre-line rounded-md border px-3 py-2"
      onSubmit={(e) => {
        e.preventDefault();
        addToolOutput({
          tool: "renderNoteUI",
          toolCallId: part.toolCallId,
          output: {
            title,
            content,
          },
        });
        console.log("Tool output added");
      }}
    >
      <p className="whitespace-pre-wrap">
        {part.input.message.replaceAll("\\n", "\n")}
      </p>
      <div className="flex w-full flex-col space-y-4">
        {!part.input.title && (
          <div className="flex flex-row items-center space-x-2">
            <Label htmlFor="note-title" className="whitespace-nowrap">
              {part.input.titleLabel}
            </Label>
            <Input
              id="note-title"
              value={title}
              onChange={(e) => setTitle(e.currentTarget.value)}
            />
          </div>
        )}

        {!part.input.content && (
          <div className="flex flex-row items-center space-x-2">
            <Label htmlFor="note-content" className="whitespace-nowrap">
              {part.input.contentLabel}
            </Label>
            <Input
              id="note-content"
              value={content}
              onChange={(e) => setContent(e.currentTarget.value)}
            />
          </div>
        )}

        <Button
          type="submit"
          disabled={!title || !content}
          variant="outline"
          className="w-full bg-blue-600 text-secondary hover:bg-blue-600/80"
        >
          {part.input.createButtonLabel}
        </Button>

        <Button
          type="button"
          variant="destructive"
          className="w-full"
          onClick={() =>
            addToolOutput({
              tool: "renderNoteUI",
              toolCallId: part.toolCallId,
              output: "Cancel note creation",
            })
          }
        >
          {part.input.cancelButtonLabel}
        </Button>
      </div>
    </form>
  );
}

function needsClientToolOutput(messages: ChatUIMessage[]) {
  const lastMessage = messages[messages.length - 1];
  if (lastMessage?.role !== "assistant") return false;

  return lastMessage.parts.some(
    (part) =>
      (part.type === "tool-askForConfirmation" ||
        part.type === "tool-renderNoteUI") &&
      (part.state === "input-streaming" || part.state === "input-available"),
  );
}

function hasCompletedMakeNoteTool(message: ChatUIMessage) {
  return message.parts.some(
    (part) =>
      part.type === "tool-makeNote" && part.state === "output-available",
  );
}
