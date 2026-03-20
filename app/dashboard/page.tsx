"use client";

import Link from "next/link";
import React from "react";
import { onAuthStateChanged } from "firebase/auth";
import { auth, getTransactionsByUid } from "@/lib/firebase";

const formatMoney = (value: number) => {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(value);
};

export default function Page() {
  const [transactionCount, setTransactionCount] = React.useState(0);
  const [income, setIncome] = React.useState(0);
  const [expense, setExpense] = React.useState(0);

  React.useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        setTransactionCount(0);
        setIncome(0);
        setExpense(0);
        return;
      }

      const transactions = await getTransactionsByUid(user.uid);
      setTransactionCount(transactions.length);
      setIncome(
        transactions
          .filter((transaction) => transaction.type === "income")
          .reduce((sum, transaction) => sum + transaction.amount, 0),
      );
      setExpense(
        transactions
          .filter((transaction) => transaction.type === "expense")
          .reduce((sum, transaction) => sum + transaction.amount, 0),
      );
    });

    return () => unsubscribe();
  }, []);

  return (
    <div className="space-y-4 text-text">
      <section className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="rounded-2xl border border-outline bg-forground p-5">
          <p className="text-sm text-text-secondary">Transactions</p>
          <p className="mt-1 text-3xl font-semibold">{transactionCount}</p>
        </div>
        <div className="rounded-2xl border border-outline bg-forground p-5">
          <p className="text-sm text-text-secondary">Total Income</p>
          <p className="mt-1 text-3xl font-semibold">{formatMoney(income)}</p>
        </div>
        <div className="rounded-2xl border border-outline bg-forground p-5">
          <p className="text-sm text-text-secondary">Total Expense</p>
          <p className="mt-1 text-3xl font-semibold">{formatMoney(expense)}</p>
        </div>
      </section>

      <section className="rounded-2xl border border-outline bg-forground p-5">
        <h1 className="text-2xl font-semibold">Workspace Modules</h1>
        <p className="mt-1 text-sm text-text-secondary">
          Open any module below. Every page stores and reads real data from your account.
        </p>

        <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
          {[
            ["Tasks", "/dashboard/tasks"],
            ["Transactions", "/dashboard/transactions"],
            ["Payments", "/dashboard/payments"],
            ["Cards", "/dashboard/cards"],
            ["Capital", "/dashboard/capital"],
            ["Accounts", "/dashboard/accounts"],
            ["Bill Pay", "/dashboard/bill-pay"],
            ["Catalog", "/dashboard/catalog"],
            ["Customers", "/dashboard/customers"],
            ["Reimbursements", "/dashboard/reimbursements"],
            ["Accounting", "/dashboard/accounting"],
            ["Settings", "/dashboard/settings"],
          ].map(([label, href]) => (
            <Link
              className="rounded-xl border border-outline bg-secondary px-4 py-3 text-sm font-medium hover:bg-hover hover:text-(--color--hover-text-content)"
              href={href}
              key={href}
            >
              {label}
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
