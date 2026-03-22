"use client"

import React, { useState, useCallback, useRef, useEffect } from "react"
import { ChevronUp, MessageSquare, Sparkles, X } from "lucide-react"
import { getPageToolConfig } from "@/lib/page-tools-config"
import { usePathname } from "next/navigation"
import { Button } from "../ui/button"
import { ScrollArea } from "../ui/scroll-area"
import { Separator } from "../ui/separator"
import { useKiko } from "@/providers/KikoProvider"

type GlobalAiPanelProps = {
  onToolCall?: (tool: string, input: Record<string, unknown>) => void
}

export function GlobalAiPanel({ onToolCall }: GlobalAiPanelProps) {
  const pathname = usePathname()
  const [isExpanded, setIsExpanded] = useState(false)
  const [isCollapsed, setIsCollapsed] = useState(true) // Collapsed to bottom by default
  const panelRef = useRef<HTMLDivElement>(null)
  const { openKiko } = useKiko()

  const pageConfig = getPageToolConfig(pathname)

  // Auto-collapse after 10 seconds of no interaction
  const autoCollapseRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const resetAutoCollapse = useCallback(() => {
    if (autoCollapseRef.current) clearTimeout(autoCollapseRef.current)
    autoCollapseRef.current = setTimeout(() => {
      setIsCollapsed(true)
    }, 10000)
  }, [])

  useEffect(() => {
    if (isExpanded) {
      resetAutoCollapse()
    }
    return () => {
      if (autoCollapseRef.current) clearTimeout(autoCollapseRef.current)
    }
  }, [isExpanded, resetAutoCollapse])

  const handleToggle = () => {
    setIsCollapsed(!isCollapsed)
    if (isCollapsed) {
      resetAutoCollapse()
    }
  }

  const handleSuggestedIntent = (intent: string) => {
    // Emit event or callback to parent to handle the intent
    if (onToolCall) {
      onToolCall("inferred_intent", { message: intent })
    }
    // Also open the main Kiko workspace
    openKiko()
  }

  if (isCollapsed) {
    return (
      <div className="fixed bottom-4 right-4 z-50">
        <Button
          onClick={handleToggle}
          size="lg"
          className="rounded-full shadow-lg hover:shadow-xl transition-all duration-200 group"
          title="Open AI Panel"
        >
          <Sparkles className="w-5 h-5 mr-2 group-hover:rotate-12 transition-transform" />
          AI Panel
        </Button>
      </div>
    )
  }

  return (
    <div
      ref={panelRef}
      className="fixed bottom-4 right-4 z-50 w-96 max-h-96 bg-white rounded-lg shadow-2xl border border-gray-200 flex flex-col overflow-hidden animate-in slide-in-from-bottom-2 duration-300"
    >
      {/* Header */}
      <div className="bg-linear-to-r from-blue-600 to-blue-700 text-white px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <MessageSquare className="w-4 h-4" />
          <span className="font-semibold text-sm">AI Assistant</span>
        </div>
        <button
          onClick={handleToggle}
          className="p-1 hover:bg-blue-500 rounded transition-colors"
          title="Collapse panel"
        >
          <ChevronUp className="w-4 h-4" />
        </button>
        <button
          onClick={() => setIsCollapsed(true)}
          className="p-1 hover:bg-blue-500 rounded transition-colors"
          title="Close panel"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Content */}
      <ScrollArea className="flex-1">
        <div className="p-4 space-y-4">
          {/* Page Context */}
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
              Page: {pageConfig.pageTitle}
            </p>
            <p className="text-xs text-gray-600">
              This panel adapts to your current page and shows relevant tools & suggestions.
            </p>
          </div>

          <Separator />

          {/* Available Tools */}
          <div>
            <p className="text-xs font-semibold text-gray-700 mb-2 flex items-center gap-1">
              <Sparkles className="w-3 h-3" />
              Available Tools ({pageConfig.tools.length})
            </p>
            <div className="flex flex-wrap gap-1">
              {pageConfig.tools.map((tool) => (
                <span
                  key={tool}
                  className="text-xs bg-blue-50 text-blue-700 px-2 py-1 rounded-full border border-blue-200"
                >
                  {tool.replace("firebase_", "")}
                </span>
              ))}
            </div>
          </div>

          <Separator />

          {/* Suggested Intents */}
          {pageConfig.suggestedIntents && pageConfig.suggestedIntents.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-gray-700 mb-2">Quick Suggestions</p>
              <div className="space-y-2">
                {pageConfig.suggestedIntents.map((intent, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleSuggestedIntent(intent)}
                    className="w-full text-left text-xs p-2 rounded bg-gray-50 hover:bg-blue-50 hover:text-blue-700 border border-gray-200 hover:border-blue-300 transition-colors"
                  >
                    {intent}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Footer */}
      <div className="bg-gray-50 px-4 py-2 border-t text-xs text-gray-500">
        Chat or use suggestions above
      </div>
    </div>
  )
}
