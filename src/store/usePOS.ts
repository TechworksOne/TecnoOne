import { create } from "zustand";
import { SaleItem } from "../types/sale";

interface POSState {
  cart: SaleItem[];
  customerName: string;
  customerNit: string;
  globalDiscount: number;
  addToCart: (item: Omit<SaleItem, "total">) => void;
  updateCartItem: (productId: string, updates: Partial<SaleItem>) => void;
  removeFromCart: (productId: string) => void;
  clearCart: () => void;
  setCustomer: (name: string, nit?: string) => void;
  setGlobalDiscount: (discount: number) => void;
  getSubtotal: () => number;
  getTotal: () => number;
}

export const usePOS = create<POSState>((set, get) => ({
  cart: [],
  customerName: "",
  customerNit: "",
  globalDiscount: 0,

  addToCart: (item) => {
    const existingItem = get().cart.find((i) => i.productId === item.productId);
    const total = item.quantity * item.price - item.discount;

    if (existingItem) {
      get().updateCartItem(item.productId, {
        quantity: existingItem.quantity + item.quantity,
        total: (existingItem.quantity + item.quantity) * item.price - item.discount,
      });
    } else {
      set((state) => ({
        cart: [...state.cart, { ...item, total }],
      }));
    }
  },

  updateCartItem: (productId, updates) => {
    set((state) => ({
      cart: state.cart.map((item) => {
        if (item.productId === productId) {
          const updatedItem = { ...item, ...updates };
          updatedItem.total = updatedItem.quantity * updatedItem.price - updatedItem.discount;
          return updatedItem;
        }
        return item;
      }),
    }));
  },

  removeFromCart: (productId) => {
    set((state) => ({
      cart: state.cart.filter((item) => item.productId !== productId),
    }));
  },

  clearCart: () => {
    set({ cart: [], customerName: "", customerNit: "", globalDiscount: 0 });
  },

  setCustomer: (name, nit = "") => {
    set({ customerName: name, customerNit: nit });
  },

  setGlobalDiscount: (discount) => {
    set({ globalDiscount: discount });
  },

  getSubtotal: () => {
    return get().cart.reduce((sum, item) => sum + item.total, 0);
  },

  getTotal: () => {
    const subtotal = get().getSubtotal();
    const globalDiscount = get().globalDiscount;
    return subtotal - (subtotal * globalDiscount) / 100;
  },
}));
