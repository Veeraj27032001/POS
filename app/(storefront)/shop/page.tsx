"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { Input } from "@/components/ui/input";

interface StorefrontProduct {
  id: string;
  name: string;
  description: string | null;
  price: number;
  images: string[];
  available: number;
}

function HeroSlideshow({ products }: { products: StorefrontProduct[] }) {
  const slides = useMemo(() => products.filter((p) => p.images.length > 0).slice(0, 5), [products]);
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (slides.length < 2) return;
    const timer = setInterval(() => setIndex((i) => (i + 1) % slides.length), 4000);
    return () => clearInterval(timer);
  }, [slides.length]);

  if (slides.length === 0) return null;

  return (
    <Link
      href={`/shop/products/${slides[index].id}`}
      className="bg-secondary relative mb-6 block h-56 w-full overflow-hidden rounded-xl sm:h-72"
    >
      {slides.map((product, i) => (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={product.id}
          src={product.images[0]}
          alt={product.name}
          className="absolute inset-0 size-full object-cover transition-opacity duration-700"
          style={{ opacity: i === index ? 1 : 0 }}
        />
      ))}
      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-4">
        <p className="font-semibold text-white">{slides[index].name}</p>
        <p className="text-sm text-white/80">₹{slides[index].price.toFixed(2)}</p>
      </div>
      <div className="absolute right-3 bottom-3 flex gap-1">
        {slides.map((_, i) => (
          <span
            key={i}
            className={`h-1.5 w-1.5 rounded-full ${i === index ? "bg-white" : "bg-white/40"}`}
          />
        ))}
      </div>
    </Link>
  );
}

export default function StorefrontHomePage() {
  const [products, setProducts] = useState<StorefrontProduct[] | null>(null);
  const [search, setSearch] = useState("");

  useEffect(() => {
    const qs = new URLSearchParams({ pageSize: "24", ...(search ? { search } : {}) }).toString();
    fetch(`/api/storefront/products?${qs}`)
      .then((res) => res.json())
      .then((body: { data: StorefrontProduct[] }) => setProducts(body.data))
      .catch(() => setProducts([]));
  }, [search]);

  return (
    <div>
      {!search && products && <HeroSlideshow products={products} />}

      <Input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search products…"
        className="mb-6 max-w-sm"
      />

      {products === null && <p className="text-muted-foreground">Loading…</p>}
      {products?.length === 0 && <p className="text-muted-foreground">No products found.</p>}

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
        {products?.map((product) => (
          <Link
            key={product.id}
            href={`/shop/products/${product.id}`}
            className="hover:border-foreground/30 rounded-lg border p-2 transition-colors"
          >
            <div className="bg-secondary mb-2 aspect-square overflow-hidden rounded-md">
              {product.images[0] ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={product.images[0]}
                  alt={product.name}
                  className="size-full object-cover"
                />
              ) : (
                <div className="text-muted-foreground flex size-full items-center justify-center text-xs">
                  No image
                </div>
              )}
            </div>
            <p className="truncate text-sm font-medium">{product.name}</p>
            <p className="text-muted-foreground text-sm">₹{product.price.toFixed(2)}</p>
            {product.available <= 0 && <p className="text-destructive text-xs">Out of stock</p>}
          </Link>
        ))}
      </div>
    </div>
  );
}
