import CollectionManager from "@/components/dashboard/CollectionManager";

export default function Page() {
  return (
    <CollectionManager
      collectionName="payments"
      subtitle="Track outgoing and incoming payment requests."
      title="Payments"
      amountLabel="Payment Amount"
      statusOptions={["pending", "paid", "failed"]}
    />
  );
}
