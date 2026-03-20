"use client";

import React from "react";
import { nanoid } from "nanoid";
import { BotIcon, MessageCircleIcon, SparklesIcon } from "lucide-react";
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
  PromptInputSubmit,
  PromptInputTextarea,
  PromptInputTools,
  type PromptInputMessage,
} from "@/components/ai/prompt-input";
import { Suggestion, Suggestions } from "@/components/ai/suggestion";

type Mode = "chat" | "agent";

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  action: "none" | "thinking" | "streaming";
};

type KikoWorkspaceProps = {
  initialMode?: Mode;
};

const QUICK_PROMPTS = [
  "Summarize today’s transactions",
  "Generate pending task checklist",
  "Draft invoice follow-up",
  "Find spending anomalies",
];

export default function KikoWorkspace({
  initialMode = "chat",
}: KikoWorkspaceProps) {
  const [mode, setMode] = React.useState<Mode>(initialMode);
  const [status, setStatus] = React.useState<"ready" | "streaming">("ready");
  const [messages, setMessages] = React.useState<ChatMessage[]>([
    {
      id: nanoid(),
      role: "assistant",
      content:
        initialMode === "agent"
          ? "Agent mode enabled. Share a task and I will return an action plan with steps."
          : "Chat mode enabled. Ask anything and attach media/files if needed.",
      action: "none",
    },
  ]);

  const handleSend = React.useCallback(
    async (payload: PromptInputMessage) => {
      const trimmed = payload.text.trim();
      if (!trimmed) {
        return;
      }

      const attachmentSummary =
        payload.files.length > 0
          ? `\n\nAttachments: ${payload.files
              .map((file) => file.filename || file.mediaType || "file")
              .join(", ")}`
          : "";

      const userMessage: ChatMessage = {
        id: nanoid(),
        role: "user",
        content: `${trimmed}${attachmentSummary}`,
        action: "none",
      };

      const assistantId = nanoid();

      setMessages((prev) => [
        ...prev,
        userMessage,
        { id: assistantId, role: "assistant", content: "", action: "none" },
      ]);

      setStatus("streaming");

      const response =
        mode === "agent"
          ? [
              "Agent Work Plan:",
              "1. Understand your objective and constraints.",
              "2. Break task into executable steps.",
              "3. Validate dependencies, risks, and outputs.",
              payload.files.length > 0
                ? `4. I also processed ${payload.files.length} attached media/file item(s).`
                : "4. No attachments detected for this run.",
              "5. Return recommended execution sequence.",
            ].join("\n")
          : `Chat Response:\nI understood: "${trimmed}".${payload.files.length > 0 ? `\nI can also reference your ${payload.files.length} attachment(s) in follow-up steps.` : ""}`;

      let current = "";
      for (const token of response.split(" ")) {
        current += `${token} `;
        setMessages((prev) =>
          prev.map((message) =>
            message.id === assistantId
              ? { ...message, content: current.trim() }
              : message,
          ),
        );
        await new Promise((resolve) => setTimeout(resolve, 20));
      }

      setStatus("ready");
    },
    [mode],
  );

  const handleQuickPrompt = (prompt: string) => {
    void handleSend({ text: prompt, files: [] });
  };

  return (
    <div className="flex h-[calc(100vh-8rem)] min-h-130 flex-col rounded-2xl border border-outline bg-forground text-text">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-outline px-3 py-3 sm:px-4">
        <div>
          <h1 className="text-lg font-semibold sm:text-xl">KIKO Workspace</h1>
          <p className="text-xs text-text-secondary sm:text-sm">
            Unified AI workspace for normal chat and agent-style task execution.
          </p>
        </div>

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

      {mode === "agent" && (
        <div className="flex gap-2 border-b border-outline bg-secondary/50 text-xs text-text-secondary sm:px-4 sm:text-sm">
          <span className="inline-flex items-center gap-1 font-medium text-text">
            <SparklesIcon className="size-4" /> Agent mode:
          </span>

        </div>
      )}

      <Conversation className="flex min-h-0 flex-1 flex-col">
        <ConversationContent className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-3 py-4 sm:px-4">
          {messages.map((message) => (
            <Message from={message.role} key={message.id}>
              <MessageContent>
                <MessageResponse>{message.content}</MessageResponse>
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

      <div className="border-t border-outline p-3 sm:p-4">
        <PromptInput
          accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.txt"
          multiple
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
            </PromptInputTools>
            <PromptInputSubmit status={status} />
          </PromptInputFooter>
        </PromptInput>
      </div>
    </div>
  );
}
