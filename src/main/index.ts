import path from "node:path";
import { fileURLToPath } from "node:url";

import { app, BrowserWindow, ipcMain, net, protocol, session } from "electron";

import { registerShellIpcHandlers } from "./ipc";
import { getJarvisAppUrl, registerJarvisProtocol } from "./protocol";
import { applyDefaultSessionGuards, applyWebContentsGuards } from "./security";
import { createMainWindowOptions } from "./window";

const moduleDirectory = path.dirname(fileURLToPath(import.meta.url));
const distDirectory = path.resolve(moduleDirectory, "..");
const preloadPath = path.join(distDirectory, "preload", "index.js");
const rendererDirectory = path.join(distDirectory, "renderer");
const smokeTestMode = process.argv.includes("--smoke-test");

function createMainWindow(): BrowserWindow {
  const mainWindow = new BrowserWindow(
    createMainWindowOptions({
      preloadPath
    })
  );

  applyWebContentsGuards(mainWindow.webContents);
  mainWindow.once("ready-to-show", () => {
    mainWindow.show();
  });

  if (smokeTestMode) {
    mainWindow.webContents.once("did-finish-load", () => {
      setTimeout(() => {
        if (!mainWindow.isDestroyed()) {
          mainWindow.close();
        }

        app.quit();
      }, 150);
    });
  }

  void mainWindow.loadURL(getJarvisAppUrl("/index.html"));
  return mainWindow;
}

async function bootstrap(): Promise<void> {
  await app.whenReady();

  registerJarvisProtocol(protocol, net, rendererDirectory);
  applyDefaultSessionGuards(session.defaultSession);
  registerShellIpcHandlers(ipcMain, {
    now: () => new Date().toISOString(),
    publishRunEvent: (event) => {
      for (const browserWindow of BrowserWindow.getAllWindows()) {
        if (!browserWindow.isDestroyed()) {
          browserWindow.webContents.send("run.event.push", event);
        }
      }
    }
  });

  createMainWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow();
    }
  });
}

void bootstrap();

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
