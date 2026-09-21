import { useEffect, useState } from "react";
import { loadLibrary, saveLibrary } from "./library.ts";
import type { TripLibrary } from "./model.ts";

export function useTripLibrary() {
  const [loaded] = useState(() => {
    try {
      return loadLibrary(window.localStorage);
    } catch {
      return loadLibrary({
        getItem() {
          throw new Error("Unavailable");
        },
        setItem() {
          throw new Error("Unavailable");
        },
      });
    }
  });
  const [library, setLibrary] = useState<TripLibrary>(loaded.library);
  const [error, setError] = useState<string | null>(loaded.error);
  const [savedLibrary, setSavedLibrary] = useState<TripLibrary | null>(null);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    if (loaded.blocked) return;
    let result: string | null;
    try {
      result = saveLibrary(window.localStorage, library);
    } catch {
      result =
        "Changes are only in memory. Browser storage is unavailable; export your trips before closing this page.";
    }
    setError(result);
    if (!result) setSavedLibrary(library);
  }, [library, retry, loaded.blocked]);
  useEffect(() => {
    if (!error && savedLibrary === library) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [error, savedLibrary, library]);
  return {
    library,
    setLibrary,
    error,
    saved: savedLibrary === library && !error,
    canRetry: !loaded.blocked,
    retrySave: () => setRetry((value) => value + 1),
  };
}
