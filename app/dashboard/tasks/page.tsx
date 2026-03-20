import CollectionManager from "@/components/dashboard/CollectionManager";

export default function Page() {
  return (
    <CollectionManager
      collectionName="tasks"
      subtitle="Plan and track your operational tasks with real saved records."
      title="Tasks"
      amountLabel="Budget"
      statusOptions={["todo", "in-progress", "done"]}
    />
  );
}
