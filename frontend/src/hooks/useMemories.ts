import { useEffect, useRef, useState } from "react";
import type { Memory } from "../types";

export function useMemories() {
  const [items, setItems] = useState<Memory[]>([]);
  const latest = useRef(items);
  latest.current = items;
  useEffect(
    () => () => {
      latest.current.forEach((item) => {
        if (item.preview) URL.revokeObjectURL(item.preview);
      });
    },
    [],
  );
  return { items, setItems, latest };
}
