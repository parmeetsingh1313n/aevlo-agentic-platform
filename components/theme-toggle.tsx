"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className="size-10 rounded-full text-muted-foreground motion-reduce:transition-none"
      aria-label="Toggle color theme"
      title="Toggle color theme"
      onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
    >
      <Moon aria-hidden="true" className="size-[18px] dark:hidden" strokeWidth={1.6} />
      <Sun aria-hidden="true" className="hidden size-[18px] dark:block" strokeWidth={1.6} />
    </Button>
  );
}
