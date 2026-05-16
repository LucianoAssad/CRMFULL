import { useEffect, useRef, useState, type ReactNode } from "react";
import { Minus, Plus } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  title: string;
  icon?: ReactNode;
  defaultOpen?: boolean;
  badge?: ReactNode;
  children: ReactNode;
  /** Optional key used by external focus mechanism. */
  sectionKey?: string;
  /** Controlled open state (optional). */
  open?: boolean;
  onOpenChange?: (v: boolean) => void;
  /** When true, applies a temporary visual highlight. */
  highlighted?: boolean;
}

export function InfoSection({
  title, icon, defaultOpen = false, badge, children,
  sectionKey, open: openProp, onOpenChange, highlighted,
}: Props) {
  const [internalOpen, setInternalOpen] = useState(defaultOpen);
  const isControlled = openProp !== undefined;
  const open = isControlled ? !!openProp : internalOpen;
  const ref = useRef<HTMLElement>(null);

  const toggle = () => {
    const next = !open;
    if (!isControlled) setInternalOpen(next);
    onOpenChange?.(next);
  };

  useEffect(() => {
    if (highlighted && ref.current) {
      ref.current.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [highlighted]);

  return (
    <section
      ref={ref}
      data-section-key={sectionKey}
      className={cn(
        "rounded-md border bg-card transition-all",
        highlighted && "ring-1 ring-primary/30 shadow-sm",
      )}
    >
      <button
        type="button"
        onClick={toggle}
        className={cn(
          "flex w-full items-center justify-between gap-2 px-3 py-2 text-left",
          "hover:bg-muted/40 transition-colors",
        )}
        aria-expanded={open}
      >
        <div className="flex min-w-0 items-center gap-2">
          {icon && <span className="text-muted-foreground shrink-0">{icon}</span>}
          <span className="truncate text-xs font-semibold uppercase tracking-wider text-foreground">
            {title}
          </span>
          {badge && <span className="shrink-0">{badge}</span>}
        </div>
        <span
          className="flex h-5 w-5 shrink-0 items-center justify-center rounded-sm border text-muted-foreground"
          aria-hidden
        >
          {open ? <Minus className="h-3 w-3" /> : <Plus className="h-3 w-3" />}
        </span>
      </button>
      {open && <div className="border-t px-3 py-3">{children}</div>}
    </section>
  );
}
