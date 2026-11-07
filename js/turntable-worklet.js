/* Проигрыватель-«пластинка» для AudioWorklet.
   Читает декодированную песню с произвольной скоростью rate:
   1 — обычная скорость и тон, 2 — вдвое быстрее и на октаву выше,
   0 — стоит, отрицательная — назад. Как у винила: скорость и тон связаны. */
class Turntable extends AudioWorkletProcessor {
  static get parameterDescriptors() {
    return [{ name: 'rate', defaultValue: 0, minValue: -8, maxValue: 8, automationRate: 'a-rate' }];
  }

  constructor() {
    super();
    this.L = null;
    this.R = null;
    this.len = 0;
    this.pos = 0;
    this.ratio = 1;
    this.tick = 0;
    this.port.onmessage = (e) => {
      const d = e.data;
      if (d.left) {
        this.L = d.left;
        this.R = d.right || d.left;
        this.len = d.left.length;
        this.ratio = d.sampleRate / sampleRate;
      }
    };
  }

  process(inputs, outputs, params) {
    const out = outputs[0];
    const o0 = out[0], o1 = out[1];
    const n = o0.length;
    if (!this.L) return true;
    const L = this.L, R = this.R, len = this.len, rate = params.rate;
    let p = this.pos;
    for (let i = 0; i < n; i++) {
      const r = rate.length > 1 ? rate[i] : rate[0];
      if (p < 0) p += len;
      else if (p >= len) p -= len;
      const i0 = p | 0, f = p - i0, i1 = i0 + 1 < len ? i0 + 1 : 0;
      o0[i] = L[i0] + (L[i1] - L[i0]) * f;
      if (o1) o1[i] = R[i0] + (R[i1] - R[i0]) * f;
      p += r * this.ratio;
    }
    this.pos = p;
    if (++this.tick % 16 === 0) this.port.postMessage(p / len);
    return true;
  }
}

registerProcessor('turntable', Turntable);
