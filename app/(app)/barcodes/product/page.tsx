import { BarcodePreview } from "@/components/barcode-preview";
import { unscoped } from "@/lib/db";

import { PrintAllButton } from "../print-all-button";

export default async function ProductBarcodesPage() {
  const products = await unscoped().product.findMany({
    where: { isActive: true, isDeleted: false, skuBarcode: { not: null } },
    take: 500,
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="space-y-4 p-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Product Barcodes</h1>
        <PrintAllButton
          labels={products.map((p) => ({
            barcodeValue: p.skuBarcode!,
            productName: p.name,
            price: Number(p.price),
            copies: 1,
          }))}
        />
      </div>

      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b text-left">
            <th className="p-2">Product</th>
            <th className="p-2">Barcode</th>
            <th className="p-2">Manufacturer barcode</th>
          </tr>
        </thead>
        <tbody>
          {products.map((p) => (
            <tr key={p.id} className="border-b">
              <td className="p-2">{p.name}</td>
              <td className="w-48 p-2">
                <BarcodePreview value={p.skuBarcode!} />
              </td>
              <td className="p-2 font-mono">{p.skuBarcode}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
