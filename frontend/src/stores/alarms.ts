import { defineStore } from 'pinia';
import api from '../services/api';

export const useAlarmsStore = defineStore('alarms', {
  state: () => ({
    criticalCount: 0,
    knownIds: new Set<number>()
  }),
  actions: {
    async poll() {
      try {
        const { data } = await api.get('/alarms', { params: { status: 'abierta' } });
        const alarms: any[] = data.data ?? [];
        const critical = alarms.filter((a) => a.level === 'critica');
        const newCritical = critical.filter((a) => !this.knownIds.has(a.id));
        this.criticalCount = critical.length;
        if (newCritical.length > 0) {
          newCritical.forEach((a) => this.knownIds.add(a.id));
          playAlertBeep();
        }
        alarms.forEach((a) => this.knownIds.add(a.id));
      } catch {
        // silencioso — no interrumpir la UI si falla el poll
      }
    }
  }
});

function playAlertBeep() {
  try {
    const ctx = new AudioContext();
    const frequencies = [880, 1100, 880];
    let time = ctx.currentTime;
    frequencies.forEach((freq) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = freq;
      osc.type = 'sine';
      gain.gain.setValueAtTime(0.4, time);
      gain.gain.exponentialRampToValueAtTime(0.001, time + 0.18);
      osc.start(time);
      osc.stop(time + 0.18);
      time += 0.22;
    });
  } catch {
    // AudioContext no disponible (headless/SSR)
  }
}
