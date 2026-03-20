import CollectionManager from "@/components/dashboard/CollectionManager";

export default function Page() {
  return (
    <CollectionManager
      collectionName="cards"
      subtitle="Manage card records and credit limits."
      title="Cards"
      amountLabel="Credit Limit"
      statusOptions={["active", "paused", "expired"]}
    />
  );
}
