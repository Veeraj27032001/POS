import { stockInwardResource } from "@/lib/documents/resources";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return stockInwardResource.getOne(request, id);
}
