import Link from "next/link";
import { cn } from "@/lib/utils";

const backClass = "btn-cancel h-10 shrink-0 rounded-xl px-4";

export function BackButton({
  href,
  onClick,
  className,
}: {
  href?: string;
  onClick?: () => void;
  className?: string;
}) {
  if (href) {
    return <Link href={href} className={cn(backClass, className)}>Back</Link>;
  }
  return (
    <button type="button" onClick={onClick} className={cn(backClass, className)}>
      Back
    </button>
  );
}
