import { describe, expect, it } from "vitest";

import { rendererHardeningPolicy } from "../../src/shared/renderer-hardening";

describe("renderer hardening policy", () => {
  it("pins the required BrowserWindow security flags", () => {
    expect(rendererHardeningPolicy.webPreferences.nodeIntegration).toBe(false);
    expect(rendererHardeningPolicy.webPreferences.contextIsolation).toBe(true);
    expect(rendererHardeningPolicy.webPreferences.sandbox).toBe(true);
    expect(rendererHardeningPolicy.webPreferences.webSecurity).toBe(true);
  });

  it("uses the required protocol and default-deny policies", () => {
    expect(rendererHardeningPolicy.localProtocol).toBe("app://");
    expect(rendererHardeningPolicy.permissions).toBe("default_deny");
    expect(rendererHardeningPolicy.navigation).toBe("default_deny");
    expect(rendererHardeningPolicy.popups).toBe("default_deny");
    expect(rendererHardeningPolicy.senderValidation).toBe("required");
    expect(rendererHardeningPolicy.rawApiExposure).toBe("forbidden");
  });

  it("defines a restrictive CSP baseline", () => {
    expect(rendererHardeningPolicy.contentSecurityPolicy.defaultSrc).toBe("'none'");
    expect(rendererHardeningPolicy.contentSecurityPolicy.scriptSrc).toEqual(["'self'"]);
    expect(rendererHardeningPolicy.contentSecurityPolicy.styleSrc).toEqual(["'self'"]);
    expect(rendererHardeningPolicy.contentSecurityPolicy.connectSrc).toEqual([]);
  });
});

