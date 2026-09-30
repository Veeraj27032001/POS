import type { ReactNode } from "react";

export function AuthSplitLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen">
      <div className="flex flex-1 items-center justify-center p-8">
        <div className="w-full max-w-sm">{children}</div>
      </div>
      <div className="relative hidden flex-1 items-center justify-center overflow-hidden bg-[image:var(--gradient-primary)] md:flex">
        <div className="absolute top-[-60px] right-[-80px] size-[340px] rounded-full bg-white/10" />
        <div className="absolute bottom-[-40px] left-[-60px] size-[220px] rounded-full bg-white/10" />
        <div className="relative px-10 text-center text-white">
          <p className="mb-3.5 text-[15px] font-semibold tracking-widest uppercase opacity-75">
            POS
          </p>
          <p className="mx-auto max-w-sm text-3xl leading-tight font-extrabold">
            Run every register, storage location and storefront from one portal.
          </p>
        </div>
      </div>
    </div>
  );
}
