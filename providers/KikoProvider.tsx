/**
 * KikoWorkspace Context Provider
 * Provides agent/AI functionality across all pages globally
 */

"use client"

import React, { createContext, useContext, useState, useCallback } from "react"
import KikoWorkspace from "@/components/kiko/KikoWorkspace"

type KikoContextType = {
  isOpen: boolean
  openKiko: () => void
  closeKiko: () => void
  sendMessage: (message: string) => void
}

const KikoContext = createContext<KikoContextType | undefined>(undefined)

export function KikoProvider({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false)
  const [workspaceKey, setWorkspaceKey] = useState(0)

  const openKiko = useCallback(() => {
    setIsOpen(true)
  }, [])

  const closeKiko = useCallback(() => {
    setIsOpen(false)
  }, [])

  const sendMessage = useCallback((message: string) => {
    openKiko()
    // Message will be passed via ref or state
  }, [openKiko])

  return (
    <KikoContext.Provider value={{ isOpen, openKiko, closeKiko, sendMessage }}>
      {children}
      {isOpen && (
        <div className="fixed inset-0 z-40 bg-black/50 dark:bg-black/80" onClick={closeKiko} />
      )}
      {isOpen && (
        <div className="fixed inset-4 z-50 rounded-lg overflow-hidden shadow-2xl">
          <KikoWorkspace initialMode="agent" />
        </div>
      )}
    </KikoContext.Provider>
  )
}

export function useKiko() {
  const context = useContext(KikoContext)
  if (!context) {
    throw new Error("useKiko must be used within KikoProvider")
  }
  return context
}
