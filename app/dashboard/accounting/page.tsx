"use client";

import React from "react";
import { onAuthStateChanged } from "firebase/auth";
import { auth, getTransactionsByUid, type Transaction } from "@/lib/firebase";

const monthKey = (transaction: Transaction) => {
  if (!transaction.createdAt) {
    return "Unknown";
  }

  return transaction.createdAt.toDate().toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
  });
};

const formatMoney = (value: number) => {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(value);
};

export default function Page() {
  const [rows, setRows] = React.useState<Transaction[]>([]);

  React.useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        setRows([]);
        return;
      }

      const items = await getTransactionsByUid(user.uid);
      setRows(items);
    });

    return () => unsubscribe();
  }, []);

  const grouped = rows.reduce<Record<string, { income: number; expense: number }>>((acc, row) => {
    const key = monthKey(row);
    const current = acc[key] ?? { income: 0, expense: 0 };

    if (row.type === "income") {
      current.income += row.amount;
    } else {
      current.expense += row.amount;
    }

    acc[key] = current;
    return acc;
  }, {});

  const monthlyRows = Object.entries(grouped);

  return (
    <section className="rounded-2xl border border-outline bg-forground text-text">
      <div className="border-b border-outline px-5 py-4">
        <h1 className="text-2xl font-semibold">Accounting</h1>
        <p className="mt-1 text-sm text-text-secondary">
          Real monthly income and expense rollup from your saved transactions.
        </p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead className="border-b border-outline bg-secondary/60 text-xs uppercase text-text-secondary">
            <tr>
              <th className="px-4 py-3">Month</th>
              <th className="px-4 py-3">Income</th>
              <th className="px-4 py-3">Expense</th>
              <th className="px-4 py-3">Net</th>
            </tr>
          </thead>
          <tbody>
            {monthlyRows.map(([month, values]) => (
              <tr className="border-b border-outline last:border-b-0" key={month}>
                <td className="px-4 py-3 font-medium">{month}</td>
                <td className="px-4 py-3">{formatMoney(values.income)}</td>
                <td className="px-4 py-3">{formatMoney(values.expense)}</td>
                <td className="px-4 py-3 font-semibold">{formatMoney(values.income - values.expense)}</td>
              </tr>
            ))}

            {monthlyRows.length === 0 && (
              <tr>
                <td className="px-4 py-8 text-center text-text-secondary" colSpan={4}>
                  No accounting data yet. Add transactions first.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
