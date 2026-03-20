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
  LoaderCircle,
  Landmark,
  Trash2,
  SlidersHorizontal,
  Wallet,
} from "lucide-react"
import React from "react"
import { onAuthStateChanged } from "firebase/auth"
import {
  auth,
  createUserNotification,
  createTransaction,
  deleteTransactionById,
  getTransactionsByUid,
  type Transaction,
} from "@/lib/firebase"

type StatusLabel = "Completed" | "Pending" | "Failed"
type TypeLabel = "Income" | "Expense"

const statusClassMap: Record<StatusLabel, string> = {
  Completed: "bg-hover text-(--color--hover-text-content)",
  Pending: "bg-secondary text-text",
  Failed: "bg-secondary text-text",
}

const typeClassMap: Record<TypeLabel, string> = {
  Income: "text-text",
  Expense: "text-text",
}

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
  }).format(amount)
}

const formatDate = (transaction: Transaction) => {
  if (!transaction.createdAt) {
    return "-"
  }

  return transaction.createdAt.toDate().toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "2-digit",
  })
}

const toStatusLabel = (status: Transaction["status"]): StatusLabel => {
  if (status === "pending") return "Pending"
  if (status === "failed") return "Failed"
  return "Completed"
}

const toTypeLabel = (type: Transaction["type"]): TypeLabel => {
  return type === "expense" ? "Expense" : "Income"
}

const getInitials = (name: string) => {
  const parts = name
    .trim()
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)

  if (parts.length === 0) {
    return "U"
  }

  return parts.map((p) => p[0]?.toUpperCase() ?? "").join("")
}

export default function Page() {
  const [uid, setUid] = React.useState<string | null>(null)
  const [rows, setRows] = React.useState<Transaction[]>([])
  const [isLoadingRows, setIsLoadingRows] = React.useState(true)
  const [isAddingTransaction, setIsAddingTransaction] = React.useState(false)
  const [deletingId, setDeletingId] = React.useState<string | null>(null)
  const [formAmount, setFormAmount] = React.useState("")
  const [formMerchant, setFormMerchant] = React.useState("")
  const [formCategory, setFormCategory] = React.useState("")
  const [formType, setFormType] = React.useState<Transaction["type"]>("income")
  const [formAccount, setFormAccount] = React.useState("Main Wallet")
  const [typeFilter, setTypeFilter] = React.useState<"all" | "Income" | "Expense">("all")
  const [statusFilter, setStatusFilter] = React.useState<
    "all" | "Completed" | "Pending" | "Failed"
  >("all")

  const loadTransactions = React.useCallback(async (nextUid: string) => {
    try {
      setIsLoadingRows(true)
      const items = await getTransactionsByUid(nextUid)
      setRows(items)
    } catch (error) {
      toast.error("Failed to load transactions")
      console.error("Load transactions error:", error)
    } finally {
      setIsLoadingRows(false)
    }
  }, [])

  React.useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (!user) {
        setUid(null)
        setRows([])
        setIsLoadingRows(false)
        return
      }

      setUid(user.uid)
      void loadTransactions(user.uid)
    })

    return () => unsubscribe()
  }, [loadTransactions])

  const filteredRows = rows.filter((row) => {
    const typeMatch = typeFilter === "all" || toTypeLabel(row.type) === typeFilter
    const statusMatch = statusFilter === "all" || toStatusLabel(row.status) === statusFilter
    return typeMatch && statusMatch
  })

  const income = rows
    .filter((row) => row.type === "income")
    .reduce((sum, row) => sum + row.amount, 0)
  const expense = rows
    .filter((row) => row.type === "expense")
    .reduce((sum, row) => sum + row.amount, 0)

  const summaryCards = [
    {
      title: "Total Income",
      amount: formatCurrency(income),
      count: `${rows.filter((row) => row.type === "income").length} Transactions`,
      icon: ArrowUpCircle,
      gradient:
        "bg-[radial-gradient(circle_at_65%_15%,rgba(155,112,255,0.35)_0%,rgba(155,112,255,0)_35%),radial-gradient(circle_at_78%_25%,rgba(80,175,255,0.45)_0%,rgba(80,175,255,0)_42%),linear-gradient(180deg,#d8f0ff_0%,#f8fbff_65%)]",
    },
    {
      title: "Total Expense",
      amount: formatCurrency(expense),
      count: `${rows.filter((row) => row.type === "expense").length} Transactions`,
      icon: ArrowDownCircle,
      gradient:
        "bg-[radial-gradient(circle_at_20%_25%,rgba(95,232,214,0.35)_0%,rgba(95,232,214,0)_40%),radial-gradient(circle_at_78%_22%,rgba(255,155,119,0.4)_0%,rgba(255,155,119,0)_42%),linear-gradient(180deg,#e4fffa_0%,#fff7f2_65%)]",
    },
    {
      title: "Current Balance",
      amount: formatCurrency(income - expense),
      count: "Main Wallet",
      icon: Wallet,
      gradient:
        "bg-[radial-gradient(circle_at_22%_22%,rgba(233,118,210,0.35)_0%,rgba(233,118,210,0)_38%),radial-gradient(circle_at_68%_26%,rgba(255,204,115,0.4)_0%,rgba(255,204,115,0)_40%),linear-gradient(180deg,#f9eeff_0%,#fffdf5_65%)]",
    },
  ] as const

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
      formatDate(row),
      row.merchant,
      row.category,
      toTypeLabel(row.type),
      toStatusLabel(row.status),
      formatCurrency(row.amount),
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

  const handleAddTransaction = async () => {
    if (!uid) {
      toast.error("You must be logged in")
      return
    }

    const parsedAmount = Number(formAmount)

    if (!formMerchant.trim()) {
      toast.error("Merchant is required")
      return
    }

    if (!formCategory.trim()) {
      toast.error("Category is required")
      return
    }

    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      toast.error("Enter a valid amount")
      return
    }

    setIsAddingTransaction(true)

    try {
      await createTransaction(uid, {
        amount: Number(parsedAmount.toFixed(2)),
        merchant: formMerchant.trim(),
        category: formCategory.trim(),
        type: formType,
        account: formAccount.trim() || "Main Wallet",
      })

      await createUserNotification(uid, {
        title: formType === "expense" ? "Expense Added" : "Income Added",
        message: `${formMerchant.trim()} - ${formatCurrency(Number(parsedAmount.toFixed(2)))}`,
        taskType: "transactions",
        priority: formType === "expense" ? "medium" : "low",
      })

      await loadTransactions(uid)
      setFormAmount("")
      setFormMerchant("")
      setFormCategory("")
      setFormType("income")
      setFormAccount("Main Wallet")
      toast.success("Transaction added")
    } catch (error) {
      toast.error("Failed to create transaction")
      console.error("Create transaction error:", error)
    } finally {
      setIsAddingTransaction(false)
    }
  }

  const handleRemove = async (transactionId: string) => {
    if (!uid) {
      toast.error("You must be logged in")
      return
    }

    setDeletingId(transactionId)

    try {
      await deleteTransactionById(uid, transactionId)
      await createUserNotification(uid, {
        title: "Transaction Removed",
        message: "A transaction was deleted from your ledger.",
        taskType: "transactions",
        priority: "low",
      })
      setRows((prev) => prev.filter((row) => row.id !== transactionId))
      toast.success("Transaction removed")
    } catch (error) {
      toast.error("Failed to remove transaction")
      console.error("Delete transaction error:", error)
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <div className="space-y-3 sm:space-y-4 text-text">
      <section className="grid grid-cols-1 gap-3 sm:gap-4 md:grid-cols-2 lg:grid-cols-3">
        {summaryCards.map((card) => {
          const Icon = card.icon

          return (
            <div
              key={card.title}
              className={`rounded-2xl border border-outline p-3 sm:p-4 ${card.gradient}`}
            >
              <div className="mb-6 sm:mb-8 inline-flex size-7 sm:size-8 items-center justify-center rounded-full border border-outline bg-forground/70">
                <Icon className="size-3 sm:size-4 text-text" />
              </div>

              <p className="text-3xl sm:text-5xl font-semibold tracking-tight text-text">{card.amount}</p>
              <div className="mt-2 flex items-center gap-2 text-xs sm:text-sm text-text-secondary">
                <span className="text-text font-medium">{card.title}</span>
                <span className="hidden sm:inline">{card.count}</span>
              </div>
            </div>
          )
        })}
      </section>

      <section className="rounded-2xl border border-outline bg-forground">
        <div className="border-b border-outline px-3 sm:px-5 py-3 sm:py-4">
          <h2 className="text-lg sm:text-2xl font-semibold text-text">All Transactions</h2>
        </div>

        <div className="grid grid-cols-1 gap-2 sm:gap-3 border-b border-outline px-3 sm:px-4 py-3 sm:py-4 sm:grid-cols-2 md:grid-cols-6">
          <input
            className="h-11 rounded-xl border border-outline bg-secondary px-3 text-sm text-text outline-none focus:border-hover"
            onChange={(event) => setFormMerchant(event.target.value)}
            placeholder="Merchant"
            value={formMerchant}
          />
          <input
            className="h-11 rounded-xl border border-outline bg-secondary px-3 text-sm text-text outline-none focus:border-hover"
            onChange={(event) => setFormCategory(event.target.value)}
            placeholder="Category"
            value={formCategory}
          />
          <input
            className="h-11 rounded-xl border border-outline bg-secondary px-3 text-sm text-text outline-none focus:border-hover"
            inputMode="decimal"
            onChange={(event) => setFormAmount(event.target.value)}
            placeholder="Amount"
            value={formAmount}
          />
          <select
            className="h-11 rounded-xl border border-outline bg-secondary px-3 text-sm text-text outline-none focus:border-hover"
            onChange={(event) => setFormType(event.target.value as Transaction["type"])}
            value={formType}
          >
            <option value="income">Income</option>
            <option value="expense">Expense</option>
          </select>
          <input
            className="h-11 rounded-xl border border-outline bg-secondary px-3 text-sm text-text outline-none focus:border-hover"
            onChange={(event) => setFormAccount(event.target.value)}
            placeholder="Account"
            value={formAccount}
          />
          <button
            className="h-11 rounded-xl bg-text px-3 sm:px-4 text-xs sm:text-sm font-medium text-forground hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
            onClick={() => void handleAddTransaction()}
            type="button"
            disabled={isAddingTransaction || isLoadingRows || !uid}
          >
            {isAddingTransaction ? "Adding..." : "Add"}
          </button>
        </div>

        <div className="flex flex-wrap items-center justify-end gap-1 sm:gap-2 border-b border-outline px-3 sm:px-4 py-2 sm:py-3">
          <button
            className="rounded-xl bg-text px-4 sm:px-6 py-2 text-xs sm:text-sm font-medium text-forground min-h-10"
            onClick={handleResetFilters}
            type="button"
          >
            All
          </button>

          <DropdownMenu>
            <DropdownMenuTrigger className="inline-flex items-center gap-1 rounded-xl border border-outline bg-forground px-3 sm:px-4 py-2 text-xs sm:text-sm text-text hover:bg-secondary min-h-10">
              <span className="hidden sm:inline">{typeFilter === "all" ? "Type" : typeFilter}</span>
              <span className="sm:hidden">{typeFilter === "all" ? "T" : typeFilter[0]}</span>
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
            <DropdownMenuTrigger className="inline-flex items-center gap-1 rounded-xl border border-outline bg-forground px-3 sm:px-4 py-2 text-xs sm:text-sm text-text hover:bg-secondary min-h-10">
              <SlidersHorizontal className="size-4 text-text-secondary" />
              <span className="hidden sm:inline">{statusFilter === "all" ? "Add Filters" : statusFilter}</span>
              <span className="sm:hidden">{statusFilter === "all" ? "✕" : "✓"}</span>
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
            className="inline-flex items-center gap-1 rounded-xl border border-outline bg-forground px-3 sm:px-4 py-2 text-xs sm:text-sm text-text hover:bg-secondary min-h-10"
            onClick={handleExport}
            type="button"
          >
            <Download className="size-4 text-text-secondary" />
            <span className="hidden sm:inline">Export All</span>
            <span className="sm:hidden">Export</span>
          </button>
        </div>

        <div className="overflow-x-auto rounded-xl border border-outline">
          <Table className="bg-forground text-xs sm:text-sm">
            <TableHeader className="bg-secondary/60">
              <TableRow className="border-outline hover:bg-secondary/60">
                <TableHead className="w-8 hidden sm:table-cell">
                  <input className="size-4 rounded border border-outline" type="checkbox" />
                </TableHead>
                <TableHead>Date</TableHead>
                <TableHead className="hidden md:table-cell">Merchant</TableHead>
                <TableHead className="hidden lg:table-cell">Category</TableHead>
                <TableHead>Type</TableHead>
                <TableHead className="hidden sm:table-cell">Status</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead className="hidden lg:table-cell">Account</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>

            <TableBody>
              {isLoadingRows && (
                <TableRow className="border-outline hover:bg-transparent">
                  <TableCell className="py-8 text-center text-text-secondary text-xs sm:text-base" colSpan={9}>
                    <span className="inline-flex items-center gap-2">
                      <LoaderCircle className="size-4 animate-spin" />
                      <span className="hidden sm:inline">Loading transactions...</span>
                      <span className="sm:hidden">Loading...</span>
                    </span>
                  </TableCell>
                </TableRow>
              )}

              {filteredRows.map((row) => (
                <TableRow key={row.id} className="border-outline hover:bg-secondary/50">
                  <TableCell className="hidden sm:table-cell">
                    <input className="size-4 rounded border border-outline" type="checkbox" />
                  </TableCell>
                  <TableCell className="font-medium text-text">{formatDate(row)}</TableCell>
                  <TableCell className="hidden md:table-cell">
                    <div className="flex items-center gap-2">
                      <span className="inline-flex size-6 sm:size-8 items-center justify-center rounded-full border border-outline bg-secondary text-xs font-semibold text-text shrink-0">
                        {getInitials(row.merchant)}
                      </span>
                      <span className="text-text truncate">{row.merchant}</span>
                    </div>
                  </TableCell>
                  <TableCell className="hidden lg:table-cell">{row.category}</TableCell>
                  <TableCell>
                    <span className={`font-medium ${typeClassMap[toTypeLabel(row.type)]}`}>
                      {toTypeLabel(row.type)}
                    </span>
                  </TableCell>
                  <TableCell className="hidden sm:table-cell">
                    <span
                      className={`inline-flex rounded-full border border-outline px-2 sm:px-3 py-0.5 sm:py-1 text-xs sm:text-sm font-medium ${statusClassMap[toStatusLabel(row.status)]}`}
                    >
                      {toStatusLabel(row.status)}
                    </span>
                  </TableCell>
                  <TableCell className="font-semibold text-text">{formatCurrency(row.amount)}</TableCell>
                  <TableCell className="hidden lg:table-cell">
                    <span className="inline-flex items-center gap-1 text-text">
                      <Landmark className="size-4 text-text-secondary" />
                      {row.account}
                    </span>
                  </TableCell>
                  <TableCell>
                      <button
                      className="inline-flex items-center gap-1 rounded-lg border border-outline px-2.5 py-1.5 text-xs font-medium text-text hover:bg-secondary disabled:cursor-not-allowed disabled:opacity-60"
                      onClick={() => void handleRemove(row.id)}
                      type="button"
                      disabled={deletingId === row.id}
                    >
                      {deletingId === row.id ? (
                        <LoaderCircle className="size-3.5 animate-spin" />
                      ) : (
                        <Trash2 className="size-3.5" />
                      )}
                      Remove
                    </button>
                  </TableCell>
                </TableRow>
              ))}

            {!isLoadingRows && filteredRows.length === 0 && (
              <TableRow className="border-outline hover:bg-transparent">
                <TableCell className="py-10 text-center text-text-secondary" colSpan={9}>
                  No transactions found for selected filters.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
        </div>
      </section>
    </div>
  )
}
