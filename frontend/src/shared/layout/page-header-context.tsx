'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

type PageHeaderContextType = {
  subTitle: string | null;
  setSubTitle: (title: string | null) => void;
};

export const PageHeaderContext = createContext<PageHeaderContextType>({
  subTitle: null,
  setSubTitle: () => {},
});

// Provider to wrap the AppShell content
export function PageHeaderProvider({ children }: { children: ReactNode }) {
  const [subTitle, setSubTitle] = useState<string | null>(null);
  
  return (
    <PageHeaderContext.Provider value={{ subTitle, setSubTitle }}>
      {children}
    </PageHeaderContext.Provider>
  );
}

// Hook for nested pages to announce their specific state (e.g. active tab)
export function usePageSubTitle(title: string | null) {
  const { setSubTitle } = useContext(PageHeaderContext);
  
  useEffect(() => {
    setSubTitle(title);
    return () => setSubTitle(null);
  }, [title, setSubTitle]);
}
