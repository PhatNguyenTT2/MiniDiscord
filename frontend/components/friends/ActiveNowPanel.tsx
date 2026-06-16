"use client";

import { ScrollArea } from "@/components/ui/ScrollArea";
import { useTranslation } from "@/lib/i18n";
import { useFriendStore } from "@/stores/friendStore";
import { StatusAvatar } from "@/components/ui/StatusAvatar";

export function ActiveNowPanel() {
  const { t } = useTranslation();
  const friends = useFriendStore((s) => s.friends);

  const activeFriends = friends.filter(
    (f) => f.status === "ACCEPTED" && f.user.status !== "OFFLINE"
  );

  return (
    <div className="flex h-full w-[340px] flex-col border-l border-border bg-[#2b2d31]">
      <ScrollArea className="flex-1 px-4 pt-4">
        <h2 className="text-[20px] font-bold text-foreground">
          {t("activeNow.title")}
        </h2>

        {activeFriends.length === 0 ? (
          <div className="mt-8 flex flex-col items-center text-center">
            <p className="text-[15px] font-semibold text-foreground">
              {t("activeNow.empty")}
            </p>
            <p className="mt-2 max-w-[240px] text-[13px] text-muted-foreground leading-relaxed">
              {t("activeNow.emptyDescription")}
            </p>
          </div>
        ) : (
          <div className="mt-4 flex flex-col gap-2">
            {activeFriends.map((friend) => (
              <div
                key={friend.friendshipId}
                className="flex items-center gap-3 rounded-md p-2 hover:bg-[#3f4147] transition-colors cursor-pointer"
              >
                <StatusAvatar
                  src={friend.user.avatarUrl}
                  fallback={friend.user.username}
                  status={friend.user.status as any}
                  size="md"
                />
                <div className="flex-1 overflow-hidden">
                  <p className="truncate font-semibold text-foreground">
                    {friend.user.displayName || friend.user.username}
                  </p>
                  <p className="truncate text-[13px] text-muted-foreground">
                    {t(`status.${friend.user.status.toLowerCase()}`)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}
