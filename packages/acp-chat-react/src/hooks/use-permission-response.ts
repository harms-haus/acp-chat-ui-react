import { useCallback } from "react";
import type { AcpStore } from "../store/index.js";
import type { SessionController } from "@acp/chat-core";

/**
 * Hook for responding to permission requests.
 * Provides callbacks to respond to or cancel permission requests.
 *
 * @param store - The ACP store instance
 * @param controller - The session controller instance
 * @returns Object with respond and cancel callbacks
 *
 * @example
 * ```tsx
 * const { respond, cancel } = usePermissionResponse(store, controller);
 *
 * // Respond to a permission request
 * respond(requestId, "allow_once");
 *
 * // Cancel a permission request
 * cancel(requestId);
 * ```
 */
export function usePermissionResponse(store: AcpStore, controller: SessionController) {
  const respond = useCallback(
    (requestId: number, optionId: string) => {
      store.respondToPermission(requestId, optionId);
      controller.respondToPermission(requestId, optionId);
    },
    [store, controller]
  );

  const cancel = useCallback(
    (requestId: number) => {
      controller.cancelPermission(requestId);
    },
    [controller]
  );

  return { respond, cancel };
}
