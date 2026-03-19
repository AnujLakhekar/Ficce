"use client"

import toast from "react-hot-toast"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  ArrowDownCircle,
  ArrowUpCircle,
  ChevronDown,
  Download,
  Landmark,
  SlidersHorizontal,
  Wallet,
} from "lucide-react"
import React from "react"

type TransactionRow = {
  id: string
  date: string
  merchant: string
  avatar: string
  category: string
  type: "Income" | "Expense"
  status: "Completed" | "Pending" | "Failed"
  amount: string
  account: string
}

const transactionRows: TransactionRow[] = [
  {
    id: "1",
    date: "Oct 12, 2026",
    merchant: "Jamie Smith",
    avatar: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=64&h=64&fit=crop",
    category: "Freelance",
    type: "Income",
    status: "Completed",
    amount: "$129.00",
    account: "Main Wallet",
  },
  {
    id: "2",
    date: "Oct 11, 2026",
    merchant: "Adobe Creative Cloud",
    avatar: "https://images.unsplash.com/photo-1629429407756-01cd3d7cfb38?w=64&h=64&fit=crop",
    category: "Software",
    type: "Expense",
    status: "Pending",
    amount: "$54.99",
    account: "Business Card",
  },
  {
    id: "3",
    date: "Oct 10, 2026",
    merchant: "Stripe Payout",
    avatar: "https://images.unsplash.com/photo-1556745757-8d76bdb6984b?w=64&h=64&fit=crop",
    category: "Payout",
    type: "Income",
    status: "Completed",
    amount: "$780.00",
    account: "Main Wallet",
  },
  {
    id: "4",
    date: "Oct 09, 2026",
    merchant: "Notion",
    avatar: "https://images.unsplash.com/photo-1611606063065-ee7946f0787a?w=64&h=64&fit=crop",
    category: "Subscription",
    type: "Expense",
    status: "Failed",
    amount: "$12.00",
    account: "Business Card",
  },
]

const summaryCards = [
  {
    title: "Total Income",
    amount: "$909.00",
    count: "2 Transactions",
    icon: ArrowUpCircle,
    gradient:
      "bg-[radial-gradient(circle_at_65%_15%,rgba(155,112,255,0.35)_0%,rgba(155,112,255,0)_35%),radial-gradient(circle_at_78%_25%,rgba(80,175,255,0.45)_0%,rgba(80,175,255,0)_42%),linear-gradient(180deg,#d8f0ff_0%,#f8fbff_65%)]",
  },
  {
    title: "Total Expense",
    amount: "$66.99",
    count: "2 Transactions",
    icon: ArrowDownCircle,
    gradient:
      "bg-[radial-gradient(circle_at_20%_25%,rgba(95,232,214,0.35)_0%,rgba(95,232,214,0)_40%),radial-gradient(circle_at_78%_22%,rgba(255,155,119,0.4)_0%,rgba(255,155,119,0)_42%),linear-gradient(180deg,#e4fffa_0%,#fff7f2_65%)]",
  },
  {
    title: "Current Balance",
    amount: "$842.01",
    count: "Main Wallet",
    icon: Wallet,
    gradient:
      "bg-[radial-gradient(circle_at_22%_22%,rgba(233,118,210,0.35)_0%,rgba(233,118,210,0)_38%),radial-gradient(circle_at_68%_26%,rgba(255,204,115,0.4)_0%,rgba(255,204,115,0)_40%),linear-gradient(180deg,#f9eeff_0%,#fffdf5_65%)]",
  },
] as const

const statusClassMap: Record<TransactionRow["status"], string> = {
  Completed: "bg-hover text-(--color--hover-text-content)",
  Pending: "bg-secondary text-text",
  Failed: "bg-secondary text-text",
}

const typeClassMap: Record<TransactionRow["type"], string> = {
  Income: "text-text",
  Expense: "text-text",
}

export default function Page() {
  const [typeFilter, setTypeFilter] = React.useState<"all" | "Income" | "Expense">("all")
  const [statusFilter, setStatusFilter] = React.useState<
    "all" | "Completed" | "Pending" | "Failed"
  >("all")

  const filteredRows = transactionRows.filter((row) => {
    const typeMatch = typeFilter === "all" || row.type === typeFilter
    const statusMatch = statusFilter === "all" || row.status === statusFilter
    return typeMatch && statusMatch
  })

  const handleResetFilters = () => {
    setTypeFilter("all")
    setStatusFilter("all")
    toast.success("Filters reset")
  }

  const handleExport = () => {
    if (filteredRows.length === 0) {
      toast.error("No transactions to export")
      return
    }

    const headers = [
      "Date",
      "Merchant",
      "Category",
      "Type",
      "Status",
      "Amount",
      "Account",
    ]

    const rows = filteredRows.map((row) => [
      row.date,
      row.merchant,
      row.category,
      row.type,
      row.status,
      row.amount,
      row.account,
    ])

    const csv = [headers, ...rows]
      .map((r) =>
        r
          .map((value) => `"${String(value).replace(/"/g, '""')}"`)
          .join(","),
      )
      .join("\n")

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    link.setAttribute("download", `transactions-${Date.now()}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)

    toast.success("Transactions exported")
  }

  return (
    <div className="space-y-4 text-text">
      <section className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {summaryCards.map((card) => {
          const Icon = card.icon

          return (
            <div
              key={card.title}
              className={`rounded-2xl border border-outline p-4 ${card.gradient}`}
            >
              <div className="mb-8 inline-flex size-8 items-center justify-center rounded-full border border-outline bg-forground/70">
                <Icon className="size-4 text-text" />
              </div>

              <p className="text-5xl font-semibold tracking-tight text-text">{card.amount}</p>
              <div className="mt-2 flex items-center gap-2 text-sm text-text-secondary">
                <span className="text-text font-medium">{card.title}</span>
                <span>{card.count}</span>
              </div>
            </div>
          )
        })}
      </section>

      <section className="rounded-2xl border border-outline bg-forground">
        <div className="border-b border-outline px-5 py-4">
          <h2 className="text-2xl font-semibold text-text">All Transactions</h2>
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2 border-b border-outline px-4 py-3">
          <button
            className="rounded-xl bg-text px-6 py-2 text-sm font-medium text-forground"
            onClick={handleResetFilters}
            type="button"
          >
            All
          </button>

          <DropdownMenu>
            <DropdownMenuTrigger className="inline-flex items-center gap-1 rounded-xl border border-outline bg-forground px-4 py-2 text-sm text-text hover:bg-secondary">
              {typeFilter === "all" ? "Type" : typeFilter}
              <ChevronDown className="size-4 text-text-secondary" />
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              className="min-w-40 bg-forground border border-outline text-text"
            >
              <DropdownMenuItem onClick={() => setTypeFilter("all")}>All Types</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setTypeFilter("Income")}>Income</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setTypeFilter("Expense")}>Expense</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <DropdownMenu>
            <DropdownMenuTrigger className="inline-flex items-center gap-2 rounded-xl border border-outline bg-forground px-4 py-2 text-sm text-text hover:bg-secondary">
              <SlidersHorizontal className="size-4 text-text-secondary" />
              {statusFilter === "all" ? "Add Filters" : statusFilter}
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              className="min-w-44 bg-forground border border-outline text-text"
            >
              <DropdownMenuItem onClick={() => setStatusFilter("all")}>All Statuses</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setStatusFilter("Completed")}>Completed</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setStatusFilter("Pending")}>Pending</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setStatusFilter("Failed")}>Failed</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <button
            className="inline-flex items-center gap-2 rounded-xl border border-outline bg-forground px-4 py-2 text-sm text-text hover:bg-secondary"
            onClick={handleExport}
            type="button"
          >
            <Download className="size-4 text-text-secondary" />
            Export All
          </button>
        </div>

        <Table className="bg-forground">
          <TableHeader className="bg-secondary/60">
            <TableRow className="border-outline hover:bg-secondary/60">
              <TableHead className="w-8">
                <input className="size-4 rounded border border-outline" type="checkbox" />
              </TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Merchant</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Amount</TableHead>
              <TableHead>Account</TableHead>
            </TableRow>
          </TableHeader>

          <TableBody>
            {filteredRows.map((row) => (
              <TableRow key={row.id} className="border-outline hover:bg-secondary/50">
                <TableCell>
                  <input className="size-4 rounded border border-outline" type="checkbox" />
                </TableCell>
                <TableCell className="font-medium text-text">{row.date}</TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <img
                      alt={row.merchant}
                      className="size-8 rounded-full object-cover"
                      src={row.avatar}
                    />
                    <span className="text-text">{row.merchant}</span>
                  </div>
                </TableCell>
                <TableCell className="text-text">{row.category}</TableCell>
                <TableCell>
                  <span className={`font-medium ${typeClassMap[row.type]}`}>{row.type}</span>
                </TableCell>
                <TableCell>
                  <span
                    className={`inline-flex rounded-full border border-outline px-3 py-1 text-sm font-medium ${statusClassMap[row.status]}`}
                  >
                    {row.status}
                  </span>
                </TableCell>
                <TableCell className="font-semibold text-text">{row.amount}</TableCell>
                <TableCell>
                  <span className="inline-flex items-center gap-1 text-text">
                    <Landmark className="size-4 text-text-secondary" />
                    {row.account}
                  </span>
                </TableCell>
              </TableRow>
            ))}

            {filteredRows.length === 0 && (
              <TableRow className="border-outline hover:bg-transparent">
                <TableCell className="py-10 text-center text-text-secondary" colSpan={8}>
                  No transactions found for selected filters.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </section>
    </div>
  )
}
