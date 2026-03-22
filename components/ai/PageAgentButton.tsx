"use client"

import React, { useState, useRef, useEffect } from "react"
import { Sparkles, X, ChevronDown } from "lucide-react"
import { getPageToolConfig } from "@/lib/page-tools-config"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"

type PageAgentButtonProps = {
  onToolExecute?: (tool: string, input: Record<string, unknown>) => void
  className?: string
}

export function PageAgentButton({ onToolExecute, className }: PageAgentButtonProps) {
  const pathname = usePathname()
  const [isOpen, setIsOpen] = useState(false)
  const [alignRight, setAlignRight] = useState(true)
  const [isExecuting, setIsExecuting] = useState(false)
  const [lastResult, setLastResult] = useState<string | null>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)

  const pageConfig = getPageToolConfig(pathname)

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside)
      return () => document.removeEventListener("mousedown", handleClickOutside)
    }
  }, [isOpen])

  useEffect(() => {
    if (!isOpen || !dropdownRef.current) {
      return
    }

    const panelWidth = 288
    const viewportPadding = 16
    const rect = dropdownRef.current.getBoundingClientRect()
    const spaceOnRight = window.innerWidth - rect.left
    const canOpenToRight = spaceOnRight >= panelWidth + viewportPadding

    setAlignRight(!canOpenToRight)
  }, [isOpen])

  const handleSuggestedAction = async (intent: string) => {
    setIsExecuting(true)
    try {
      // Call agent API with the intent
      const response = await fetch("/api/kiko/agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "agent",
          message: intent,
        }),
      })

      // Stream and collect response
      if (response.body) {
        const reader = response.body.getReader()
        const decoder = new TextDecoder()
        let fullText = ""

        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          fullText += decoder.decode(value, { stream: true })
        }

        setLastResult(fullText)

        if (onToolExecute) {
          onToolExecute("executed_intent", { message: intent, result: fullText })
        }
      }
    } catch (error) {
      console.error("Failed to execute action:", error)
    } finally {
      setIsExecuting(false)
    }
  }

  return (
    <div ref={dropdownRef} className={cn("relative inline-block", className)}>
      {/* Agent Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-linear-to-r from-blue-50 via-blue-100 to-blue-200 hover:from-blue-100 hover:via-blue-150 hover:to-blue-300 border border-blue-200 hover:border-blue-400 shadow-sm hover:shadow-md transition-all duration-200 group"
        title="Agent Tools"
      >
        <Sparkles className="w-4 h-4 text-blue-600 group-hover:text-blue-700 animate-spin group-hover:animate-pulse" />
        <span className="text-sm font-medium text-gray-700">Agent</span>
        <ChevronDown
          className={cn("w-4 h-4 text-blue-600 transition-all duration-300", {
            "rotate-180 text-blue-700": isOpen,
          })}
        />
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div
          className={cn(
            "absolute top-full mt-3 z-40 w-72 max-w-[calc(100vw-2rem)] bg-white rounded-lg border border-blue-200 shadow-2xl overflow-hidden animate-in fade-in slide-in-from-top-2 duration-300",
            alignRight ? "right-0" : "left-0",
          )}
        >
          {/* Header */}
          <div className="px-4 py-3 border-b border-blue-100 bg-linear-to-r from-blue-50 to-blue-100">
            <div className="flex items-center justify-between mb-1">
              <p className="text-xs font-semibold text-blue-700 uppercase tracking-wide">
                Page: {pageConfig.pageTitle}
              </p>
              <button
                onClick={() => setIsOpen(false)}
                className="p-1 hover:bg-blue-200 rounded transition-colors"
              >
                <X className="w-3 h-3 text-blue-600" />
              </button>
            </div>
            <p className="text-xs text-blue-600">
              {pageConfig.suggestedIntents?.length || 0} quick actions available
            </p>
          </div>

          {/* Available Tools */}
          <div className="px-4 py-3 border-b border-blue-100">
            <p className="text-xs font-semibold text-blue-700 mb-2">Tools</p>
            <div className="flex flex-wrap gap-1">
              {pageConfig.tools.slice(0, 4).map((tool) => (
                <span
                  key={tool}
                  className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded border border-blue-200 font-medium"
                >
                  {tool.replace("firebase_", "")}
                </span>
              ))}
              {pageConfig.tools.length > 4 && (
                <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded border border-blue-200 font-medium">
                  +{pageConfig.tools.length - 4} more
                </span>
              )}
            </div>
          </div>

          {/* Suggested Actions */}
          {pageConfig.suggestedIntents && pageConfig.suggestedIntents.length > 0 && (
            <div className="px-4 py-3 border-b border-blue-100">
              <p className="text-xs font-semibold text-blue-700 mb-2">Quick Actions</p>
              <div className="space-y-1">
                {pageConfig.suggestedIntents.map((intent, idx) => (
                  <button
                    key={idx}
                    onClick={() => {
                      handleSuggestedAction(intent)
                      setIsOpen(false)
                    }}
                    disabled={isExecuting}
                    className="w-full text-left text-xs p-2.5 rounded bg-linear-to-r from-blue-50 to-blue-100 hover:from-blue-100 hover:to-blue-150 text-blue-700 border border-blue-200 hover:border-blue-300 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
                  >
                    {isExecuting ? "Executing..." : intent}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Last Result Preview */}
          {lastResult && (
            <div className="px-4 py-3 border-t border-green-200 bg-green-50">
              <p className="text-xs font-semibold text-green-700 mb-2">✓ Result</p>
              <div className="max-h-32 overflow-y-auto">
                <pre className="text-xs text-green-700 whitespace-pre-wrap wrap-break-word font-mono bg-white rounded p-2 border border-green-200">
                  {String(lastResult).substring(0, 200)}
                  {String(lastResult).length > 200 ? "..." : ""}
                </pre>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
