# Global AI Panel Architecture

## Overview
A globally accessible AI panel that appears across all dashboard pages with **page-specific tools and suggestions**. The panel shows different capabilities depending on which page you're on.

---

## Components & Files Created

### 1. **Page Tools Configuration** — `lib/page-tools-config.ts`
Defines which tools are available per page:

```typescript
// transactions page gets these tools:
- firebase_query_collection (filter transactions)
- firebase_aggregate_collection (sum by category)
- firebase_export_collection (export format: CSV/JSON)
- firebase_create_transaction
- firebase_delete_records_by_match

// tasks page gets these tools:
- firebase_query_collection
- firebase_aggregate_collection  
- firebase_export_collection
- firebase_create_task
- firebase_delete_records_by_match

// invoices, reimbursements, etc. each have their own set
```

**Usage:**
```typescript
const pageConfig = getPageToolConfig(pathname)
// Returns: { route, pageTitle, tools[], suggestedIntents[] }
```

---

### 2. **Global AI Panel Component** — `components/ai/GlobalAiPanel.tsx`
Floating panel in bottom-right corner that:
- ✅ **Collapses to a button** when not in use (auto-collapses after 10s)
- ✅ **Expands to show page context** when clicked
- ✅ **Displays available tools** for current page
- ✅ **Shows suggested intents** (pre-written prompts like "Export as CSV")
- ✅ **Opens main Kiko workspace** when suggestions clicked

**Key Features:**
- Auto-detects current page via `usePathname()`
- Loads page-specific tools dynamically
- One-click access to common tasks

---

### 3. **Kiko Provider** — `providers/KikoProvider.tsx`
Context wrapper that provides:
- Global state for opening/closing the main AI workspace
- Full-screen modal for detailed interactions
- Access via `useKiko()` hook anywhere

**Usage:**
```typescript
const { openKiko, closeKiko, isOpen } = useKiko()
openKiko() // Opens full-screen AI workspace
```

---

### 4. **Dashboard Layout Integration** — `app/dashboard/layout.tsx`
Wraps dashboard with providers:

```typescript
<AuthGuard>
  <KikoProvider>
    <LayoutGrid>{children}</LayoutGrid>
    <GlobalAiPanel />  {/* Floating panel on every page */}
  </KikoProvider>
</AuthGuard>
```

---

## User Interaction Flow

### Typical Usage:
1. User navigates to `/dashboard/transactions`
2. **GlobalAiPanel button** appears in bottom-right corner
3. User clicks button → Panel expands
4. Panel shows:
   - Current page: "Transactions"
   - Available tools: query, aggregate, export, create, delete
   - Suggested intents: "Show my transactions grouped by category", "Export all expenses as CSV"
5. User clicks suggested intent → **Full Kiko workspace opens** in modal
6. User can chat or let AI execute the inferred intent
7. Panel auto-collapses after 10 seconds of no interaction

---

## How Export Intent Detection Works (From Previous Phase)

```typescript
inferExportIntentFromMessage("export my transactions as CSV")
// Returns:
{
  tool: "firebase_export_collection",
  input: {
    collection: "transactions",
    format: "csv",
    limit: 200,
    orderBy: "createdAt",
    direction: "desc"
  }
}
```

The engine detects:
- **Format** from keywords: "csv", "json", "markdown", "jsonl"
- **Collection** from context: "transaction", "task", "invoice", "reimbursement"
- **Fields & sorting** from natural language: "order by date", "limit 50"

---

## Page-Specific Examples

### Transactions Page
**Suggested Intents:**
- "Show my transactions grouped by category"
- "Export all expenses as CSV"
- "Delete transaction named X"

**Available Tools:**
- Query: Filter by date, amount, merchant
- Aggregate: Sum by category, count by type
- Export: JSON/CSV/Markdown
- Create: Add new transaction
- Delete: Remove by title

### Tasks Page
**Suggested Intents:**
- "Show all pending tasks"
- "Export tasks as markdown table"
- "Delete completed tasks"
- "Create new task"

**Available Tools:** Same pattern, scoped to `tasks` collection

---

## Architecture Benefits

| Feature | Benefit |
|---------|---------|
| **Page-Aware** | Different tools per page — no clutter |
| **Always Accessible** | Floating button visible everywhere |
| **Low-Friction** | One click to open, suggestions pre-loaded |
| **Scalable** | Just add to `PAGE_TOOLS_CONFIG` to add new pages |
| **Intent-Driven** | "Export as CSV" → Agent runs export automatically |

---

## Files Changed
- ✅ Created `lib/page-tools-config.ts` (80 lines)
- ✅ Created `components/ai/GlobalAiPanel.tsx` (140 lines)
- ✅ Created `providers/KikoProvider.tsx` (60 lines)
- ✅ Updated `app/dashboard/layout.tsx` (wrapped with KikoProvider)

No breaking changes. All files compile without errors.
