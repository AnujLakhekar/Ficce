# Page Agent Button - Integration Guide

## Overview
The **PageAgentButton** is a per-page AI assistant button that matches your app's UI theme. It appears in page headers and allows direct tool execution without modal popups.

## Features
✅ Matches your app's light theme  
✅ Per-page specific tools and suggestions  
✅ Direct tool execution (no full-screen modal)  
✅ Shows result preview inline  
✅ Auto-closes dropdown on outside click  

---

## Quick Integration

### Step 1: Import the Button
```typescript
import { PageAgentButton } from "@/components/ai/PageAgentButton"
```

### Step 2: Add to Page Header
```tsx
<div className="flex items-center justify-between">
  <h2 className="text-lg font-semibold">Page Title</h2>
  <PageAgentButton />
</div>
```

That's it! The button auto-detects your page and loads relevant tools.

---

## Example: Transactions Page

**File:** `app/dashboard/transactions/page.tsx`

```tsx
<section className="rounded-2xl border border-outline bg-forground">
  <div className="border-b border-outline px-3 sm:px-5 py-3 sm:py-4 flex items-center justify-between">
    <h2 className="text-lg sm:text-2xl font-semibold text-text">
      All Transactions
    </h2>
    <PageAgentButton />  {/* ← Add here */}
  </div>
  {/* Rest of page */}
</section>
```

---

## How It Works

### 1. Button Click
User clicks **Agent** button

### 2. Dropdown Opens
Shows:
- Current page name (e.g., "Page: Transactions")
- Available tools for this page
- Quick action suggestions

### 3. Execute Suggestion
User clicks suggestion → Agent API called → Result displayed inline

### 4. Direct Data Display
Result preview shows at bottom of dropdown (max 200 chars)

---

## Page-Specific Tools/Suggestions

Tools are defined in `lib/page-tools-config.ts`:

```typescript
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
  // ... other pages
}
```

To add suggestions for a new page, just **add an entry to `PAGE_TOOLS_CONFIG`**.

---

## Styling

The button matches your theme:
- **Background**: White (`bg-white`)
- **Border**: Light gray (`border-gray-200`)
- **Text**: Dark gray (`text-gray-700`)
- **Hover**: Light blue background (`hover:bg-blue-50`)
- **Icon**: Sparkles (lucide-react)

---

## API Response Handling

When user clicks a suggestion:

1. **Message sent to:** `/api/kiko/agent`
2. **Intent inference:** Agent detects tool from natural language
3. **Tool execution:** Firebase operation runs (query, export, etc.)
4. **Result returned:** JSON response shown in preview

Example flow:
```
"Export all expenses as CSV"
    ↓
inferExportIntentFromMessage("Export all expenses as CSV")
    ↓
firebase_export_collection({collection: "transactions", format: "csv"})
    ↓
Display: "Query executed: 150 records exported..."
```

---

## Adding to More Pages

1. **Add to tasks page:**
   ```tsx
   <PageAgentButton />
   ```

2. **Add to invoices page:**
   ```tsx
   <PageAgentButton />
   ```

3. The tool config automatically adapts per page based on `pathname`

---

## Component Props

```typescript
type PageAgentButtonProps = {
  onToolExecute?: (tool: string, input: Record<string, unknown>) => void
  className?: string
}
```

### `onToolExecute` (Optional)
Callback when a tool executes. Use to refresh data on your page after tool runs:

```tsx
<PageAgentButton 
  onToolExecute={(tool, result) => {
    if (tool === "executed_intent") {
      // Refresh your data
      loadTransactions()
    }
  }}
/>
```

### `className` (Optional)
Add custom wrapper styles.

---

## Files Changed

| File | Purpose |
|------|---------|
| `components/ai/PageAgentButton.tsx` | New button component |
| `app/dashboard/transactions/page.tsx` | Example integration |
| `app/dashboard/layout.tsx` | Removed global panel |
| `lib/page-tools-config.ts` | Tool/page mapping |

---

## Result Preview

When a tool executes:
- Preview shows first 200 characters of result
- Clickable suggestions don't block page interaction
- Dropdown closes after selection
- User can click button again to see new results

---

## Notes

- Button auto-detects page via `usePathname()`
- No authentication required (uses signed-in user context)
- All tool intents handled via `inferExportIntentFromMessage`, etc.
- Theme automatically matches your app's colors
