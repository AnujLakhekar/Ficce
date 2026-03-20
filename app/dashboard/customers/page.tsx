import CollectionManager from "@/components/dashboard/CollectionManager";

export default function Page() {
  return (
    <CollectionManager
      collectionName="invoices"
      subtitle="Handle your invoices and track your balances."
      title="Invoicing"
      amountLabel="Invoice Amount"
      statusOptions={["completed", "overdue", "pending"]}
      addButtonLabel="Create Invoice"
    />
  );
}
