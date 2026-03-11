import type { Session, WebContents } from "electron";

import { jarvisAppOrigin, isTrustedJarvisUrl } from "./protocol";

export interface SenderFrameLike {
  readonly url?: string | null;
}

export interface IpcSenderEventLike {
  readonly senderFrame?: SenderFrameLike | null;
}

export interface NavigationEventLike {
  preventDefault: () => void;
}

export interface SessionGuardLike {
  setPermissionRequestHandler: Session["setPermissionRequestHandler"];
  setPermissionCheckHandler: Session["setPermissionCheckHandler"];
}

export interface WebContentsGuardLike {
  on: WebContents["on"];
  setWindowOpenHandler: WebContents["setWindowOpenHandler"];
}

export function isTrustedSenderFrame(frame: SenderFrameLike | null | undefined): boolean {
  return typeof frame?.url === "string" && isTrustedJarvisUrl(frame.url);
}

export function assertTrustedSenderFrame(event: IpcSenderEventLike): void {
  if (!isTrustedSenderFrame(event.senderFrame)) {
    throw new Error(`Rejected IPC sender outside trusted origin ${jarvisAppOrigin}`);
  }
}

export function shouldAllowNavigation(targetUrl: string): boolean {
  return isTrustedJarvisUrl(targetUrl);
}

export function shouldDenyPermission(
  _permission: string,
  _origin: string,
  _details: unknown
): boolean {
  return false;
}

export function applyDefaultSessionGuards(session: SessionGuardLike): void {
  session.setPermissionRequestHandler((_webContents, permission, callback, details) => {
    const requestingUrl =
      typeof details === "object" &&
      details !== null &&
      "requestingUrl" in details &&
      typeof details.requestingUrl === "string"
        ? details.requestingUrl
        : "";

    callback(shouldDenyPermission(permission, requestingUrl, details));
  });

  session.setPermissionCheckHandler((_webContents, permission, requestingOrigin, details) =>
    shouldDenyPermission(permission, requestingOrigin, details)
  );
}

export function applyWebContentsGuards(webContents: WebContentsGuardLike): void {
  webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  webContents.on("will-navigate", (event, url) => {
    if (!shouldAllowNavigation(url)) {
      (event as NavigationEventLike).preventDefault();
    }
  });
}
