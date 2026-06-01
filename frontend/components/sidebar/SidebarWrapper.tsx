"use client";

import { ServerList } from "@/components/sidebar/ServerList";
import { UserPanel } from "@/components/sidebar/UserPanel";
import { VoiceConnectedPanel } from "@/components/voice/VoiceConnectedPanel";

/**
 * SidebarWrapper — merges Column 1 (ServerList) + Column 2 (sidebar content).
 * Both columns extend full height; UserPanel overlays at the bottom
 * with NO own background, so column backgrounds show through naturally.
 */
export function SidebarWrapper({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative flex h-full shrink-0 border-r border-[#1f2023]">
      {/* Column 1: ServerList (full height, dark bg shows through) */}
      <ServerList />

      {/* Column 2: Sidebar content (full height, lighter bg shows through) */}
      <div className="relative flex shrink-0 flex-col bg-[#2b2d31] h-full">
        {children}
      </div>

      {/* UserPanel + VoiceConnectedPanel: absolute overlay at bottom */}
      <VoiceConnectedPanel />
      <UserPanel />
    </div>
  );
}
