import { defineStore } from 'pinia';
import api from '../services/api';
import { clearStoredSession, resetSessionExpiration } from '../services/session';

const demoEnabled = import.meta.env.DEV || import.meta.env.VITE_ENABLE_DEMO === 'true';

export const useAuthStore = defineStore('auth', {
  state: () => ({
    token: localStorage.getItem('cafam_token'),
    user: JSON.parse(localStorage.getItem('cafam_user') || 'null'),
    sessionValidated: false
  }),
  getters: {
    isAuthenticated: (state) => Boolean(state.token),
    role: (state) => state.user?.role
  },
  actions: {
    async login(email, password, totpToken?: string) {
      let payload;
      try {
        const { data } = await api.post('/auth/login', { email, password, totp_token: totpToken });
        if (data.data?.requires_totp) return { requires_totp: true };
        payload = data.data;
        localStorage.removeItem('cafam_demo');
      } catch (error) {
        if (!demoEnabled || email !== 'admin@cafam.test' || password !== 'Admin123*') throw error;
        payload = {
          token: 'demo-token',
          user: { id: 1, name: 'Administrador Cafam', email, role: 'administrador', status: 'active' }
        };
        localStorage.setItem('cafam_demo', 'true');
      }
      this.token = payload.token;
      this.user = payload.user;
      this.sessionValidated = true;
      resetSessionExpiration();
      localStorage.setItem('cafam_token', this.token);
      localStorage.setItem('cafam_user', JSON.stringify(this.user));
      return null;
    },
    logout() {
      this.token = null;
      this.user = null;
      this.sessionValidated = false;
      clearStoredSession();
    },
    async validateSession() {
      if (!this.token || this.sessionValidated) return Boolean(this.token);
      try {
        await api.get('/auth/me');
        this.sessionValidated = true;
        return true;
      } catch {
        this.logout();
        return false;
      }
    }
  }
});
