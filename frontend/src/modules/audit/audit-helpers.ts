import type { AuditLogEntry } from './types';

export interface BusinessActivityInfo {
  title: string;
  channel: string;
  badgeColor: string;
  isSystem: boolean;
}

/**
 * Translates raw developer HTTP endpoints and database mutation actions
 * into non-technical, client-friendly business descriptions.
 */
export function getBusinessActivityInfo(entry: AuditLogEntry): BusinessActivityInfo {
  const path = (entry.path || '').toLowerCase();
  const method = (entry.method || '').toUpperCase();
  const action = (entry.action || '').toLowerCase();
  const entity = (entry.entity || '').toLowerCase();
  const isSystem = !entry.actorEmail || entry.actorEmail.toLowerCase().includes('system') || entry.actorRole === 'system';

  // 1. Justdial or external lead imports
  if (path.includes('justdial')) {
    return {
      title: 'Justdial Lead Sync',
      channel: 'Justdial Integration',
      badgeColor: 'bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-950/40 dark:text-orange-300 dark:border-orange-800',
      isSystem: true,
    };
  }

  // 2. Audit compliance scans
  if (path.includes('/audit/run') || entity === 'audit') {
    return {
      title: 'Compliance Audit Scan',
      channel: 'Automated Compliance Engine',
      badgeColor: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800',
      isSystem,
    };
  }

  // 3. Quotations & Proposals
  if (entity === 'quotations' || path.includes('/quotations')) {
    if (path.includes('accept') || action === 'update' && path.includes('status')) {
      return {
        title: 'Proposal Status Updated',
        channel: 'Sales Workflow',
        badgeColor: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800',
        isSystem,
      };
    }
    if (action === 'create' || method === 'POST') {
      return {
        title: 'New Quotation Generated',
        channel: 'Sales Workflow',
        badgeColor: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800',
        isSystem,
      };
    }
    return {
      title: 'Quotation Modified',
      channel: 'Sales Workflow',
      badgeColor: 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700',
      isSystem,
    };
  }

  // 4. Leads
  if (entity === 'leads' || path.includes('/leads')) {
    if (action === 'create') {
      return {
        title: 'New Client Lead Created',
        channel: isSystem ? 'CRM Auto-Capture' : 'Web CRM',
        badgeColor: 'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/40 dark:text-indigo-300 dark:border-indigo-800',
        isSystem,
      };
    }
    return {
      title: 'Lead Details Updated',
      channel: 'Web CRM',
      badgeColor: 'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/40 dark:text-indigo-300 dark:border-indigo-800',
      isSystem,
    };
  }

  // 5. Campaigns
  if (entity === 'campaigns' || path.includes('/campaigns')) {
    if (path.includes('status') || action === 'update') {
      return {
        title: 'Campaign Status Updated',
        channel: 'Operations',
        badgeColor: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800',
        isSystem,
      };
    }
    if (action === 'create') {
      return {
        title: 'Campaign Created',
        channel: 'Operations',
        badgeColor: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800',
        isSystem,
      };
    }
    return {
      title: 'Campaign Changes',
      channel: 'Operations',
      badgeColor: 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700',
      isSystem,
    };
  }

  // 6. Sites & Inventory
  if (entity === 'sites' || path.includes('/sites') || path.includes('/inventory')) {
    return {
      title: action === 'create' ? 'New Site Added to Inventory' : 'Site Inventory Updated',
      channel: 'Inventory Master',
      badgeColor: 'bg-teal-50 text-teal-700 border-teal-200 dark:bg-teal-950/40 dark:text-teal-300 dark:border-teal-800',
      isSystem,
    };
  }

  // 7. Tasks & Field Proofs
  if (entity === 'tasks' || path.includes('/tasks') || path.includes('/proofs')) {
    return {
      title: 'Field Task / Proof Update',
      channel: 'Field Operations',
      badgeColor: 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/40 dark:text-purple-300 dark:border-purple-800',
      isSystem,
    };
  }

  // 8. Purchase Orders & Finance
  if (entity.includes('purchase-order') || path.includes('/purchase-order')) {
    return {
      title: 'Vendor Purchase Order (PO)',
      channel: 'Finance & Procurement',
      badgeColor: 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800',
      isSystem,
    };
  }

  if (entity.includes('payment') || path.includes('/payment')) {
    return {
      title: 'Payment Transaction',
      channel: 'Finance & Accounts',
      badgeColor: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800',
      isSystem,
    };
  }

  // 9. Auth & User Access
  if (action === 'login' || path.includes('/auth/login')) {
    return {
      title: 'User Login Session',
      channel: 'Security & Access',
      badgeColor: 'bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-950/40 dark:text-sky-300 dark:border-sky-800',
      isSystem: false,
    };
  }

  if (action === 'logout' || path.includes('/auth/logout')) {
    return {
      title: 'User Logout Session',
      channel: 'Security & Access',
      badgeColor: 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700',
      isSystem: false,
    };
  }

  // Fallback for general business entities
  const prettyEntity = entity.charAt(0).toUpperCase() + entity.slice(1);
  const prettyAction = action.charAt(0).toUpperCase() + action.slice(1);

  return {
    title: `${prettyEntity} ${prettyAction}`,
    channel: isSystem ? 'System Engine' : 'Web CRM',
    badgeColor: 'bg-slate-50 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700',
    isSystem,
  };
}
