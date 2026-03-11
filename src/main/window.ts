import type { BrowserWindowConstructorOptions } from "electron";

import { rendererHardeningPolicy } from "../shared/renderer-hardening";

export interface MainWindowOptionsInput {
  readonly preloadPath: string;
}

export function buildContentSecurityPolicy(): string {
  const { contentSecurityPolicy } = rendererHardeningPolicy;
  return [
    `default-src ${contentSecurityPolicy.defaultSrc}`,
    `script-src ${contentSecurityPolicy.scriptSrc.join(" ")}`,
    `style-src ${contentSecurityPolicy.styleSrc.join(" ")}`,
    `img-src ${contentSecurityPolicy.imgSrc.join(" ")}`,
    `connect-src 'none'`,
    "base-uri 'none'",
    "form-action 'none'",
    "object-src 'none'",
    "frame-ancestors 'none'"
  ].join("; ");
}

export function createMainWindowOptions(
  input: MainWindowOptionsInput
): BrowserWindowConstructorOptions {
  return {
    width: 1580,
    height: 980,
    minWidth: 1180,
    minHeight: 760,
    show: false,
    autoHideMenuBar: true,
    title: "JARVIS",
    backgroundColor: "#07111d",
    webPreferences: {
      preload: input.preloadPath,
      ...rendererHardeningPolicy.webPreferences
    }
  };
}
