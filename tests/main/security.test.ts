import { describe, expect, it, vi } from "vitest";

import {
  applyDefaultSessionGuards,
  applyWebContentsGuards,
  assertTrustedSenderFrame,
  isTrustedSenderFrame
} from "../../src/main/security";
import { getJarvisAppUrl } from "../../src/main/protocol";

describe("main process security guards", () => {
  it("accepts only trusted app-protocol sender frames for privileged IPC", () => {
    expect(
      isTrustedSenderFrame({
        url: getJarvisAppUrl("/index.html")
      })
    ).toBe(true);

    expect(() =>
      assertTrustedSenderFrame({
        senderFrame: {
          url: "https://example.com"
        }
      })
    ).toThrow("Rejected IPC sender");
  });

  it("defaults permissions, navigation, and popup creation to deny", () => {
    let permissionRequestHandler:
      | ((webContents: unknown, permission: string, callback: (value: boolean) => void, details: unknown) => void)
      | undefined;
    let permissionCheckHandler:
      | ((webContents: unknown, permission: string, requestingOrigin: string, details: unknown) => boolean)
      | undefined;
    let windowOpenHandler:
      | ((details: { url: string }) => { action: "deny" | "allow" })
      | undefined;
    let willNavigateHandler:
      | ((event: { preventDefault: () => void }, url: string) => void)
      | undefined;

    applyDefaultSessionGuards({
      setPermissionRequestHandler(handler) {
        permissionRequestHandler = handler as typeof permissionRequestHandler;
      },
      setPermissionCheckHandler(handler) {
        permissionCheckHandler = handler as typeof permissionCheckHandler;
      }
    });

    applyWebContentsGuards({
      setWindowOpenHandler(handler) {
        windowOpenHandler = handler as typeof windowOpenHandler;
      },
      on(eventName, handler) {
        if (eventName === "will-navigate") {
          willNavigateHandler = handler as typeof willNavigateHandler;
        }
        return this as never;
      }
    });

    let permissionCallbackValue: boolean | undefined;
    permissionRequestHandler?.(
      {} as never,
      "notifications",
      (value) => {
        permissionCallbackValue = value;
      },
      {
        requestingUrl: "https://example.com"
      } as never
    );

    expect(permissionCallbackValue).toBe(false);
    expect(
      permissionCheckHandler?.({} as never, "media", "https://example.com", {} as never)
    ).toBe(false);
    expect(windowOpenHandler?.({ url: "https://example.com" } as never)).toEqual({
      action: "deny"
    });

    const blockedNavigationEvent = {
      preventDefault: vi.fn()
    };
    willNavigateHandler?.(blockedNavigationEvent, "https://example.com");
    expect(blockedNavigationEvent.preventDefault).toHaveBeenCalledOnce();

    const allowedNavigationEvent = {
      preventDefault: vi.fn()
    };
    willNavigateHandler?.(allowedNavigationEvent, getJarvisAppUrl("/index.html"));
    expect(allowedNavigationEvent.preventDefault).not.toHaveBeenCalled();
  });
});
