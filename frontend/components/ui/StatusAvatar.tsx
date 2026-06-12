import { cn } from "@/lib/utils";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/Avatar";
import { useState, useEffect } from "react";
import { getResolvedFileUrl } from "@/lib/fileResolver";

type UserStatus = "ONLINE" | "OFFLINE" | "IDLE" | "DND";
type AvatarSize = "sm" | "md" | "lg" | "xl";

const sizeClasses: Record<AvatarSize, string> = {
  sm: "h-6 w-6",
  md: "h-8 w-8",
  lg: "h-10 w-10",
  xl: "h-20 w-20",
};

const statusDotSize: Record<AvatarSize, string> = {
  sm: "h-2 w-2 border",
  md: "h-2.5 w-2.5 border-[1.5px]",
  lg: "h-3 w-3 border-2",
  xl: "h-5 w-5 border-[3px]",
};

const statusColors: Record<UserStatus, string> = {
  ONLINE: "bg-success",
  IDLE: "bg-warning",
  DND: "bg-destructive",
  OFFLINE: "bg-muted-foreground",
};

interface StatusAvatarProps {
  src?: string | null;
  fallback: string;
  status?: UserStatus;
  size?: AvatarSize;
  className?: string;
}

export function StatusAvatar({
  src,
  fallback,
  status,
  size = "lg",
  className,
}: StatusAvatarProps) {
  const [resolvedUrl, setResolvedUrl] = useState<string | null>(null);

  const isB2Key =
    !!src &&
    !(
      src.startsWith("http://") ||
      src.startsWith("https://") ||
      src.startsWith("data:") ||
      src.startsWith("/")
    );

  useEffect(() => {
    if (!isB2Key) return;

    let isMounted = true;
    getResolvedFileUrl(src)
      .then((url) => {
        if (isMounted) setResolvedUrl(url);
      })
      .catch((err) => {
        console.error("StatusAvatar: failed to resolve URL", err);
        if (isMounted) setResolvedUrl(null);
      });

    return () => {
      isMounted = false;
    };
  }, [src, isB2Key, getResolvedFileUrl]);

  const displayUrl = isB2Key ? resolvedUrl : src;

  return (
    <div className={cn("relative inline-flex", className)}>
      <Avatar className={sizeClasses[size]}>
        {displayUrl && <AvatarImage src={displayUrl} alt={fallback} />}
        <AvatarFallback className="text-xs">
          {fallback.slice(0, 2).toUpperCase()}
        </AvatarFallback>
      </Avatar>
      {status && (
        <span
          className={cn(
            "absolute bottom-0 right-0 rounded-full border-background",
            statusDotSize[size],
            statusColors[status]
          )}
          aria-label={`Status: ${status.toLowerCase()}`}
        />
      )}
    </div>
  );
}
