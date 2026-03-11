import { contextBridge, ipcRenderer } from "electron";

import { jarvisDesktopApiKey } from "../shared/desktop-api";
import { createJarvisDesktopApi } from "./bridge";

contextBridge.exposeInMainWorld(
  jarvisDesktopApiKey,
  createJarvisDesktopApi(ipcRenderer)
);
