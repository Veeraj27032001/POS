"use client";

export function LoadProgress({ active }: { active: boolean }) {
  if (!active) return null;

  return (
    <div className="bg-muted relative h-1 w-full overflow-hidden">
      <div className="bg-primary absolute inset-y-0 w-1/3 animate-[loadprogress_1.1s_ease-in-out_infinite]" />
      <style>{`
        @keyframes loadprogress {
          0% { left: -33%; }
          100% { left: 100%; }
        }
      `}</style>
    </div>
  );
}
