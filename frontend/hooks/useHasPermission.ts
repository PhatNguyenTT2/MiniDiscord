import { useParams } from "next/navigation";
import { useAuthStore } from "@/stores/authStore";
import { useRoomStore } from "@/stores/roomStore";
import { usePermissionStore } from "@/stores/permissionStore";

/**
 * Hook to check if the current logged-in user has a specific permission in a room.
 * If no roomId is provided, it defaults to the active server/room from the URL parameter (serverId).
 * 
 * Returns true if the user has the permission OR if the user is the room owner (owner bypass).
 */
export function useHasPermission(permissionKey: string, customRoomId?: string): boolean {
  const params = useParams();
  const roomId = customRoomId || (params?.serverId as string) || null;

  const currentUser = useAuthStore((s) => s.user);
  const rooms = useRoomStore((s) => s.rooms);
  const permissionsMap = usePermissionStore((s) => s.permissions);

  if (!roomId || !currentUser) {
    console.log("[E2E DEBUG useHasPermission] no roomId or currentUser.roomId:", roomId, "userId:", currentUser?.id);
    return false;
  }

  // Find active room to check owner or DM bypass
  const activeRoom = rooms.find((r) => r.id === roomId);
  if (activeRoom && (activeRoom.type === "DM" || activeRoom.ownerId === currentUser.id)) {
    console.log("[E2E DEBUG useHasPermission] DM or Owner bypass. Room type:", activeRoom.type, "Owner:", activeRoom.ownerId, "CurrentUser:", currentUser.id);
    return true; // DM participants and Room owners bypass all permission checks
  }

  const roomPermissions = permissionsMap[roomId] || [];
  const hasPerm = roomPermissions.includes(permissionKey);
  console.log("[E2E DEBUG useHasPermission]", permissionKey, "roomPermissions:", roomPermissions, "hasPerm:", hasPerm, "for room:", roomId);
  return hasPerm;
}
