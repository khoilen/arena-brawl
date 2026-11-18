export type GameSound = 'punch' | 'kick' | 'special' | 'hit' | 'dodge' | 'jump' | 'win' | 'lose'

/** Small synthesized arcade effects; no external sound files or network requests. */
export class GameAudio {
  private context: AudioContext | null = null
  private enabled = true

  unlock() {
    if (typeof window === 'undefined') return
    this.context ??= new window.AudioContext()
    if (this.context.state === 'suspended') void this.context.resume()
  }

  toggle() {
    this.enabled = !this.enabled
    return this.enabled
  }

  play(sound: GameSound) {
    if (!this.enabled || !this.context || this.context.state !== 'running') return
    const now = this.context.currentTime + 0.005
    switch (sound) {
      case 'punch':
        this.noise(now, 0.105, 1700, 0.16)
        this.tone(now, 175, 92, 0.09, 'triangle', 0.09)
        break
      case 'kick':
        this.noise(now, 0.16, 920, 0.2)
        this.tone(now, 125, 58, 0.14, 'sawtooth', 0.12)
        break
      case 'hit':
        this.noise(now, 0.13, 1250, 0.2)
        this.tone(now, 110, 48, 0.16, 'triangle', 0.16)
        break
      case 'dodge':
        this.noise(now, 0.23, 2600, 0.095)
        this.tone(now, 480, 190, 0.18, 'sine', 0.045)
        break
      case 'jump':
        this.tone(now, 230, 420, 0.15, 'sine', 0.055)
        break
      case 'special':
        this.tone(now, 240, 920, 0.36, 'sawtooth', 0.11)
        this.tone(now + 0.04, 490, 740, 0.3, 'sine', 0.09)
        this.noise(now, 0.28, 2400, 0.08)
        break
      case 'win':
        this.chime(now, [523, 659, 784, 1047])
        break
      case 'lose':
        this.chime(now, [392, 330, 262, 196])
        break
    }
  }

  private tone(start: number, from: number, to: number, duration: number, type: OscillatorType, volume: number) {
    const context = this.context
    if (!context) return
    const oscillator = context.createOscillator()
    const gain = context.createGain()
    oscillator.type = type
    oscillator.frequency.setValueAtTime(Math.max(1, from), start)
    oscillator.frequency.exponentialRampToValueAtTime(Math.max(1, to), start + duration)
    gain.gain.setValueAtTime(0.0001, start)
    gain.gain.exponentialRampToValueAtTime(volume, start + 0.012)
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration)
    oscillator.connect(gain).connect(context.destination)
    oscillator.start(start)
    oscillator.stop(start + duration + 0.015)
  }

  private noise(start: number, duration: number, cutoff: number, volume: number) {
    const context = this.context
    if (!context) return
    const buffer = context.createBuffer(1, Math.ceil(context.sampleRate * duration), context.sampleRate)
    const data = buffer.getChannelData(0)
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1
    const source = context.createBufferSource()
    const filter = context.createBiquadFilter()
    const gain = context.createGain()
    source.buffer = buffer
    filter.type = 'lowpass'
    filter.frequency.setValueAtTime(cutoff, start)
    filter.frequency.exponentialRampToValueAtTime(Math.max(150, cutoff * 0.32), start + duration)
    gain.gain.setValueAtTime(volume, start)
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration)
    source.connect(filter).connect(gain).connect(context.destination)
    source.start(start)
  }

  private chime(start: number, notes: number[]) {
    notes.forEach((frequency, index) => {
      this.tone(start + index * 0.14, frequency, frequency * 0.96, 0.2, 'triangle', 0.1)
    })
  }
}
