import { create } from 'zustand';
import { Organization } from '../types/organization.types';

interface OrgState {
  currentOrg: Organization | null;
  setCurrentOrg: (org: Organization) => void;
  clearCurrentOrg: () => void;
}

const getSafeOrg = (): Organization | null => {
  if (typeof window === 'undefined') return null;
  const str = localStorage.getItem('currentOrg');
  if (!str || str === 'undefined') return null;
  try {
    return JSON.parse(str);
  } catch {
    return null;
  }
};

export const useOrgStore = create<OrgState>((set) => ({
  currentOrg: getSafeOrg(),

  setCurrentOrg: (org) => {
    localStorage.setItem('currentOrg', JSON.stringify(org));
    set({ currentOrg: org });
  },

  clearCurrentOrg: () => {
    localStorage.removeItem('currentOrg');
    set({ currentOrg: null });
  },
}));
