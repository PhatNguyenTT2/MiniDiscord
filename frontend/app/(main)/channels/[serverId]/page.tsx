"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useRoomStore } from "@/stores/roomStore";
import { Loader2 } from "lucide-react";
import { useTranslation } from "@/lib/i18n";

export default function ServerRedirectPage() {
  const params = useParams();
  const router = useRouter();
  const { t } = useTranslation();
  const serverId = params?.serverId as string;
  const { fetchChannels } = useRoomStore();
  const hasRedirected = useRef(false);
  const [noChannels, setNoChannels] = useState(false);

  useEffect(() => {
    if (!serverId || hasRedirected.current) return;

    const performRedirect = async () => {
      try {
        // Fetch channels for the current server
        await fetchChannels(serverId);

        // Retrieve fresh snapshot from state to avoid dependency on channels object
        const roomChannels = useRoomStore.getState().channels[serverId] || [];
        if (roomChannels.length > 0) {
          const textChannel = roomChannels.find((c) => c.type === "TEXT");
          if (textChannel) {
            hasRedirected.current = true;
            router.replace(`/channels/${serverId}/${textChannel.id}`);
          } else {
            // Gotcha: Fallback to first VOICE channel if no TEXT channel exists
            const voiceChannel = roomChannels.find((c) => c.type === "VOICE");
            if (voiceChannel) {
              hasRedirected.current = true;
              router.replace(`/channels/${serverId}/${voiceChannel.id}`);
            } else {
              setNoChannels(true);
            }
          }
        } else {
          setNoChannels(true);
        }
      } catch (err) {
        console.error("Failed to redirect to default channel:", err);
        setNoChannels(true);
      }
    };

    performRedirect();
  }, [serverId, fetchChannels, router]);

  if (noChannels) {
    return (
      <div className="flex h-full w-full flex-col items-center justify-center bg-[#313338] text-[#dbdee1] p-6 text-center select-none">
        <h2 className="text-xl font-semibold text-white mb-2">
          {t("server.noChannelsTitle") || "Máy chủ này chưa có kênh nào"}
        </h2>
        <p className="text-sm text-[#949ba4]">
          {t("server.noChannelsDesc") || "Vui lòng liên hệ với quản trị viên để tạo kênh mới."}
        </p>
      </div>
    );
  }

  return (
    <div className="flex h-full w-full flex-col items-center justify-center bg-[#313338] text-[#dbdee1]">
      <Loader2 className="h-8 w-8 animate-spin text-[#5865f2]" />
    </div>
  );
}
