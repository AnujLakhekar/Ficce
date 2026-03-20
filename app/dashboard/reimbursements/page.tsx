import CollectionManager from "@/components/dashboard/CollectionManager";

export default function Page() {
  return (
    <CollectionManager
      collectionName="reimbursements"
      subtitle="Track reimbursement requests and settlement states."
      title="Reimbursements"
      amountLabel="Claim Amount"
      statusOptions={["submitted", "approved", "rejected", "paid"]}
    />
  );
}
