import type { JarvisDesktopApi } from "../shared/desktop-api";

declare global {
  interface Window {
    jarvisDesktop?: JarvisDesktopApi;
  }
}

export {};
