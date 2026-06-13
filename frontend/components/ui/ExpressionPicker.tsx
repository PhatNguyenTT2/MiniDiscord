"use client";

import React, { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import data from "@emoji-mart/data";
import Picker from "@emoji-mart/react";
import { useStickerStore, Sticker } from "@/stores/stickerStore";
import { getResolvedFileUrl } from "@/lib/fileResolver";

interface StickerLoaderImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  fileKey: string;
}

export function StickerLoaderImage({ fileKey, alt, ...props }: StickerLoaderImageProps) {
  const [url, setUrl] = useState<string>("");

  useEffect(() => {
    let active = true;
    getResolvedFileUrl(fileKey).then((resolved) => {
      if (active) setUrl(resolved);
    });
    return () => {
      active = false;
    };
  }, [fileKey]);

  if (!url) {
    return (
      <div
        className="animate-pulse bg-zinc-800 rounded"
        style={{ width: props.width || "48px", height: props.height || "48px" }}
      />
    );
  }

  return <img src={url} alt={alt} {...props} />;
}

interface ExpressionPickerProps {
  onEmojiSelect: (emoji: string) => void;
  onStickerSelect: (stickerId: string) => void;
  children: React.ReactNode;
  position?: "top" | "bottom";
  defaultTab?: "emoji" | "sticker";
}

export function ExpressionPicker({
  onEmojiSelect,
  onStickerSelect,
  children,
  position = "top",
  defaultTab = "emoji",
}: ExpressionPickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [tab, setTab] = useState<"emoji" | "sticker">(defaultTab);
  const [activePackId, setActivePackId] = useState<string | null>(null);
  const [coords, setCoords] = useState({ top: 0, left: 0 });

  const triggerRef = useRef<HTMLDivElement>(null);
  const pickerRef = useRef<HTMLDivElement>(null);

  const { packs, fetchPacks } = useStickerStore();

  // Reset tab to defaultTab when opened
  useEffect(() => {
    if (isOpen) {
      setTab(defaultTab);
    }
  }, [isOpen, defaultTab]);

  // Load sticker packs when switching to sticker tab
  useEffect(() => {
    if (tab === "sticker" && isOpen) {
      fetchPacks();
    }
  }, [tab, isOpen, fetchPacks]);

  // Set default active pack when packs are loaded
  useEffect(() => {
    if (packs.length > 0 && !activePackId) {
      setActivePackId(packs[0].id);
    }
  }, [packs, activePackId]);

  // Calculate position relative to viewport when opening
  useEffect(() => {
    if (!isOpen || !triggerRef.current) return;

    const rect = triggerRef.current.getBoundingClientRect();
    const PICKER_WIDTH = 368;
    const PICKER_HEIGHT = 445;
    const GAP = 8;

    let top: number;
    let left: number;

    if (position === "top") {
      top = rect.top - PICKER_HEIGHT - GAP;
      if (top < 8) {
        top = rect.bottom + GAP;
      }
    } else {
      top = rect.bottom + GAP;
      if (top + PICKER_HEIGHT > window.innerHeight - 8) {
        top = rect.top - PICKER_HEIGHT - GAP;
      }
    }

    left = rect.right - PICKER_WIDTH;
    if (left < 8) {
      left = 8;
    }

    setCoords({ top, left });
  }, [isOpen, position]);

  // Click outside to close
  useEffect(() => {
    if (!isOpen) return;

    function handleClickOutside(e: MouseEvent) {
      const target = e.target as Node;
      if (
        triggerRef.current?.contains(target) ||
        pickerRef.current?.contains(target)
      ) {
        return;
      }
      setIsOpen(false);
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  function handleEmojiSelect(emoji: { native: string }) {
    onEmojiSelect(emoji.native);
    setIsOpen(false);
  }

  function handleStickerClick(sticker: Sticker) {
    onStickerSelect(sticker.id);
    setIsOpen(false); // Discord closes picker instantly on sticker send
  }

  const activePack = packs.find(p => p.id === activePackId) || packs[0];

  return (
    <div ref={triggerRef} className="relative inline-block">
      <div onClick={() => setIsOpen(!isOpen)}>{children}</div>

      {isOpen &&
        createPortal(
          <div
            ref={pickerRef}
            className="fixed z-[9999] flex flex-col w-[368px] h-[445px] bg-[#1e1f22] rounded-lg border border-zinc-800 shadow-2xl overflow-hidden font-sans select-none"
            style={{ top: coords.top, left: coords.left }}
          >
            {/* Header Tabs */}
            <div className="flex border-b border-zinc-805 bg-[#2b2d31] p-1 gap-1">
              <button
                type="button"
                onClick={() => setTab("emoji")}
                className={`flex-1 py-1.5 text-sm font-semibold rounded transition ${tab === "emoji"
                  ? "bg-[#35373c] text-zinc-100"
                  : "text-zinc-400 hover:bg-[#35373c]/50 hover:text-zinc-200"
                  }`}
              >
                Emoji
              </button>
              <button
                type="button"
                onClick={() => setTab("sticker")}
                className={`flex-1 py-1.5 text-sm font-semibold rounded transition ${tab === "sticker"
                  ? "bg-[#35373c] text-zinc-100"
                  : "text-zinc-400 hover:bg-[#35373c]/50 hover:text-zinc-200"
                  }`}
              >
                Sticker
              </button>
            </div>

            {/* Content Body */}
            <div className="flex-1 flex overflow-hidden min-h-0 bg-[#313338]">
              {tab === "emoji" ? (
                <div className="w-full h-full emoji-mart-picker-wrapper">
                  <Picker
                    data={data}
                    onEmojiSelect={handleEmojiSelect}
                    theme="dark"
                    locale="vi"
                    previewPosition="none"
                    skinTonePosition="none"
                    set="native"
                    perLine={9}
                    maxFrequentRows={1}
                    navPosition="none"
                    searchPosition="sticky"
                  />
                </div>
              ) : (
                <div className="flex w-full h-full overflow-hidden min-h-0">
                  {/* Sticker Packs Navigation Side Bar */}
                  <div className="w-[60px] bg-[#2b2d31] flex flex-col items-center py-3 gap-2 overflow-y-auto border-r border-[#1e1f22]">
                    {packs.map((pack) => (
                      <button
                        key={pack.id}
                        type="button"
                        onClick={() => setActivePackId(pack.id)}
                        title={pack.name}
                        className={`w-10 h-10 rounded-lg overflow-hidden flex items-center justify-center p-1.5 border transition ${activePackId === pack.id
                          ? "bg-[#35373c] border-zinc-400"
                          : "border-transparent hover:bg-[#35373c]/50"
                          }`}
                      >
                        <StickerLoaderImage
                          fileKey={pack.coverFileKey}
                          alt={pack.name}
                          className="w-full h-full object-contain"
                          width="28px"
                          height="28px"
                        />
                      </button>
                    ))}
                    {packs.length === 0 && (
                      <div className="w-5 h-5 border-2 border-zinc-500 border-t-transparent animate-spin rounded-full mt-4" />
                    )}
                  </div>

                  {/* Sticker Pack Grid Area */}
                  <div className="flex-1 flex flex-col overflow-hidden min-h-0 p-3">
                    {activePack ? (
                      <div className="flex flex-col h-full min-h-0">
                        {/* Pack Title */}
                        <div className="text-zinc-200 text-xs font-bold uppercase tracking-wider mb-2 select-none">
                          {activePack.name}
                        </div>
                        {/* Grid */}
                        <div className="flex-1 overflow-y-auto grid grid-cols-3 gap-2 pr-1 min-h-0">
                          {activePack.stickers?.map((sticker) => (
                            <button
                              key={sticker.id}
                              type="button"
                              onClick={() => handleStickerClick(sticker)}
                              title={sticker.name}
                              className="aspect-square flex items-center justify-center rounded-md bg-[#2b2d31]/50 hover:bg-[#35373c] p-2 transition group"
                            >
                              <StickerLoaderImage
                                fileKey={sticker.fileKey}
                                alt={sticker.name}
                                className="w-full h-full object-contain transition transform group-hover:scale-110"
                                width="64px"
                                height="64px"
                              />
                            </button>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <div className="flex-1 flex items-center justify-center text-zinc-500 text-sm">
                        Không có sticker
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}
