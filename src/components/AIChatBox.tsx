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
type ServerToolPart = Extract<
  ChatUIMessage["parts"][number],
  {
    type:
      | "tool-getNotes"
      | "tool-getSalesRecord"
      | "tool-getUserDatetime"
      | "tool-makeNote";
  }
>;

const serverToolLabels = {
  "tool-getNotes": [
    "Looking up notes…",
    "Notes retrieved.",
    "Notes lookup failed.",
  ],
  "tool-getSalesRecord": [
    "Looking up sales records…",
    "Sales records retrieved.",
    "Sales lookup failed.",
  ],
  "tool-getUserDatetime": [
    "Checking the current date…",
    "Current date checked.",
    "Date lookup failed.",
  ],
  "tool-makeNote": [
    "Creating the note…",
    "Note created.",
    "Note creation failed. Check your notes before trying again.",
  ],
} as const;

const chatTransport = new DefaultChatTransport<ChatUIMessage>({
  headers: () => ({
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  }),
});

export function AIChatBox({ open, onClose }: AIChatBoxProps) {
  const [input, setInput] = useState("");
  const router = useRouter();
  const {
    messages,
    sendMessage,
    setMessages,
    status,
    error,
    clearError,
    addToolOutput,
  } = useChat<ChatUIMessage>({
    transport: chatTransport,
    sendAutomaticallyWhen: shouldContinueAfterClientTool,
    onFinish: ({ message }) => {
      if (hasCompletedMakeNoteTool(message)) {
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
  const requiresReset =
    Boolean(error) ||
    status === "error" ||
    (!isRequestInFlight && hasIncompleteToolInput(messages));
  const isInputDisabled =
    isRequestInFlight || isAwaitingClientToolOutput || requiresReset;

  const handleNewChat = useCallback(() => {
    if (isRequestInFlight) return;
    setMessages([]);
    clearError();
    setInput("");
  }, [isRequestInFlight, setMessages, clearError]);

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
  }, [messages, requiresReset]);

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
      <button
        type="button"
        aria-label="Close chat"
        onClick={onClose}
        className="mb-1 ms-auto block"
      >
        <XCircle size={30} />
      </button>
      <div className="flex h-[600px] max-h-[calc(100dvh-3rem)] flex-col justify-between rounded border bg-background shadow-xl">
        <div
          className="flex min-h-0 flex-1 flex-col space-y-2 overflow-y-auto p-4"
          ref={scrollRef}
        >
          {messages.map((message, index) => (
            <ChatMessage
              key={`${message.id}-${index}`}
              message={message}
              addToolOutput={addToolOutput}
              isGenerating={isRequestInFlight && index === messages.length - 1}
              toolsDisabled={isRequestInFlight || requiresReset}
            />
          ))}
          {isRequestInFlight && <AIThinkingIndicator />}
          {requiresReset && (
            <div
              id="chat-recovery"
              role="alert"
              className="space-y-2 rounded-md border border-destructive p-3 text-sm"
            >
              <p>
                The response could not be completed. Start a new chat to
                continue. Starting a new chat does not undo completed actions.
                If you requested a note, check your notes before submitting it
                again; it may already have been created.
              </p>
              <Button type="button" variant="outline" onClick={handleNewChat}>
                Start new chat
              </Button>
            </div>
          )}
        </div>
        <form
          className="m-3 flex shrink-0 flex-col gap-2"
          ref={formRef}
          id="chat-form"
          onSubmit={handleSubmit}
        >
          <Textarea
            ref={inputRef}
            aria-label="Chat message"
            aria-describedby={requiresReset ? "chat-recovery" : undefined}
            value={input}
            onChange={(e) => setInput(e.currentTarget.value)}
            disabled={isInputDisabled}
            onKeyDown={(e: KeyboardEvent) => {
              if (e.key === "Enter" && !e.shiftKey) {
                if (formRef.current) {
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
              title="Start new chat"
              aria-label="Start new chat"
              variant="outline"
              size="icon"
              className="shrink-0"
              type="button"
              disabled={isRequestInFlight}
              onClick={handleNewChat}
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
  isGenerating,
  toolsDisabled,
}: {
  message: ChatUIMessage;
  addToolOutput: AddToolOutput;
  isGenerating: boolean;
  toolsDisabled: boolean;
}) {
  const { user } = useUser();
  const isAIMessage = message.role === "assistant";
  const hasVisibleContent = message.parts.some(
    (part) =>
      (part.type === "text" && Boolean(part.text.trim())) ||
      part.type === "tool-askForConfirmation" ||
      part.type === "tool-renderNoteUI" ||
      part.type === "tool-getNotes" ||
      part.type === "tool-getSalesRecord" ||
      part.type === "tool-getUserDatetime" ||
      part.type === "tool-makeNote",
  );

  // The shared thinking indicator covers assistant messages with no visible
  // content during generation. Keep all parts untouched for stateless replay.
  if (isAIMessage && isGenerating && !hasVisibleContent) return null;

  return (
    <div
      className={cn(
        "mb-3 flex items-center",
        isAIMessage ? "me-5 justify-start" : "ms-5 justify-end",
      )}
    >
      {isAIMessage && <Bot size={20} className="mr-2 shrink-0" />}
      <div className="flex min-w-0 flex-1 flex-col gap-2 break-words">
        {isAIMessage && !hasVisibleContent && (
          <ToolStatus text="The assistant returned no visible answer." />
        )}
        {message.parts.map((part, index) => {
          switch (part.type) {
            case "reasoning":
              // Preserve encrypted replay metadata in history, not in the UI.
              return null;
            case "text":
              if (!part.text.trim()) return null;
              return (
                <div
                  key={`${part.type}-${index}`}
                  className={cn(
                    "min-w-0 overflow-x-auto rounded-md border px-3 py-2 leading-6 [&_pre]:whitespace-pre-wrap [&_pre]:break-words",
                    isAIMessage
                      ? "bg-background"
                      : "bg-primary text-primary-foreground",
                  )}
                >
                  <Markdown>{part.text}</Markdown>
                </div>
              );
            case "tool-askForConfirmation":
              return (
                <HandleConfirmation
                  part={part}
                  addToolOutput={addToolOutput}
                  disabled={toolsDisabled}
                  isGenerating={isGenerating}
                  key={`${part.type}-${part.toolCallId}`}
                />
              );
            case "tool-renderNoteUI":
              return (
                <HandleNotePrompt
                  part={part}
                  addToolOutput={addToolOutput}
                  disabled={toolsDisabled}
                  isGenerating={isGenerating}
                  key={`${part.type}-${part.toolCallId}`}
                />
              );
            case "tool-getNotes":
            case "tool-getSalesRecord":
            case "tool-getUserDatetime":
            case "tool-makeNote":
              return (
                <HandleServerTool
                  part={part}
                  isGenerating={isGenerating}
                  key={`${part.type}-${part.toolCallId}`}
                />
              );
            default:
              return null;
          }
        })}
      </div>
      {!isAIMessage && user?.imageUrl && (
        <UserRound size={20} className="ml-2 shrink-0" />
      )}
    </div>
  );
}

function ToolStatus({
  text,
  failed = false,
}: {
  text: string;
  failed?: boolean;
}) {
  return (
    <p
      role={failed ? "alert" : "status"}
      className={cn(
        "rounded-md border px-3 py-2 text-sm",
        failed ? "border-destructive" : "text-muted-foreground",
      )}
    >
      {text}
    </p>
  );
}

function HandleServerTool({
  part,
  isGenerating,
}: {
  part: ServerToolPart;
  isGenerating: boolean;
}) {
  const [running, completed, failed] = serverToolLabels[part.type];

  if (
    part.state === "output-error" ||
    (part.state === "output-available" &&
      typeof part.output === "string" &&
      part.output.startsWith("An error occurred"))
  ) {
    return <ToolStatus text={failed} failed />;
  }
  if (part.state === "output-denied") {
    return <ToolStatus text="The tool was not approved." />;
  }
  if (part.state === "output-available") {
    if (part.type === "tool-getNotes" && !part.output.trim()) {
      return <ToolStatus text="No matching notes found." />;
    }
    if (part.type === "tool-getSalesRecord" && !part.output.trim()) {
      return <ToolStatus text="No matching sales records found." />;
    }
    return <ToolStatus text={completed} />;
  }
  return (
    <ToolStatus
      text={
        isGenerating
          ? running
          : "The tool did not finish. Start a new chat to continue."
      }
      failed={!isGenerating}
    />
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
  disabled,
  isGenerating,
}: {
  part: ConfirmationPart;
  addToolOutput: AddToolOutput;
  disabled: boolean;
  isGenerating: boolean;
}) {
  if (part.state === "input-streaming") {
    return (
      <ToolStatus
        text={
          isGenerating
            ? "Preparing confirmation…"
            : "Confirmation was interrupted. Start a new chat to continue."
        }
        failed={!isGenerating}
      />
    );
  }
  if (part.state === "output-error") {
    return (
      <ToolStatus text="The confirmation could not be completed." failed />
    );
  }
  if (part.state === "output-denied") {
    return <ToolStatus text="Confirmation was not approved." />;
  }
  if (part.state === "output-available") {
    return (
      <div className="space-y-2">
        <p className="whitespace-pre-wrap">
          {part.input.message.replaceAll("\\n", "\n")}
        </p>
        <ToolStatus
          text={
            part.output === "Yes, confirmed."
              ? "You confirmed note creation."
              : part.output === "No, denied."
                ? "You declined note creation."
                : "Your confirmation response was submitted."
          }
        />
      </div>
    );
  }
  if (part.state !== "input-available") {
    return <ToolStatus text="Confirmation is awaiting approval." />;
  }

  return (
    <div className="flex w-full flex-col space-y-4 whitespace-pre-line rounded-md border px-3 py-2">
      <p className="whitespace-pre-wrap">
        {part.input.message.replaceAll("\\n", "\n")}
      </p>
      <div className="flex w-full flex-row justify-between space-x-4">
        <Button
          type="button"
          disabled={disabled}
          variant="outline"
          className="w-full bg-blue-600 text-secondary hover:bg-blue-600/80"
          onClick={() => {
            if (disabled) return;
            addToolOutput({
              tool: "askForConfirmation",
              toolCallId: part.toolCallId,
              output: "Yes, confirmed.",
            });
          }}
        >
          Yes
        </Button>
        <Button
          type="button"
          disabled={disabled}
          variant="destructive"
          className="w-full"
          onClick={() => {
            if (disabled) return;
            addToolOutput({
              tool: "askForConfirmation",
              toolCallId: part.toolCallId,
              output: "No, denied.",
            });
          }}
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
  disabled,
  isGenerating,
}: {
  part: NotePromptPart;
  addToolOutput: AddToolOutput;
  disabled: boolean;
  isGenerating: boolean;
}) {
  if (part.state === "input-streaming") {
    return (
      <ToolStatus
        text={
          isGenerating
            ? "Preparing the note form…"
            : "The note form was interrupted. Start a new chat to continue."
        }
        failed={!isGenerating}
      />
    );
  }
  if (part.state === "output-error") {
    return (
      <ToolStatus text="The note details could not be submitted." failed />
    );
  }
  if (part.state === "output-denied") {
    return <ToolStatus text="Note entry was not approved." />;
  }
  if (part.state === "output-available") {
    if (typeof part.output === "string") {
      return <ToolStatus text="Note entry canceled." />;
    }
    return (
      <div className="space-y-2 rounded-md border px-3 py-2">
        <p role="status" className="text-sm text-muted-foreground">
          Note details submitted. This does not confirm that the note was
          created.
        </p>
        <p className="whitespace-pre-wrap font-medium">{part.output.title}</p>
        <p className="whitespace-pre-wrap">{part.output.content}</p>
      </div>
    );
  }
  if (part.state !== "input-available") {
    return <ToolStatus text="The note form is awaiting approval." />;
  }
  return (
    <NotePromptForm
      part={part}
      addToolOutput={addToolOutput}
      disabled={disabled}
    />
  );
}

function NotePromptForm({
  part,
  addToolOutput,
  disabled,
}: {
  part: Extract<NotePromptPart, { state: "input-available" }>;
  addToolOutput: AddToolOutput;
  disabled: boolean;
}) {
  // Mount only once the complete input is available, not during input streaming.
  const [title, setTitle] = useState(part.input.title ?? "");
  const [content, setContent] = useState(part.input.content ?? "");

  return (
    <form
      className="flex w-full flex-col space-y-4 whitespace-pre-line rounded-md border px-3 py-2"
      onSubmit={(e) => {
        e.preventDefault();
        if (disabled || !title.trim() || !content.trim()) return;
        addToolOutput({
          tool: "renderNoteUI",
          toolCallId: part.toolCallId,
          output: {
            title,
            content,
          },
        });
      }}
    >
      <p className="whitespace-pre-wrap">
        {part.input.message.replaceAll("\\n", "\n")}
      </p>
      <div className="flex w-full flex-col space-y-4">
        {!part.input.title && (
          <div className="flex flex-row items-center space-x-2">
            <Label
              htmlFor={`note-title-${part.toolCallId}`}
              className="whitespace-nowrap"
            >
              {part.input.titleLabel}
            </Label>
            <Input
              id={`note-title-${part.toolCallId}`}
              disabled={disabled}
              value={title}
              onChange={(e) => setTitle(e.currentTarget.value)}
            />
          </div>
        )}

        {!part.input.content && (
          <div className="flex flex-row items-center space-x-2">
            <Label
              htmlFor={`note-content-${part.toolCallId}`}
              className="whitespace-nowrap"
            >
              {part.input.contentLabel}
            </Label>
            <Input
              id={`note-content-${part.toolCallId}`}
              disabled={disabled}
              value={content}
              onChange={(e) => setContent(e.currentTarget.value)}
            />
          </div>
        )}

        <Button
          type="submit"
          disabled={disabled || !title.trim() || !content.trim()}
          variant="outline"
          className="w-full bg-blue-600 text-secondary hover:bg-blue-600/80"
        >
          {part.input.createButtonLabel}
        </Button>

        <Button
          type="button"
          disabled={disabled}
          variant="destructive"
          className="w-full"
          onClick={() => {
            if (disabled) return;
            addToolOutput({
              tool: "renderNoteUI",
              toolCallId: part.toolCallId,
              output: "Cancel note creation",
            });
          }}
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

function hasIncompleteToolInput(messages: ChatUIMessage[]) {
  return messages.some(
    (message) =>
      message.role === "assistant" &&
      message.parts.some(
        (part) =>
          "toolCallId" in part &&
          (part.state === "input-streaming" ||
            (part.state === "input-available" &&
              part.type !== "tool-askForConfirmation" &&
              part.type !== "tool-renderNoteUI") ||
            part.state === "approval-requested" ||
            part.state === "approval-responded"),
      ),
  );
}

function shouldContinueAfterClientTool({
  messages,
}: {
  messages: ChatUIMessage[];
}) {
  const lastMessage = messages[messages.length - 1];
  if (lastMessage?.role !== "assistant") return false;
  let lastStepStart = -1;
  for (let index = lastMessage.parts.length - 1; index >= 0; index--) {
    if (lastMessage.parts[index].type === "step-start") {
      lastStepStart = index;
      break;
    }
  }
  return (
    lastMessage.parts.some(
      (part, index) =>
        index > lastStepStart &&
        (part.type === "tool-askForConfirmation" ||
          part.type === "tool-renderNoteUI") &&
        part.state === "output-available",
    ) && lastAssistantMessageIsCompleteWithToolCalls({ messages })
  );
}

function hasCompletedMakeNoteTool(message: ChatUIMessage) {
  return message.parts.some(
    (part) =>
      part.type === "tool-makeNote" &&
      part.state === "output-available" &&
      part.output.startsWith("Note created successfully"),
  );
}
