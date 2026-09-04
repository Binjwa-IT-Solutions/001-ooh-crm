'use client';

import { usePathname } from 'next/navigation';
import { useContext } from 'react';
import { ChevronRight } from 'lucide-react';
import { NAV_GROUPS } from './app-shell';
import { PageHeaderContext } from './page-header-context';

export function PageHeader() {
  const pathname = usePathname();
  const { subTitle } = useContext(PageHeaderContext);

  // Find base item from NAV_GROUPS based on pathname
  const allItems = NAV_GROUPS.flatMap(g => g.items);
  // Match exact or starts-with for nested routes
  const currentNav = allItems.find(item => pathname === item.href || pathname.startsWith(item.href + '/'));

  if (!currentNav) return <div className="flex-1" />; // Empty fallback

  return (
    <div className="flex items-center text-2xl font-medium mr-auto ml-4 lg:ml-0 overflow-hidden text-ellipsis whitespace-nowrap">
      <span className=" text-[#6E1D1D]">{currentNav.label}</span>
      {subTitle && (
        <>
          <ChevronRight className="h-4 w-4 mx-1 text-[#687280] shrink-0" />
          <span className="text-[#687280] truncate max-w-[200px] sm:max-w-xs">{subTitle}</span>
        </>
      )}
    </div>
  );
}
