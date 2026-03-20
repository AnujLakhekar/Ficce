import CollectionManager from "@/components/dashboard/CollectionManager";

export default function Page() {
  return (
    <CollectionManager
      collectionName="accounts"
      subtitle="Store account references and balances."
      title="Accounts"
      amountLabel="Current Balance"
      statusOptions={["active", "inactive", "archived"]}
    />
  );
}
