import { Stub } from "@/components/stub";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <Stub title={`Album ${id}`} fase={2} />;
}
