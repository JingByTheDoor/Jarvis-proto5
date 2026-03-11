import path from "node:path";
import { pathToFileURL } from "node:url";

import type { Net, Protocol } from "electron";

export const jarvisProtocolScheme = "app";
export const jarvisProtocolHost = "jarvis";
export const jarvisAppOrigin = `${jarvisProtocolScheme}://${jarvisProtocolHost}`;

export function getJarvisAppUrl(resourcePath = "/index.html"): string {
  const pathname = resourcePath.startsWith("/") ? resourcePath : `/${resourcePath}`;
  return `${jarvisAppOrigin}${pathname}`;
}

export function isTrustedJarvisUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === `${jarvisProtocolScheme}:` && url.host === jarvisProtocolHost;
  } catch {
    return false;
  }
}

export function resolveJarvisAssetPath(requestUrl: string, assetRoot: string): string {
  const url = new URL(requestUrl);

  if (!isTrustedJarvisUrl(requestUrl)) {
    throw new Error(`Rejected non-app protocol request: ${requestUrl}`);
  }

  const decodedPath = decodeURIComponent(url.pathname === "/" ? "/index.html" : url.pathname);
  const rootPath = path.resolve(assetRoot);
  const candidatePath = path.resolve(rootPath, `.${decodedPath}`);
  const relativePath = path.relative(rootPath, candidatePath);

  if (relativePath.startsWith("..") || path.isAbsolute(relativePath)) {
    throw new Error(`Rejected app asset path traversal: ${decodedPath}`);
  }

  return candidatePath;
}

export function registerJarvisProtocol(
  protocol: Pick<Protocol, "handle">,
  net: Pick<Net, "fetch">,
  assetRoot: string
): void {
  protocol.handle(jarvisProtocolScheme, (request) => {
    const assetPath = resolveJarvisAssetPath(request.url, assetRoot);
    return net.fetch(pathToFileURL(assetPath).toString());
  });
}
