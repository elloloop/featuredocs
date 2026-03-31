import AdminFeedbackTable from "@/components/AdminFeedbackTable";

export default function AdminPage() {
  return (
    <div className="mx-auto max-w-6xl px-6 py-12">
      <div className="mb-10">
        <h1 className="font-serif text-3xl font-bold text-[#1A1A1A]">
          Admin Dashboard
        </h1>
        <p className="mt-2 text-sm text-[#6B6B6B]">
          Manage user feedback across all products.
        </p>
      </div>

      <div className="rounded-lg border border-[#E8E6E1] bg-white p-6">
        <AdminFeedbackTable />
      </div>
    </div>
  );
}
