"use client";

import { useEffect, useState } from "react";
import { useStickerStore, Sticker } from "@/stores/stickerStore";
import { getResolvedFileUrl } from "@/lib/fileResolver";

interface StickerPreviewProps {
  stickerId: string;
}

export function StickerPreview({ stickerId }: StickerPreviewProps) {
  const { fetchPacks, getStickerById, packs } = useStickerStore();
  const [sticker, setSticker] = useState<Sticker | null>(null);
  const [url, setUrl] = useState<string>("");

  useEffect(() => {
    // Ensure packs are fetched. If packs.length is check inside retail, it won't duplicate net requests
    fetchPacks();
  }, [fetchPacks]);

  // Attempt to resolve sticker and image URL
  useEffect(() => {
    const found = getStickerById(stickerId);
    if (found) {
      setSticker(found);
      getResolvedFileUrl(found.fileKey).then((resolved) => {
        setUrl(resolved);
      });
    }
  }, [stickerId, getStickerById, packs]); // Re-run if packs list changes

  if (!sticker || !url) {
    return (
      <div className="w-[160px] h-[160px] animate-pulse bg-zinc-800/30 rounded-lg flex items-center justify-center text-zinc-500 text-xs border border-zinc-800/50">
        Loading Sticker...
      </div>
    );
  }

  return (
    <div className="relative w-[160px] h-[160px] min-w-[80px] min-h-[80px] overflow-hidden select-none hover:bg-zinc-800/10 rounded-md p-1 transition">
      <img
        src={url}
        alt={sticker.name}
        className="w-full h-full object-contain transition duration-200 transform hover:scale-105"
        style={{ contentVisibility: "auto" }}
      />
    </div>
  );
}
