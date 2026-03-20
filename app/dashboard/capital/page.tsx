import CollectionManager from "@/components/dashboard/CollectionManager";

export default function Page() {
  return (
    <CollectionManager
      collectionName="capital"
      subtitle="Track capital allocations and reserve funds."
      title="Capital"
      amountLabel="Allocated Amount"
      statusOptions={["planned", "funded", "closed"]}
    />
  );
}
