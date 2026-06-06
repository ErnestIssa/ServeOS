import { useCallback, useState } from "react";

export function useSupportPopup() {
  const [isVisible, setIsVisible] = useState(false);

  const onOpen = useCallback(() => setIsVisible(true), []);
  const onClose = useCallback(() => setIsVisible(false), []);

  return { isVisible, onOpen, onClose };
}
