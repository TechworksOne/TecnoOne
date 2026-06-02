import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface BusinessInfo {
  businessName: string;
  businessType: string;
  businessLogo: string | null;
  ownerFirstName: string;
  ownerLastName: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  country: string;
  registeredAt: string;
}

interface BusinessState {
  businessInfo: BusinessInfo | null;
  isRegistered: boolean;
  setBusinessInfo: (info: BusinessInfo) => void;
  updateBusinessInfo: (updates: Partial<BusinessInfo>) => void;
  clearBusinessInfo: () => void;
}

export const useBusiness = create<BusinessState>()(
  persist(
    (set, get) => ({
      businessInfo: null,
      isRegistered: false,

      setBusinessInfo: (info: BusinessInfo) => {
        set({
          businessInfo: info,
          isRegistered: true,
        });
      },

      updateBusinessInfo: (updates: Partial<BusinessInfo>) => {
        const current = get().businessInfo;
        if (current) {
          set({
            businessInfo: { ...current, ...updates },
          });
        }
      },

      clearBusinessInfo: () => {
        set({
          businessInfo: null,
          isRegistered: false,
        });
      },
    }),
    {
      name: 'business-storage',
    }
  )
);