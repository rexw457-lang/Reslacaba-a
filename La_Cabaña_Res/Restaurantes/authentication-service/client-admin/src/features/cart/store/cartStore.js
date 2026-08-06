import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export const useCartStore = create(
  persist(
    (set, get) => ({
      items: [],
      isOpen: false,
      open: () => set({ isOpen: true }),
      close: () => set({ isOpen: false }),
      toggle: () => set((s) => ({ isOpen: !s.isOpen })),
      addItem: (product) => {
        set((state) => {
          const existing = state.items.find((i) => String(i._id) === String(product._id));
          if (existing) {
            return { items: state.items.map((i) => (String(i._id) === String(product._id) ? { ...i, qty: i.qty + 1 } : i)) };
          }
          return { items: [...state.items, { ...product, qty: 1 }] };
        });
      },
      removeItem: (id) => set((state) => ({ items: state.items.filter((i) => String(i._id) !== String(id)) })),
      updateQuantity: (id, qty) =>
        set((state) => ({ items: state.items.map((i) => (String(i._id) === String(id) ? { ...i, qty: Math.max(1, qty) } : i)) })),
      clear: () => set({ items: [] }),
      subtotal: () => get().items.reduce((s, it) => s + Number(it.price || 0) * (it.qty || 0), 0),
    }),
    {
      name: 'cart-storage', // localStorage key
      partialize: (state) => ({ items: state.items }),
    },
  ),
);

export default useCartStore;
