"use client";

import { useEffect } from "react";
import { initNative } from "@/lib/native";

export function NativeInit() {
  useEffect(() => {
    initNative();
  }, []);

  return null;
}
