/**
 * Page-specific AI tool configuration
 * Maps page routes to available tools
 */

export type PageToolConfig = {
  route: string
  pageTitle: string
  tools: string[]
  suggestedIntents?: string[]
}

export const PAGE_TOOLS_CONFIG: Record<string, PageToolConfig> = {
  transactions: {
    route: "/dashboard/transactions",
    pageTitle: "Transactions",
    tools: [
      "firebase_query_collection",
      "firebase_aggregate_collection",
      "firebase_export_collection",
      "firebase_create_transaction",
      "firebase_delete_records_by_match",
    ],
    suggestedIntents: [
      "Show my transactions grouped by category",
      "Export all expenses as CSV",
      "Delete transaction named X",
      "Create new income transaction",
    ],
  },

  tasks: {
    route: "/dashboard/tasks",
    pageTitle: "Tasks",
    tools: [
      "firebase_query_collection",
      "firebase_aggregate_collection",
      "firebase_export_collection",
      "firebase_create_task",
      "firebase_delete_records_by_match",
    ],
    suggestedIntents: [
      "Show all pending tasks",
      "Export tasks as markdown table",
      "Delete completed tasks",
      "Create new task",
    ],
  },

  invoices: {
    route: "/dashboard/invoices",
    pageTitle: "Invoices",
    tools: [
      "firebase_query_collection",
      "firebase_aggregate_collection",
      "firebase_export_collection",
      "firebase_create_invoice",
      "firebase_delete_records_by_match",
    ],
    suggestedIntents: [
      "Show unpaid invoices",
      "Export invoices as JSON",
      "Delete draft invoices",
      "Create new invoice",
    ],
  },

  reimbursements: {
    route: "/dashboard/reimbursements",
    pageTitle: "Reimbursements",
    tools: [
      "firebase_query_collection",
      "firebase_aggregate_collection",
      "firebase_export_collection",
      "firebase_create_reimbursement",
      "firebase_delete_records_by_match",
    ],
    suggestedIntents: [
      "Show pending reimbursements",
      "Export reimbursements as JSONL",
      "Delete reimbursement by name",
      "Create new reimbursement",
    ],
  },

  default: {
    route: "/dashboard",
    pageTitle: "Dashboard",
    tools: [
      "firebase_query_collection",
      "firebase_aggregate_collection",
      "firebase_export_collection",
      "firebase_user_transactions_stats",
    ],
    suggestedIntents: ["Show my account overview", "Export all data as JSON"],
  },
}

/**
 * Get tool config for current page
 */
export function getPageToolConfig(pathname?: string): PageToolConfig {
  if (!pathname) {
    return PAGE_TOOLS_CONFIG.default
  }

  // Extract page key from pathname
  const match = pathname.match(/\/dashboard\/([a-z-]+)/)
  const pageKey = match?.[1]?.replace(/-/g, "") || "default"

  return PAGE_TOOLS_CONFIG[pageKey] || PAGE_TOOLS_CONFIG.default
}
