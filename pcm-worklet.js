class Pcm extends AudioWorkletProcessor {
  constructor() {
    super();
    this.buf = new Float32Array(1600);
    this.n = 0;
  }
  process(inputs) {
    const ch = inputs[0][0];
    if (!ch) return true;
    for (let i = 0; i < ch.length; i++) {
      this.buf[this.n++] = ch[i];
      if (this.n === 1600) {
        const pcm = new Int16Array(1600);
        for (let j = 0; j < 1600; j++) {
          const s = Math.max(-1, Math.min(1, this.buf[j]));
          pcm[j] = s < 0 ? s * 0x8000 : s * 0x7fff;
        }
        this.port.postMessage(pcm.buffer, [pcm.buffer]);
        this.n = 0;
      }
    }
    return true;
  }
}
registerProcessor('pcm', Pcm);
