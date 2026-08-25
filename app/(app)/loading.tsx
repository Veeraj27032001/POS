import { Loader2Icon } from "lucide-react";

export default function AppLoading() {
  return (
    <div className="flex flex-1 items-center justify-center p-8">
      <Loader2Icon className="text-muted-foreground size-6 animate-spin" />
    </div>
  );
}
