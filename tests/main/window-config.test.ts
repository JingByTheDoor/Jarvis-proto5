import { describe, expect, it } from "vitest";

import { rendererHardeningPolicy } from "../../src/shared/renderer-hardening";
import { buildContentSecurityPolicy, createMainWindowOptions } from "../../src/main/window";

describe("main window config", () => {
  it("creates a BrowserWindow config that matches the hardened renderer policy", () => {
    const windowOptions = createMainWindowOptions({
      preloadPath: "D:\\Jarvis-proto5 repo\\Jarvis-proto5\\dist\\preload\\index.js"
    });

    expect(windowOptions.show).toBe(false);
    expect(windowOptions.autoHideMenuBar).toBe(true);
    expect(windowOptions.backgroundColor).toBe("#07111d");
    expect(windowOptions.webPreferences).toMatchObject({
      preload: "D:\\Jarvis-proto5 repo\\Jarvis-proto5\\dist\\preload\\index.js",
      ...rendererHardeningPolicy.webPreferences
    });
  });

  it("builds a restrictive content security policy for the renderer shell", () => {
    const contentSecurityPolicy = buildContentSecurityPolicy();

    expect(contentSecurityPolicy).toContain("default-src 'none'");
    expect(contentSecurityPolicy).toContain("script-src 'self'");
    expect(contentSecurityPolicy).toContain("style-src 'self'");
    expect(contentSecurityPolicy).toContain("img-src 'self' data:");
    expect(contentSecurityPolicy).toContain("connect-src 'none'");
    expect(contentSecurityPolicy).toContain("frame-ancestors 'none'");
  });
});
