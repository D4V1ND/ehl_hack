import { ArrowRightIcon } from "@/components/icons";
import { buttonVariants } from "@/components/ui/button";
import { ERP_INVENTORY_URL } from "@/lib/live/config";
import { cn } from "@/lib/utils";

export function OpenChatButton() {
  return (
    <a
      href={ERP_INVENTORY_URL}
      className={cn(
        buttonVariants({
          size: "lg",
          className:
            "group h-14 w-full justify-between rounded-xl bg-foreground px-5 text-background hover:bg-foreground/85",
        }),
      )}
    >
      Open ERP inventory
      <ArrowRightIcon
        aria-hidden="true"
        className="transition-transform duration-200 group-hover:translate-x-0.5"
      />
    </a>
  );
}
