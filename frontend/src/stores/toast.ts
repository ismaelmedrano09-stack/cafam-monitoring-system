import { defineStore } from 'pinia';

export type ToastTone = 'success' | 'error' | 'info';

type ToastItem = {
  id: number;
  message: string;
  tone: ToastTone;
};

export const useToastStore = defineStore('toast', {
  state: () => ({
    items: [] as ToastItem[]
  }),
  actions: {
    show(message: string, tone: ToastTone = 'success') {
      const id = Date.now() + Math.floor(Math.random() * 1000);
      this.items.push({ id, message, tone });
      window.setTimeout(() => this.dismiss(id), 4000);
    },
    dismiss(id: number) {
      this.items = this.items.filter((item) => item.id !== id);
    }
  }
});
