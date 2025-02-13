"use client";
import logo from "@/assets/logo.png";
import { AddEditNoteDialog } from "@/components/AddEditNoteDialog";
import { AddSalesRecordDialog } from "@/components/AddSalesRecordDialog";
import { AIChatButton } from "@/components/AIChatButton";
import { ThemeToggleButton } from "@/components/ThemeToggleButton";
import { Button } from "@/components/ui/button";
import { UserButton } from "@clerk/nextjs";
import { dark } from "@clerk/themes";
import { Plus } from "lucide-react";
import { useTheme } from "next-themes";
import Image from "next/image";
import Link from "next/link";
import { useSelectedLayoutSegment } from "next/navigation";
import { useState } from "react";

export function NavBar() {
  const { theme } = useTheme();
  const [isOpen, setIsOpen] = useState(false);
  const segment = useSelectedLayoutSegment();

  return (
    <>
      <div className="p-4 shadow">
        <div className="m-auto flex max-w-7xl flex-wrap items-center justify-between gap-3">
          <div className="flex flex-row space-x-4">
            <div className="flex items-center gap-1">
              <Image src={logo} alt="FlowBrain logo" width={40} height={40} />
              <span className="font-bold">FlowBrain</span>
            </div>

            <Link
              data-tab={segment}
              href="/services/notes"
              className="flex items-center gap-1 data-[tab=notes]:text-blue-600"
            >
              <span className="font-bold">Notes</span>
            </Link>

            <Link
              data-tab={segment}
              href="/services/sales"
              className="flex items-center gap-1 data-[tab=sales]:text-blue-600"
            >
              <span className="font-bold">Sales</span>
            </Link>
          </div>

          <div className="flex items-center gap-2">
            <UserButton
              appearance={{
                baseTheme: theme === "dark" ? dark : undefined,
                elements: { avatarBox: { width: "2.5rem", height: "2.5rem" } },
              }}
            />
            <ThemeToggleButton />
            <Button onClick={() => setIsOpen(true)}>
              <Plus size={20} className="mr-2" />
              <span>{`${segment === "notes" ? "Add Notes" : "Add Records"}`}</span>
            </Button>
            <AIChatButton />
          </div>
        </div>
      </div>

      {segment === "notes" && (
        <AddEditNoteDialog open={isOpen} setOpen={setIsOpen} />
      )}

      {segment === "sales" && (
        <AddSalesRecordDialog open={isOpen} setOpen={setIsOpen} />
      )}
    </>
  );
}
