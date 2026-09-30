"use client";

import { useEffect } from "react";
import { useAuthStore } from "@/store/auth-store";
import { useCartStore } from "@/store/cart-store";

export default function StoreHydration() {
  useEffect(() => {
    void useCartStore.persist.rehydrate();
    void useAuthStore.persist.rehydrate();
  }, []);

  return null;
}