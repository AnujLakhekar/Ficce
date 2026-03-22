"use client";

import React from "react";
import { nanoid } from "nanoid";
import { BotIcon, MessageCircleIcon } from "lucide-react";
import { usePathname } from "next/navigation";
import {
  addDoc,
  collection,
  doc,
  getDocs,
  getFirestore,
  limit,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
} from "firebase/firestore";
import {
  Conversation,
  ConversationContent,
  ConversationScrollButton,
} from "@/components/ai/conversation";
import {
  Message,
  MessageContent,
  MessageResponse,
} from "@/components/ai/message";
import {
  PromptInput,
  PromptInputActionAddAttachments,
  PromptInputActionMenu,
  PromptInputActionMenuContent,
  PromptInputActionMenuTrigger,
  PromptInputAttachment,
  PromptInputAttachments,
  PromptInputBody,
  PromptInputFooter,
  PromptInputSelect,
  PromptInputSelectContent,
  PromptInputSelectItem,
  PromptInputSelectTrigger,
  PromptInputSelectValue,
  PromptInputSubmit,
  PromptInputTextarea,
  PromptInputTools,
  type PromptInputMessage,
} from "@/components/ai/prompt-input";
import { Suggestion, Suggestions } from "@/components/ai/suggestion";
import { auth } from "@/lib/firebase";
import { showError } from "@/lib/toast";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

type Mode = "chat" | "agent";

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  action: "none" | "thinking" | "streaming";
};

type AgentStreamEvent =
  | { type: "state"; state: "thinking" | "working"; iteration?: number }
  | { type: "chunk"; text: string }
  | { type: "tool"; tool: string; input?: unknown }
  | { type: "tool_result"; tool: string; output: unknown }
  | { type: "error"; message: string }
  | { type: "done" };

type KikoWorkspaceProps = {
  initialMode?: Mode;
};

type ChatSession = {
  id: string;
  title: string;
  updatedAt: number;
};

const QUICK_PROMPTS = [
  "Summarize today’s transactions",
  "Generate pending task checklist",
  "Draft invoice follow-up",
  "Find spending anomalies",
];

const MAX_ATTACHMENT_CHARS = 4000;
const MAX_TOTAL_ATTACHMENT_CHARS = 12000;

const MODEL_OPTIONS = [
  { id: "ollama:qwen2.5:3b", label: "Ollama qwen2.5:3b" },
  { id: "ollama:qwen2.5:1.5b", label: "Ollama qwen2.5:1.5b" },
  { id: "ollama:llama3.1:8b", label: "Ollama llama3.1:8b" },
  { id: "ollama:mistral:7b", label: "Ollama mistral:7b" },
  { id: "gemini:gemini-1.5-flash", label: "Gemini 1.5 Flash" },
];

type UploadLikeFile = {
  filename?: string;
  mediaType?: string;
  url?: string;
};

const getFileExtension = (name: string) => {
  const parts = name.toLowerCase().split(".");
  return parts.length > 1 ? parts.pop() ?? "" : "";
};

const isCsvOrText = (file: UploadLikeFile) => {
  const filename = file.filename ?? "";
  const extension = getFileExtension(filename);
  const mediaType = (file.mediaType ?? "").toLowerCase();
  return (
    extension === "csv" ||
    extension === "txt" ||
    mediaType.includes("text/csv") ||
    mediaType.includes("text/plain")
  );
};

const isExcelFile = (file: UploadLikeFile) => {
  const filename = file.filename ?? "";
  const extension = getFileExtension(filename);
  const mediaType = (file.mediaType ?? "").toLowerCase();
  return (
    extension === "xlsx" ||
    extension === "xls" ||
    mediaType.includes("spreadsheet") ||
    mediaType.includes("excel")
  );
};

const truncateForPrompt = (text: string, maxChars: number) => {
  if (text.length <= maxChars) {
    return text;
  }

  return `${text.slice(0, maxChars)}\n...[truncated]`;
};

const formatSheetPreview = (sheetName: string, rows: unknown[][]) => {
  const limitedRows = rows.slice(0, 40).map((row) =>
    row
      .slice(0, 20)
      .map((cell) => String(cell ?? ""))
      .join("\t"),
  );

  return [`Sheet: ${sheetName}`, ...limitedRows].join("\n");
};

const extractAttachmentContent = async (file: UploadLikeFile) => {
  if (!file.url) {
    return null;
  }

  const filename = file.filename ?? "attachment";

  try {
    if (isCsvOrText(file)) {
      const text = await (await fetch(file.url)).text();
      return {
        filename,
        content: truncateForPrompt(text, MAX_ATTACHMENT_CHARS),
      };
    }

    if (isExcelFile(file)) {
      const response = await fetch(file.url);
      const data = await response.arrayBuffer();
      const XLSX = await import("xlsx");
      const workbook = XLSX.read(data, { type: "array" });

      const previews = workbook.SheetNames.slice(0, 3).map((sheetName) => {
        const sheet = workbook.Sheets[sheetName];
        const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
          header: 1,
          blankrows: false,
        });
        return formatSheetPreview(sheetName, rows as unknown[][]);
      });

      return {
        filename,
        content: truncateForPrompt(previews.join("\n\n"), MAX_ATTACHMENT_CHARS),
      };
    }
  } catch {
    return {
      filename,
      content: "[Unable to parse this attachment]",
    };
  }

  return null;
};

const buildAttachmentExtractionBlock = async (files: UploadLikeFile[]) => {
  const parsed = await Promise.all(files.map((file) => extractAttachmentContent(file)));
  const valid = parsed.filter((item): item is { filename: string; content: string } => Boolean(item));

  if (valid.length === 0) {
    return "";
  }

  const block = valid
    .map((item) => `File: ${item.filename}\n${item.content}`)
    .join("\n\n---\n\n");

  return `\n\nExtracted attachment data:\n${truncateForPrompt(block, MAX_TOTAL_ATTACHMENT_CHARS)}`;
};

const AGENT_TOOLS = [
  {
    id: "firebase-read",
    title: "Read user data from Firebase",
    details:
      "Fetches user document/collections like tasks, notifications, transactions, payments, and profile data from users/{uid}/...",
  },
  {
    id: "firebase-write",
    title: "Write user data to Firebase",
    details:
      "Creates and updates records in users/{uid}/... including tasks, transactions, invoices, and custom collections.",
  },
  {
    id: "agent-calc",
    title: "Run calculations and summaries",
    details:
      "Computes totals, balances, category breakdowns, and evaluation summaries from user data before responding.",
  },
];

function getInitialAssistantMessage(mode: Mode): ChatMessage {
  return {
    id: nanoid(),
    role: "assistant",
    content:
      mode === "agent"
        ? "Agent mode enabled. Share a task and I will return an action plan with steps."
        : "Chat mode enabled. Ask anything and attach media/files if needed.",
    action: "none",
  };
}

function getChatTitle(source: string): string {
  const clean = source.trim().replace(/\s+/g, " ");
  if (!clean) {
    return "New chat";
  }
  return clean.slice(0, 60);
}

export default function KikoWorkspace({
  initialMode = "chat",
}: KikoWorkspaceProps) {
  const pathname = usePathname();
  const [mode, setMode] = React.useState<Mode>(initialMode);
  const [status, setStatus] = React.useState<
    "ready" | "submitted" | "streaming" | "error"
  >("ready");
  const [agentState, setAgentState] = React.useState<
    "idle" | "thinking" | "working" | "streaming" | "error"
  >("idle");
  const [agentActivity, setAgentActivity] = React.useState<string>("idle");
  const [selectedModel, setSelectedModel] = React.useState<string>(
    MODEL_OPTIONS[0]!.id,
  );
  const [lastTool, setLastTool] = React.useState<string | null>(null);
  const [agentLogs, setAgentLogs] = React.useState<string[]>([]);
  const [messages, setMessages] = React.useState<ChatMessage[]>([
    getInitialAssistantMessage(initialMode),
  ]);
  const [chatSessions, setChatSessions] = React.useState<ChatSession[]>([]);
  const [activeChatId, setActiveChatId] = React.useState<string | null>(null);
  const streamAbortRef = React.useRef<AbortController | null>(null);

  React.useEffect(() => {
    return () => {
      streamAbortRef.current?.abort();
    };
  }, []);

  const loadChatSessions = React.useCallback(async () => {
    const user = auth.currentUser;
    if (!user) {
      setChatSessions([]);
      return;
    }

    const db = getFirestore(auth.app);
    const sessionsRef = collection(db, "users", user.uid, "kikoChats");
    const sessionsQuery = query(sessionsRef, orderBy("updatedAt", "desc"), limit(40));
    const snapshots = await getDocs(sessionsQuery);

    const items: ChatSession[] = snapshots.docs.map((chatDoc) => {
      const data = chatDoc.data() as Record<string, unknown>;
      const updatedAt = data.updatedAt as { toMillis?: () => number } | undefined;
      return {
        id: chatDoc.id,
        title: String(data.title ?? "New chat"),
        updatedAt: updatedAt?.toMillis?.() ?? 0,
      };
    });

    setChatSessions(items);
  }, []);

  const startNewChat = React.useCallback(() => {
    setActiveChatId(null);
    setMessages([getInitialAssistantMessage(mode)]);
    setAgentLogs([]);
    setAgentActivity("idle");
    setLastTool(null);
    setAgentState("idle");
  }, [mode]);

  const openChatSession = React.useCallback(async (chatId: string) => {
    const user = auth.currentUser;
    if (!user) {
      return;
    }

    const db = getFirestore(auth.app);
    const messagesRef = collection(db, "users", user.uid, "kikoChats", chatId, "messages");
    const messagesQuery = query(messagesRef, orderBy("createdAt", "asc"), limit(200));
    const snapshots = await getDocs(messagesQuery);

    const loaded: ChatMessage[] = snapshots.docs.map((messageDoc) => {
      const data = messageDoc.data() as Record<string, unknown>;
      return {
        id: messageDoc.id,
        role: data.role === "user" ? "user" : "assistant",
        content: String(data.content ?? ""),
        action: "none",
      };
    });

    setActiveChatId(chatId);
    setMessages(loaded.length > 0 ? loaded : [getInitialAssistantMessage(mode)]);
    setAgentLogs([]);
    setAgentActivity("idle");
    setLastTool(null);
    setAgentState("idle");
  }, [mode]);

  const persistChatTurn = React.useCallback(
    async (userText: string, assistantText: string, chatIdHint?: string | null) => {
      const user = auth.currentUser;
      if (!user) {
        return;
      }

      const db = getFirestore(auth.app);
      const chatsRef = collection(db, "users", user.uid, "kikoChats");
      const chatId = chatIdHint || activeChatId;
      const chatRef = chatId ? doc(chatsRef, chatId) : doc(chatsRef);

      await setDoc(
        chatRef,
        {
          title: getChatTitle(userText),
          mode,
          updatedAt: serverTimestamp(),
          lastMessage: assistantText.slice(0, 180),
          ...(chatId ? {} : { createdAt: serverTimestamp() }),
        },
        { merge: true },
      );

      const chatMessagesRef = collection(chatRef, "messages");
      await addDoc(chatMessagesRef, {
        role: "user",
        content: userText,
        createdAt: serverTimestamp(),
      });
      await addDoc(chatMessagesRef, {
        role: "assistant",
        content: assistantText,
        createdAt: serverTimestamp(),
      });

      if (!chatId) {
        setActiveChatId(chatRef.id);
      }

      await loadChatSessions();
    },
    [activeChatId, loadChatSessions, mode],
  );

  React.useEffect(() => {
    void loadChatSessions();
  }, [loadChatSessions]);

  React.useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(() => {
      void loadChatSessions();
    });

    return () => unsubscribe();
  }, [loadChatSessions]);

  React.useEffect(() => {
    // Opening this screen starts a fresh live chat while history stays available in panel.
    startNewChat();
  }, [pathname, startNewChat]);

  const appendAgentLog = React.useCallback((entry: string) => {
    setAgentLogs((prev) => {
      if (prev[prev.length - 1] === entry) {
        return prev;
      }
      return [...prev.slice(-14), entry];
    });
  }, []);

  const handleSend = React.useCallback(
    async (payload: PromptInputMessage) => {
      if (status === "submitted" || status === "streaming") {
        return;
      }

      const trimmed = payload.text.trim();
      if (!trimmed) {
        return;
      }

      const extractedAttachmentData = await buildAttachmentExtractionBlock(
        payload.files as UploadLikeFile[],
      );

      const attachmentSummary =
        payload.files.length > 0
          ? `\n\nAttachments: ${payload.files
              .map((file) => file.filename || file.mediaType || "file")
              .join(", ")}`
          : "";

      const userMessage: ChatMessage = {
        id: nanoid(),
        role: "user",
        content: `${trimmed}${attachmentSummary}${extractedAttachmentData}`,
        action: "none",
      };

      const assistantId = nanoid();
      const history = messages.map((message) => ({
        role: message.role,
        content: message.content,
      }));
      let assistantFinalText = "";

      setMessages((prev) => [
        ...prev,
        userMessage,
        {
          id: assistantId,
          role: "assistant",
          content: "",
          action: mode === "agent" ? "thinking" : "streaming",
        },
      ]);

      setStatus("submitted");
      setLastTool(null);
      setAgentState(mode === "agent" ? "thinking" : "working");
      setAgentActivity("Preparing request...");
      setAgentLogs(["Preparing request..."]);

      const abortController = new AbortController();
      streamAbortRef.current = abortController;

      try {
        const idToken = await auth.currentUser?.getIdToken();
        const response = await fetch("/api/kiko/agent", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(idToken ? { Authorization: `Bearer ${idToken}` } : {}),
          },
          signal: abortController.signal,
          body: JSON.stringify({
            mode,
            model: selectedModel,
            message: `${trimmed}${attachmentSummary}${extractedAttachmentData}`,
            history,
          }),
        });

        if (!response.ok || !response.body) {
          throw new Error("Unable to start agent response");
        }

        setStatus("streaming");

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) {
            break;
          }

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";

          for (const line of lines) {
            const raw = line.trim();
            if (!raw) {
              continue;
            }

            let event: AgentStreamEvent;
            try {
              event = JSON.parse(raw) as AgentStreamEvent;
            } catch {
              continue;
            }

            if (event.type === "state") {
              setAgentState(event.state);
              const nextActivity =
                event.state === "thinking"
                  ? `Thinking${event.iteration ? ` (step ${event.iteration})` : "..."}`
                  : "Working...";
              setAgentActivity(nextActivity);
              appendAgentLog(nextActivity);
              setMessages((prev) =>
                prev.map((message) =>
                  message.id === assistantId
                    ? {
                        ...message,
                        action:
                          event.state === "thinking" ? "thinking" : "streaming",
                      }
                    : message,
                ),
              );
              continue;
            }

            if (event.type === "tool") {
              setLastTool(event.tool);
              setAgentState("working");
              setAgentActivity(`Running ${event.tool}`);
              appendAgentLog(`Running ${event.tool}`);
              continue;
            }

            if (event.type === "tool_result") {
              setAgentState("working");
              setAgentActivity(`Finished ${event.tool}`);
              appendAgentLog(`Finished ${event.tool}`);
              continue;
            }

            if (event.type === "chunk") {
              setAgentState("streaming");
              setAgentActivity("Streaming response...");
              assistantFinalText = event.text;
              setMessages((prev) =>
                prev.map((message) =>
                  message.id === assistantId
                    ? { ...message, content: event.text, action: "streaming" }
                    : message,
                ),
              );
              continue;
            }

            if (event.type === "done") {
              appendAgentLog("Done");
              continue;
            }

            if (event.type === "error") {
              setAgentState("error");
              setAgentActivity(`Error: ${event.message || "Unknown error"}`);
              appendAgentLog(`Error: ${event.message || "Unknown error"}`);
              assistantFinalText =
                assistantFinalText || `Agent error: ${event.message || "Unknown error"}`;
              setMessages((prev) =>
                prev.map((message) =>
                  message.id === assistantId
                    ? {
                        ...message,
                        content:
                          message.content ||
                          `Agent error: ${event.message || "Unknown error"}`,
                        action: "none",
                      }
                    : message,
                ),
              );
              setStatus("error");
            }
          }
        }
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Failed to process agent request";
        setMessages((prev) =>
          prev.map((entry) =>
            entry.id === assistantId
              ? { ...entry, content: `Agent error: ${message}`, action: "none" }
              : entry,
          ),
        );
        setStatus("error");
        setAgentState("error");
        setAgentActivity(`Error: ${message}`);
        appendAgentLog(`Error: ${message}`);
        assistantFinalText = `Agent error: ${message}`;
      } finally {
        const fallbackAssistantText = assistantFinalText || "No response generated.";
        setMessages((prev) =>
          prev.map((entry) =>
            entry.id === assistantId
              ? { ...entry, content: entry.content || fallbackAssistantText, action: "none" }
              : entry,
          ),
        );

        void persistChatTurn(
          userMessage.content,
          assistantFinalText || fallbackAssistantText,
          activeChatId,
        );

        setAgentState("idle");
        setAgentActivity("idle");
        appendAgentLog("idle");
        setStatus((current) => (current === "error" ? "error" : "ready"));
      }
    },
    [activeChatId, appendAgentLog, messages, mode, persistChatTurn, selectedModel, status],
  );

  const handleQuickPrompt = (prompt: string) => {
    void handleSend({ text: prompt, files: [] });
  };

  return (
    <div className="flex h-[calc(100vh-8rem)] min-h-130 flex-col rounded-2xl border border-outline bg-forground text-text">
      <header className="flex flex-wrap items-center justify-end gap-3 border-b border-outline px-3 py-3 sm:px-4">
        <div className="inline-flex rounded-xl border border-outline bg-secondary p-1">
          <button
            className={`inline-flex items-center gap-1 rounded-lg px-3 py-2 text-xs font-medium sm:text-sm ${
              mode === "chat" ? "bg-forground text-text" : "text-text-secondary"
            }`}
            onClick={() => setMode("chat")}
            type="button"
          >
            <MessageCircleIcon className="size-4" /> Chat
          </button>
          <button
            className={`inline-flex items-center gap-1 rounded-lg px-3 py-2 text-xs font-medium sm:text-sm ${
              mode === "agent"
                ? "bg-forground text-text"
                : "text-text-secondary"
            }`}
            onClick={() => setMode("agent")}
            type="button"
          >
            <BotIcon className="size-4" /> Agent
          </button>
        </div>
      </header>

      {mode === "chat" ? (
        <Conversation className="flex min-h-0 flex-1 flex-col">
          <ConversationContent className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-3 py-4 sm:px-4">
            {messages.map((message) => (
              <Message className="max-w-full" from={message.role} key={message.id}>
                <MessageContent className="max-w-full wrap-anywhere">
                  <MessageResponse className="[&_code]:wrap-break-word [&_pre]:max-w-full [&_pre]:overflow-x-auto whitespace-pre-wrap">
                    {message.content}
                  </MessageResponse>
                </MessageContent>
              </Message>
            ))}

            <Suggestions className="mt-2">
              {QUICK_PROMPTS.map((prompt) => (
                <Suggestion
                  key={prompt}
                  onClick={handleQuickPrompt}
                  suggestion={prompt}
                />
              ))}
            </Suggestions>
          </ConversationContent>
          <ConversationScrollButton />
        </Conversation>
      ) : (
        <div className="flex min-h-0 flex-1 p-3 sm:p-4">
          <div className="flex min-h-0 flex-1 flex-col rounded-xl border border-outline bg-secondary/25 p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <BotIcon className="size-4 text-text-secondary" />
                <p className="font-semibold text-sm">Kiko</p>
                <Badge variant="outline" className="font-mono text-[11px]">
                  {selectedModel.replace(/^ollama:/, "")}
                </Badge>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="secondary">{agentState}</Badge>
                <Badge variant="outline">{lastTool ?? "no tool"}</Badge>
              </div>
            </div>

            <div className="mt-3 flex min-h-0 flex-1 gap-3">
              <div className="hidden w-85 shrink-0 space-y-3 xl:block">
                <div>
                  <p className="mb-1 font-medium text-text-secondary text-xs">Tools</p>
                  <div className="rounded-lg border border-outline/70 bg-forground px-3 py-1">
                    <Accordion defaultValue={["firebase-read"]}>
                      {AGENT_TOOLS.map((tool) => (
                        <AccordionItem key={tool.id} value={tool.id}>
                          <AccordionTrigger className="py-2 text-sm">
                            {tool.title}
                          </AccordionTrigger>
                          <AccordionContent className="pb-2 text-text-secondary text-xs">
                            {tool.details}
                          </AccordionContent>
                        </AccordionItem>
                      ))}
                    </Accordion>
                  </div>
                </div>

                <div>
                  <div className="mb-1 flex items-center justify-between">
                    <p className="font-medium text-text-secondary text-xs">History</p>
                    <button
                      className="rounded-md border border-outline px-2 py-0.5 text-[11px] text-text-secondary hover:bg-secondary"
                      onClick={startNewChat}
                      type="button"
                    >
                      New chat
                    </button>
                  </div>
                  <ScrollArea className="h-36 rounded-lg border border-outline/70 bg-forground p-2">
                    <div className="space-y-1">
                      {chatSessions.length === 0 ? (
                        <p className="text-text-secondary text-xs">No history yet.</p>
                      ) : (
                        chatSessions.map((session) => (
                          <button
                            className={`block w-full rounded-md px-2 py-1 text-left text-xs transition-colors ${
                              activeChatId === session.id
                                ? "bg-secondary text-text"
                                : "text-text-secondary hover:bg-secondary/60"
                            }`}
                            key={session.id}
                            onClick={() => {
                              void openChatSession(session.id);
                            }}
                            type="button"
                          >
                            <p className="truncate font-medium">{session.title}</p>
                            <p className="text-[10px] opacity-70">
                              {session.updatedAt
                                ? new Date(session.updatedAt).toLocaleString()
                                : "recent"}
                            </p>
                          </button>
                        ))
                      )}
                    </div>
                  </ScrollArea>
                </div>
              </div>

              <div className="flex min-h-0 flex-1 flex-col space-y-3">
                <div className="flex min-h-0 flex-1 flex-col">
                  <p className="mb-1 font-medium text-text-secondary text-xs">Live Conversation</p>
                  <ScrollArea className="min-h-0 flex-1 overflow-hidden rounded-lg border border-outline/70 bg-forground p-2">
                    <div className="space-y-3">
                      {messages.map((message) => (
                        <Message className="max-w-full" from={message.role} key={message.id}>
                          <MessageContent className="max-w-full wrap-anywhere">
                            <MessageResponse className="[&_code]:wrap-break-word [&_pre]:max-w-full [&_pre]:overflow-x-auto whitespace-pre-wrap">
                              {message.content}
                            </MessageResponse>
                          </MessageContent>
                        </Message>
                      ))}
                    </div>
                  </ScrollArea>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="border-t border-outline p-3 sm:p-4">
        <PromptInput
          accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.txt,.csv,.xls,.xlsx"
          multiple
          onError={(error) => {
            showError(error.message);
          }}
          onSubmit={handleSend}
        >
          <PromptInputBody>
            <PromptInputAttachments>
              {(attachment) => (
                <PromptInputAttachment data={attachment} key={attachment.id} />
              )}
            </PromptInputAttachments>
            <PromptInputTextarea
              placeholder={
                mode === "agent"
                  ? "Describe the task for the agent..."
                  : "Type a message or attach media/files..."
              }
            />
          </PromptInputBody>

          <PromptInputFooter>
            <PromptInputTools>
              <PromptInputActionMenu>
                <PromptInputActionMenuTrigger />
                <PromptInputActionMenuContent>
                  <PromptInputActionAddAttachments />
                </PromptInputActionMenuContent>
              </PromptInputActionMenu>

              <PromptInputSelect
                onValueChange={(value) => setSelectedModel(String(value))}
                value={selectedModel}
              >
                <PromptInputSelectTrigger className="w-52.5">
                  <PromptInputSelectValue placeholder="Select model" />
                </PromptInputSelectTrigger>
                <PromptInputSelectContent>
                  {MODEL_OPTIONS.map((model) => (
                    <PromptInputSelectItem key={model.id} value={model.id}>
                      {model.label}
                    </PromptInputSelectItem>
                  ))}
                </PromptInputSelectContent>
              </PromptInputSelect>
            </PromptInputTools>
            <PromptInputSubmit status={status} />
          </PromptInputFooter>
        </PromptInput>
      </div>
    </div>
  );
}
