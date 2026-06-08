import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from "react";

/** Keeps modal draft local while open; only re-seeds when the modal opens. */
export function useModalDraft<T>(open: boolean, initial: T): [T, Dispatch<SetStateAction<T>>] {
  const [draft, setDraft] = useState(initial);
  const wasOpenRef = useRef(false);
  const initialRef = useRef(initial);
  initialRef.current = initial;

  useEffect(() => {
    if (open && !wasOpenRef.current) {
      setDraft(initialRef.current);
    }
    wasOpenRef.current = open;
  }, [open]);

  return [draft, setDraft];
}
