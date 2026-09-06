"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useCart } from "@/lib/storefront/useCart";

interface StorefrontProduct {
  id: string;
  name: string;
  description: string | null;
  price: number;
  images: string[];
  available: number;
}

export default function ProductDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const cart = useCart();
  const [product, setProduct] = useState<StorefrontProduct | null | undefined>(undefined);
  const [available, setAvailable] = useState<number | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [activeMediaIndex, setActiveMediaIndex] = useState(0);

  useEffect(() => {
    fetch(`/api/storefront/products?pageSize=200`)
      .then((res) => res.json())
      .then((body: { data: StorefrontProduct[] }) => {
        setProduct(body.data.find((p) => p.id === id) ?? null);
      })
      .catch(() => setProduct(null));

    fetch(`/api/storefront/products/${id}/stock`)
      .then((res) => (res.ok ? res.json() : null))
      .then((body: { available: number } | null) => setAvailable(body?.available ?? null));
  }, [id]);

  function addToCart() {
    if (!product) return;
    if (available !== null && quantity > available) {
      toast.error(`Only ${available} in stock.`);
      return;
    }
    cart.addItem(
      {
        productId: product.id,
        name: product.name,
        image: product.images[0] ?? null,
        price: product.price,
      },
      quantity,
    );
    toast.success("Added to cart.");
    router.push("/shop/cart");
  }

  if (product === undefined) return <p className="text-muted-foreground">Loading…</p>;
  if (product === null) return <p className="text-muted-foreground">Product not found.</p>;

  const media = product.images;

  return (
    <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
      <div>
        <div className="bg-secondary mb-3 aspect-square overflow-hidden rounded-lg">
          {media[activeMediaIndex] ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={media[activeMediaIndex]}
              alt={product.name}
              className="size-full object-cover"
            />
          ) : (
            <div className="text-muted-foreground flex size-full items-center justify-center text-sm">
              No image
            </div>
          )}
        </div>
        {media.length > 1 && (
          <div className="flex gap-2">
            {media.map((url, i) => (
              <button
                key={url}
                type="button"
                onClick={() => setActiveMediaIndex(i)}
                className={`bg-secondary size-14 shrink-0 overflow-hidden rounded border-2 ${
                  i === activeMediaIndex ? "border-primary" : "border-transparent"
                }`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={url} alt="" className="size-full object-cover" />
              </button>
            ))}
          </div>
        )}
      </div>

      <div>
        <h1 className="text-2xl font-bold">{product.name}</h1>
        <p className="mt-1 text-xl font-semibold">₹{product.price.toFixed(2)}</p>
        {product.description && (
          <p className="text-muted-foreground mt-3 text-sm">{product.description}</p>
        )}

        <p className="mt-4 text-sm">
          {available === null
            ? "Checking stock…"
            : available > 0
              ? `${available} in stock`
              : "Out of stock"}
        </p>

        <div className="mt-4 flex items-center gap-3">
          <Input
            type="number"
            min={1}
            max={available ?? undefined}
            value={quantity}
            onChange={(e) => {
              const next = Math.max(1, Math.floor(Number(e.target.value) || 1));
              setQuantity(available !== null ? Math.min(next, Math.max(available, 1)) : next);
            }}
            className="w-24"
          />
          <Button onClick={addToCart} disabled={available !== null && available <= 0}>
            Add to cart
          </Button>
        </div>
      </div>
    </div>
  );
}
