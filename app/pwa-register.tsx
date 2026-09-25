"use client";

import { useEffect } from "react";

export default function PwaRegister({ basePath }: { basePath: string }) {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    const scope = `${basePath || ""}/`;
    navigator.serviceWorker.register(`${basePath || ""}/sw.js`, { scope }).catch(() => {
      // The website remains usable if service-worker installation is blocked.
    });
  }, [basePath]);
  return null;
}
