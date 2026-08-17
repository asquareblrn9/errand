"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { usePathname } from "next/navigation";

/**
 * Pages opt into the topbar title/crumb by calling usePageHeader().
 * Titles are stored together with the pathname they were set from, so a
 * page that doesn't set one never shows a stale title from the previous page.
 */
interface PageHeaderState {
  title: string;
  crumb?: string;
  setHeader: (title: string, crumb?: string) => void;
}

const PageHeaderContext = createContext<PageHeaderState>({
  title: "",
  setHeader: () => {},
});

export function usePageHeader() {
  return useContext(PageHeaderContext);
}

export function PageHeaderProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [header, setHeaderState] = useState<{
    path: string;
    title: string;
    crumb?: string;
  }>({ path: "", title: "" });

  const setHeader = (title: string, crumb?: string) => {
    setHeaderState({ path: pathname, title, crumb });
  };

  const active = header.path === pathname ? header : { path: pathname, title: "" };

  return (
    <PageHeaderContext.Provider
      value={{ title: active.title, crumb: active.crumb, setHeader }}
    >
      {children}
    </PageHeaderContext.Provider>
  );
}

/** Convenience: call inside a page to set the topbar title + crumb. */
export function useSetPageHeader(title: string, crumb?: string) {
  const { setHeader } = usePageHeader();
  useEffect(() => {
    setHeader(title, crumb);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [title, crumb]);
}
