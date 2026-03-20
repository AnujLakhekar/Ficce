import CollectionManager from "@/components/dashboard/CollectionManager";

export default function Page() {
  return (
    <CollectionManager
      collectionName="bill-pay"
      subtitle="Save and track your utility and vendor bill payments."
      title="Bill Pay"
      amountLabel="Bill Amount"
      statusOptions={["due", "paid", "overdue"]}
    />
  );
}
