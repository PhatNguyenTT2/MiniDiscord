"use client";

import { useState, useRef, useEffect, MouseEvent, WheelEvent } from "react";
import { X, ZoomIn, ZoomOut, Maximize, Download, Loader2 } from "lucide-react";
import { useTranslation } from "@/lib/i18n";

interface ImageViewerModalProps {
  isOpen: boolean;
  onClose: () => void;
  imageUrl: string;
  fileName?: string;
}

export function ImageViewerModal({
  isOpen,
  onClose,
  imageUrl,
  fileName = "image.png",
}: ImageViewerModalProps) {
  const { t } = useTranslation();
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [isDownloading, setIsDownloading] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);

  // Reset viewport state on reopen/change
  useEffect(() => {
    if (isOpen) {
      setScale(1);
      setOffset({ x: 0, y: 0 });
    }
  }, [isOpen, imageUrl]);

  // Click outside backdrop to close
  const handleBackdropClick = (e: MouseEvent<HTMLDivElement>) => {
    if (e.target === containerRef.current) {
      onClose();
    }
  };

  // Keyboard close
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  // Zoom helpers
  const zoomIn = () => setScale((s) => Math.min(6, s + 0.25));
  const zoomOut = () => setScale((s) => Math.max(0.5, s - 0.25));
  const resetZoom = () => {
    setScale(1);
    setOffset({ x: 0, y: 0 });
  };

  // Wheel zoom
  const handleWheel = (e: WheelEvent<HTMLDivElement>) => {
    e.preventDefault();
    const zoomFactor = 0.1;
    if (e.deltaY < 0) {
      setScale((s) => Math.min(6, s + zoomFactor));
    } else {
      setScale((s) => Math.max(0.5, s - zoomFactor));
    }
  };

  // Drag-to-pan handlers
  const handleMouseDown = (e: MouseEvent<HTMLImageElement>) => {
    e.preventDefault();
    if (scale <= 1) return; // Only pan when zoomed in
    setIsDragging(true);
    setDragStart({ x: e.clientX - offset.x, y: e.clientY - offset.y });
  };

  const handleMouseMove = (e: MouseEvent<HTMLImageElement>) => {
    if (!isDragging) return;
    setOffset({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y,
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  // Secure Blob Fetch Direct Download
  const handleDownload = async (e: MouseEvent) => {
    e.stopPropagation();
    try {
      setIsDownloading(true);
      const res = await fetch(imageUrl);
      const blob = await res.blob();
      const localUrl = URL.createObjectURL(blob);

      const link = document.createElement("a");
      link.href = localUrl;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();

      document.body.removeChild(link);
      URL.revokeObjectURL(localUrl);
    } catch (error) {
      console.error("[ImageViewer] Secure download failed, falling back to window:", error);
      window.open(imageUrl, "_blank", "noopener,noreferrer");
    } finally {
      setIsDownloading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      ref={containerRef}
      onClick={handleBackdropClick}
      onWheel={handleWheel}
      className="fixed inset-0 z-[150] flex flex-col items-center justify-center bg-black/90 backdrop-blur-[2px] animate-in fade-in duration-150 select-none"
    >
      {/* Top Header menu */}
      <div className="absolute top-0 left-0 right-0 flex h-14 items-center justify-between px-6 bg-gradient-to-b from-black/55 to-transparent z-10">
        <div className="flex flex-col min-w-0">
          <span className="text-sm font-semibold text-white truncate max-w-[400px]">
            {fileName}
          </span>
          <span className="text-xs text-zinc-400 mt-0.5">
            {Math.round(scale * 100)}%
          </span>
        </div>

        {/* Toolbar Controls */}
        <div className="flex items-center gap-1.5 bg-zinc-950/60 p-1.5 rounded-full border border-zinc-800">
          <button
            onClick={zoomIn}
            title={t("imageViewer.zoomIn") || "Zoom In"}
            className="flex h-8 w-8 items-center justify-center rounded-full text-zinc-400 hover:text-white hover:bg-zinc-800 transition cursor-pointer"
          >
            <ZoomIn className="h-4 w-4" />
          </button>

          <button
            onClick={zoomOut}
            title={t("imageViewer.zoomOut") || "Zoom Out"}
            className="flex h-8 w-8 items-center justify-center rounded-full text-zinc-400 hover:text-white hover:bg-zinc-800 transition cursor-pointer"
          >
            <ZoomOut className="h-4 w-4" />
          </button>

          <button
            onClick={resetZoom}
            title={t("imageViewer.reset") || "Reset"}
            className="flex h-8 w-8 items-center justify-center rounded-full text-zinc-400 hover:text-white hover:bg-zinc-800 transition cursor-pointer"
          >
            <Maximize className="h-4 w-4" />
          </button>

          <div className="h-4 w-px bg-zinc-800" />

          <button
            disabled={isDownloading}
            onClick={handleDownload}
            title={t("imageViewer.download") || "Download"}
            className="flex h-8 w-8 items-center justify-center rounded-full text-zinc-400 hover:text-white hover:bg-zinc-800 transition disabled:opacity-50 cursor-pointer"
          >
            {isDownloading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Download className="h-4 w-4" />
            )}
          </button>

          <div className="h-4 w-px bg-zinc-800" />

          <button
            onClick={onClose}
            title={t("common.close") || "Close"}
            className="flex h-8 w-8 items-center justify-center rounded-full text-zinc-400 hover:text-white hover:bg-zinc-800 transition cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Image body wrapper */}
      <div className="relative flex-1 w-full flex items-center justify-center overflow-hidden">
        <img
          ref={imageRef}
          src={imageUrl}
          alt={fileName}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          draggable={false}
          style={{
            transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})`,
            transition: isDragging ? "none" : "transform 0.15s cubic-bezier(0.1, 0.8, 0.3, 1)",
            cursor: scale > 1 ? (isDragging ? "grabbing" : "grab") : "default",
          }}
          className="max-w-[90%] max-h-[85vh] object-contain rounded select-none pointer-events-auto"
        />
      </div>
    </div>
  );
}
