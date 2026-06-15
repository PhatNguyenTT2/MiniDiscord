"use client";

import React, { useState } from "react";
import * as Popover from "@radix-ui/react-popover";
import { UserProfileCard } from "./UserProfileCard";

interface MemberProfilePopoverProps {
  userId: string;
  username: string;
  displayName?: string;
  avatarUrl: string | null;
  status: string;
  roomId: string;
  children: React.ReactNode;
  side?: "left" | "right" | "top" | "bottom";
  align?: "start" | "center" | "end";
}

export function MemberProfilePopover({
  userId,
  username,
  displayName,
  avatarUrl,
  status,
  roomId,
  children,
  side = "left",
  align = "center",
}: MemberProfilePopoverProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <Popover.Root open={isOpen} onOpenChange={setIsOpen}>
      <Popover.Trigger asChild>
        {children}
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          side={side}
          align={align}
          sideOffset={8}
          className="z-[100] outline-none"
          onPointerDownOutside={(e) => {
            // Prevent Radix Popover from closing when clicking inside a fixed modal/dialog or backdrop
            const target = e.target as HTMLElement | null;
            if (target && (target.closest('[role="dialog"]') || target.closest('.fixed'))) {
              e.preventDefault();
            }
          }}
          onInteractOutside={(e) => {
            // Prevent Radix Popover from closing when interacting inside active modal areas
            const target = e.target as HTMLElement | null;
            if (target && (target.closest('[role="dialog"]') || target.closest('.fixed'))) {
              e.preventDefault();
            }
          }}
        >
          <UserProfileCard
            userId={userId}
            username={username}
            displayName={displayName}
            avatarUrl={avatarUrl}
            status={status}
            roomId={roomId}
            onClose={() => setIsOpen(false)}
          />
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
