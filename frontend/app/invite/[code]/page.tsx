"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Loader2, AlertCircle } from "lucide-react";
import { useTranslation } from "@/lib/i18n";
import { useAuthStore } from "@/stores/authStore";
import { useRoomStore } from "@/stores/roomStore";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/Button";

interface InvitePreview {
  code: string;
  roomId: string;
  roomName: string;
  roomDescription: string | null;
  roomIcon: string | null;
  memberCount: number;
}

export default function InviteJoinPage() {
  const params = useParams();
  const router = useRouter();
  const { t } = useTranslation();
  const { isAuthenticated, isHydrated, hydrate } = useAuthStore();
  const { fetchMyRooms } = useRoomStore();

  const code = params?.code as string;

  const [invite, setInvite] = useState<InvitePreview | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isJoining, setIsJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  useEffect(() => {
    if (!code) return;

    const loadInviteDetails = async () => {
      try {
        setIsLoading(true);
        setError(null);
        const res = await api.get(`/invites/${code}`);
        setInvite(res.data.data);
      } catch (err: any) {
        console.error("Error loading invite preview", err);
        setError(t("invite.invalid"));
      } finally {
        setIsLoading(false);
      }
    };

    loadInviteDetails();
  }, [code, t]);

  const handleJoin = async () => {
    if (!invite) return;

    if (!isAuthenticated) {
      // Directs to login with a redirect query to return back here after successful login
      router.push(`/login?redirect=/invite/${code}`);
      return;
    }

    try {
      setIsJoining(true);
      setError(null);
      await api.post(`/invites/${code}/join`);

      // Refresh the user's servers list in room store
      await fetchMyRooms(true);

      // Fetch the channels for the room to find a default channel
      let defaultChannelId = "";
      try {
        await useRoomStore.getState().fetchChannels(invite.roomId);
        const roomChannels = useRoomStore.getState().channels[invite.roomId] || [];
        if (roomChannels.length > 0) {
          const defaultChannel = roomChannels.find((c) => c.type === "TEXT") || roomChannels[0];
          defaultChannelId = defaultChannel.id;
        }
      } catch (err) {
        console.error("Failed to fetch channels for redirect", err);
      }

      // Redirect to the channel list (e.g. /channels/[roomId]/[channelId])
      if (defaultChannelId) {
        router.push(`/channels/${invite.roomId}/${defaultChannelId}`);
      } else {
        router.push(`/channels/${invite.roomId}`);
      }
    } catch (err: any) {
      console.error("Error joining server", err);
      setError(t("invite.joinError"));
    } finally {
      setIsJoining(false);
    }
  };

  if (isLoading || !isHydrated) {
    return (
      <div className="flex h-screen w-full flex-col items-center justify-center bg-[#313338] text-[#dbdee1]">
        <Loader2 className="h-8 w-8 animate-spin text-[#5865f2]" />
        <span className="mt-4 text-sm font-medium text-[#949ba4]">{t("invite.loading")}</span>
      </div>
    );
  }

  // Display Error State
  if (error || !invite) {
    return (
      <div className="relative flex min-h-screen w-full items-center justify-center bg-[#1e1f22]">
        <div
          className="pointer-events-none absolute inset-0 bg-cover bg-center bg-no-repeat opacity-25 blur-[1px]"
          style={{ backgroundImage: "url('/galaxy-bg.png')" }}
        />
        <div className="relative z-10 w-full max-w-[480px] rounded-lg bg-[#313338] p-8 shadow-2xl border border-white/5 flex flex-col items-center text-center">
          <div className="h-12 w-12 rounded-full bg-destructive/15 flex items-center justify-center text-destructive mb-4">
            <AlertCircle className="h-6 w-6" />
          </div>
          <h2 className="text-xl font-bold text-white mb-2">
            {error || t("invite.invalid")}
          </h2>
          <p className="text-xs text-[#949ba4] mb-6 max-w-[320px]">
            {t("invite.linkNote")}
          </p>
          <Button
            onClick={() => router.push("/channels/me")}
            className="w-full bg-[#5865f2] hover:bg-[#4752c4] text-white"
          >
            {t("invite.backToApp")}
          </Button>
        </div>
      </div>
    );
  }

  // Render Server Join View Card
  const initials = invite.roomName
    ? invite.roomName
      .split(" ")
      .map((n) => n[0])
      .slice(0, 3)
      .join("")
      .toUpperCase()
    : "?";

  return (
    <div className="relative flex min-h-screen w-full items-center justify-center bg-[#1e1f22] select-none">
      <div
        className="pointer-events-none absolute inset-0 bg-cover bg-center bg-no-repeat opacity-25"
        style={{ backgroundImage: "url('/galaxy-bg.png')" }}
      />

      <div className="relative z-10 w-full max-w-[480px] rounded-lg bg-[#313338] p-8 shadow-2xl border border-white/5 flex flex-col items-center text-center">
        {/* Server icon */}
        {invite.roomIcon ? (
          <img
            src={invite.roomIcon}
            alt={invite.roomName}
            className="h-20 w-20 rounded-2xl object-cover shadow-lg border border-[#232428]/40 mb-4 bg-background-tertiary"
          />
        ) : (
          <div className="h-20 w-20 rounded-2xl bg-[#5865f2] flex items-center justify-center text-white text-2xl font-bold shadow-lg border border-[#232428]/40 mb-4 uppercase">
            {initials}
          </div>
        )}

        <span className="text-[11px] font-bold uppercase tracking-wider text-[#949ba4] leading-none mb-1">
          {t("invite.title", { serverName: "" })}
        </span>
        <h2 className="text-2xl font-bold text-white mb-2 truncate max-w-full">
          {invite.roomName}
        </h2>

        {invite.roomDescription && (
          <p className="text-xs text-[#949ba4] mb-4 max-w-[360px] line-clamp-3 leading-relaxed">
            {invite.roomDescription}
          </p>
        )}

        {/* Members status count */}
        <div className="flex items-center gap-4 text-xs font-semibold text-[#b5bac1] mb-8 bg-[#2b2d31]/50 px-4 py-2 rounded-full border border-[#1f2023]/25">
          <div className="flex items-center gap-1.5">
            <div className="h-2 w-2 rounded-full bg-[#23a55a]" />
            <span>{t("invite.members", { count: invite.memberCount })}</span>
          </div>
        </div>

        {/* Join button */}
        <Button
          onClick={handleJoin}
          disabled={isJoining}
          className="w-full bg-[#23a55a] hover:bg-[#1a7f45] text-white font-semibold py-6 shadow-md transition-colors"
        >
          {isJoining ? (
            <Loader2 className="h-5 w-5 animate-spin mr-2" />
          ) : null}
          {isAuthenticated ? t("invite.accept") : t("auth.login")}
        </Button>
      </div>
    </div>
  );
}
