/**
 * Studio-Grade Procedural Ambient Audio Engine using Web Audio API
 * Provides multi-layered organic soundscapes:
 * - Realistic multi-band rain with organic filtered-noise droplets (no synthetic sine beeps)
 * - Distant rolling thunderstorm with sub-bass rumble
 * - 3D stereo forest canopy breeze, soft brook, and distant syrinx-modeled birdsong
 * - Rolling stereo ocean waves with shore wash and receding foam
 * - 3-layer crackling fireplace (hearth draft, flame dance, wood snaps & ember pops)
 * - Cozy library reading room with subtle page-turn rustles
 * - Generative Lo-Fi Rhodes study chords with warm vinyl texture
 * - Summer night breeze with gentle distant crickets
 * - True stereo-decorrelated Brown, Pink, and Fatigue-Free Silky White Noise
 * - Warm Harmonic Binaural Beats (Alpha 10Hz, Theta 6Hz, Beta 14Hz) & 432Hz Tibetan Bowls
 * - Real-time 4-Channel Overlay Mixer (Rain, Forest, Fireplace, Alpha Binaural) + 3-Band Tone Shaper
 */

export type AmbientSoundType =
  | 'none'
  | 'soft_rain'
  | 'thunderstorm'
  | 'white_noise'
  | 'forest_wind'
  | 'ocean_waves'
  | 'fireplace'
  | 'library_cafe'
  | 'lofi_study'
  | 'night_crickets'
  | 'brown_noise'
  | 'pink_noise'
  | 'alpha_waves'
  | 'beta_waves'
  | 'theta_waves'
  | 'zen_chime';

export type AmbientLayerKey = 'rain' | 'forest' | 'fire' | 'binaural';

export interface SoundOption {
  id: AmbientSoundType;
  name: string;
  category: 'binaural' | 'noise' | 'nature';
  description: string;
  recommendedFor: string;
  icon: string;
  badge?: string;
}

export interface AmbientPresetMix {
  id: string;
  name: string;
  subtitle: string;
  primarySound: AmbientSoundType;
  warmth: number;
  bassBoost: number;
  layers: Record<AmbientLayerKey, number>;
}

export const AMBIENT_PRESET_MIXES: AmbientPresetMix[] = [
  {
    id: 'rainy_library',
    name: 'Día Lluvioso en Biblioteca',
    subtitle: 'Sala de lectura + Lluvia en ventana + Chimenea suave',
    primarySound: 'library_cafe',
    warmth: 0.78,
    bassBoost: 0.55,
    layers: { rain: 0.55, forest: 0, fire: 0.35, binaural: 0 },
  },
  {
    id: 'forest_cabin',
    name: 'Cabaña en el Bosque',
    subtitle: 'Brisa y pájaros lejanos + Chimenea cálida + Lluvia fina',
    primarySound: 'forest_wind',
    warmth: 0.72,
    bassBoost: 0.5,
    layers: { rain: 0.3, forest: 0, fire: 0.45, binaural: 0 },
  },
  {
    id: 'deep_alpha_focus',
    name: 'Hiperfoco Alfa + Ruido Marrón',
    subtitle: 'Aislamiento acústico grave + Ondas Alfa 10 Hz',
    primarySound: 'brown_noise',
    warmth: 0.82,
    bassBoost: 0.65,
    layers: { rain: 0.2, forest: 0, fire: 0, binaural: 0.45 },
  },
  {
    id: 'lofi_rain_night',
    name: 'Noche de Estudio Lo-Fi',
    subtitle: 'Acordes Rhodes cálidos + Lluvia nocturna + Crepitar',
    primarySound: 'lofi_study',
    warmth: 0.8,
    bassBoost: 0.5,
    layers: { rain: 0.45, forest: 0, fire: 0.25, binaural: 0 },
  },
];

export const AMBIENT_SOUND_OPTIONS: SoundOption[] = [
  {
    id: 'none',
    name: 'Silencio',
    category: 'nature',
    description: 'Sin sonido de fondo',
    recommendedFor: 'Concentración en silencio absoluto',
    icon: 'VolumeX',
  },
  {
    id: 'soft_rain',
    name: 'Lluvia Orgánica 3D',
    category: 'nature',
    description: 'Lluvia multicapa en estéreo con gotas reales sobre cristal y brisa suave',
    recommendedFor: 'Lectura prolongada y reducción de fatiga auditiva',
    icon: 'Droplets',
    badge: 'Mejorado',
  },
  {
    id: 'thunderstorm',
    name: 'Tormenta Lejana',
    category: 'nature',
    description: 'Cortina de lluvia tupida con truenos graves y profundos en la distancia',
    recommendedFor: 'Inmersión profunda en días de estudio intenso',
    icon: 'CloudRain',
    badge: 'Nuevo',
  },
  {
    id: 'forest_wind',
    name: 'Bosque Vivo y Arroyo',
    category: 'nature',
    description: 'Brisa entre las copas, murmullo de agua y canto suave de pájaros lejanos',
    recommendedFor: 'Comprensión profunda y Técnica Feynman',
    icon: 'Wind',
    badge: 'Mejorado',
  },
  {
    id: 'white_noise',
    name: 'Ruido Blanco Sedoso',
    category: 'noise',
    description: 'Ruido blanco estéreo ecualizado sin siseo agudo para aislar distracciones',
    recommendedFor: 'Bloqueo de ruidos externos y máxima concentración',
    icon: 'Waves',
    badge: 'Hi-Fi',
  },
  {
    id: 'brown_noise',
    name: 'Ruido Marrón Profundo',
    category: 'noise',
    description: 'Frecuencias graves envolventes de doble canal tipo cascada lejana',
    recommendedFor: 'Calmar la mente hiperactiva y foco profundo',
    icon: 'CloudRain',
    badge: 'Hi-Fi',
  },
  {
    id: 'pink_noise',
    name: 'Ruido Rosa Terciopelo',
    category: 'noise',
    description: 'Balance octava a octava natural filtrado para sesiones largas sin fatiga',
    recommendedFor: 'Memorización con flashcards y cuestionarios',
    icon: 'Wind',
    badge: 'Hi-Fi',
  },
  {
    id: 'fireplace',
    name: 'Chimenea de Leña',
    category: 'nature',
    description: 'Tiro térmico grave, danza de llama y crepitar orgánico de madera',
    recommendedFor: 'Sesiones vespertinas y redacción de apuntes',
    icon: 'Flame',
    badge: 'Mejorado',
  },
  {
    id: 'ocean_waves',
    name: 'Olas del Atlántico',
    category: 'nature',
    description: 'Vaivén estéreo de olas rompiendo en la orilla con espuma suave',
    recommendedFor: 'Estudio sereno y regulación del ritmo respiratorio',
    icon: 'Waves',
    badge: 'Estéreo',
  },
  {
    id: 'library_cafe',
    name: 'Sala de Lectura',
    category: 'nature',
    description: 'Resonancia cálida de biblioteca clásica con paso suave de páginas',
    recommendedFor: 'Sentirse acompañado estudiando sin distracciones',
    icon: 'BookOpen',
    badge: 'Mejorado',
  },
  {
    id: 'lofi_study',
    name: 'Acordes Lo-Fi Rhodes',
    category: 'binaural',
    description: 'Progresión generativa de acordes cálidos con textura analógica suave',
    recommendedFor: 'Resúmenes, mapas mentales y estudio creativo',
    icon: 'Sparkles',
    badge: 'Nuevo',
  },
  {
    id: 'night_crickets',
    name: 'Noche Serena',
    category: 'nature',
    description: 'Aire nocturno templado con grillos lejanos y atmósfera tranquila',
    recommendedFor: 'Repaso nocturno sin sobrecarga sensorial',
    icon: 'Wind',
    badge: 'Nuevo',
  },
  {
    id: 'alpha_waves',
    name: 'Ondas Alfa (10 Hz)',
    category: 'binaural',
    description: 'Colchón armónico cálido + pulso binaural de 10 Hz para estado de flujo',
    recommendedFor: 'Active recall, retención y lectura fluida',
    icon: 'Waves',
    badge: 'Armónico',
  },
  {
    id: 'theta_waves',
    name: 'Ondas Theta (6 Hz)',
    category: 'binaural',
    description: 'Resonancia binaural profunda a 6 Hz con armónicos relajantes',
    recommendedFor: 'Asimilación de conceptos abstractos y síntesis',
    icon: 'Sparkles',
    badge: 'Armónico',
  },
  {
    id: 'beta_waves',
    name: 'Ondas Beta (14 Hz)',
    category: 'binaural',
    description: 'Pulso binaural suave a 14 Hz sobre base armónica para agilidad mental',
    recommendedFor: 'Cálculo, simulacros de examen y problemas',
    icon: 'Zap',
    badge: 'Armónico',
  },
  {
    id: 'zen_chime',
    name: 'Cuencos Tibetanos 432Hz',
    category: 'binaural',
    description: 'Resonancia armónica con pulsos periódicos de cuencos cantores en estéreo',
    recommendedFor: 'Calma mental antes de exámenes y foco sereno',
    icon: 'Bell',
    badge: '432 Hz',
  },
];

class AmbientAudioEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private bassShelfFilter: BiquadFilterNode | null = null;
  private earComfortNotch: BiquadFilterNode | null = null;
  private warmthFilter: BiquadFilterNode | null = null;

  private currentSound: AmbientSoundType = 'none';
  private activeCleanupCallbacks: (() => void)[] = [];
  private overlayCleanupCallbacks: (() => void)[] = [];
  private stopTimeoutId: number | null = null;

  private volume: number = 0.55;
  private warmth: number = 0.75; // 0 = brillante, 1 = muy cálido/suave
  private bassBoost: number = 0.45; // 0..1 realce de cuerpo grave (120Hz)

  // Multi-layer mixer volumes (0..1)
  private layerVolumes: Record<AmbientLayerKey, number> = {
    rain: 0,
    forest: 0,
    fire: 0,
    binaural: 0,
  };
  private layerGainNodes: Partial<Record<AmbientLayerKey, GainNode>> = {};

  // Cached noise buffers per sampleRate so switching sounds is instant and CPU-light
  private cachedBuffers: Map<string, AudioBuffer> = new Map();

  private getContext(): AudioContext {
    if (!this.ctx || this.ctx.state === 'closed') {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      this.ctx = new AudioCtx();
      this.cachedBuffers.clear();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  private getWarmthCutoffFrequency(): number {
    // Maps warmth (0..1) -> cutoff frequency (7200Hz down to 1050Hz)
    const clamped = Math.max(0, Math.min(1, this.warmth));
    return Math.round(7200 * Math.pow(0.15, clamped));
  }

  private getBassShelfGainDb(): number {
    // Maps bassBoost (0..1) -> -1 dB to +7.5 dB below 160 Hz
    return -1 + Math.max(0, Math.min(1, this.bassBoost)) * 8.5;
  }

  public setVolume(val: number) {
    this.volume = Math.max(0, Math.min(1, val));
    if (this.masterGain && this.ctx) {
      const now = this.ctx.currentTime;
      this.masterGain.gain.cancelScheduledValues(now);
      this.masterGain.gain.setTargetAtTime(this.volume, now, 0.08);
    }
  }

  public getVolume(): number {
    return this.volume;
  }

  public setWarmth(val: number) {
    this.warmth = Math.max(0, Math.min(1, val));
    if (this.warmthFilter && this.ctx) {
      const now = this.ctx.currentTime;
      this.warmthFilter.frequency.setTargetAtTime(
        this.getWarmthCutoffFrequency(),
        now,
        0.1
      );
    }
  }

  public getWarmth(): number {
    return this.warmth;
  }

  public setBassBoost(val: number) {
    this.bassBoost = Math.max(0, Math.min(1, val));
    if (this.bassShelfFilter && this.ctx) {
      const now = this.ctx.currentTime;
      this.bassShelfFilter.gain.setTargetAtTime(this.getBassShelfGainDb(), now, 0.1);
    }
  }

  public getBassBoost(): number {
    return this.bassBoost;
  }

  public setLayerVolume(layer: AmbientLayerKey, val: number) {
    const clamped = Math.max(0, Math.min(1, val));
    const prev = this.layerVolumes[layer];
    this.layerVolumes[layer] = clamped;

    const existingGain = this.layerGainNodes[layer];
    if (existingGain && this.ctx && clamped > 0) {
      const now = this.ctx.currentTime;
      existingGain.gain.cancelScheduledValues(now);
      existingGain.gain.setTargetAtTime(clamped * 0.65, now, 0.1);
      return;
    }

    if ((prev === 0 && clamped > 0) || (prev > 0 && clamped === 0)) {
      if (this.currentSound !== 'none' || this.hasAnyActiveLayer()) {
        this.refreshOverlays();
      }
    }
  }

  public getLayerVolumes(): Record<AmbientLayerKey, number> {
    return { ...this.layerVolumes };
  }

  public hasAnyActiveLayer(): boolean {
    return Object.values(this.layerVolumes).some((v) => v > 0.01);
  }

  // Legacy compatibility helpers
  public setBinauralOverlay(enabled: boolean) {
    this.setLayerVolume('binaural', enabled ? 0.45 : 0);
  }

  public isBinauralOverlayEnabled(): boolean {
    return this.layerVolumes.binaural > 0.01;
  }

  public setRainOverlay(enabled: boolean) {
    this.setLayerVolume('rain', enabled ? 0.5 : 0);
  }

  public isRainOverlayEnabled(): boolean {
    return this.layerVolumes.rain > 0.01;
  }

  public getCurrentSound(): AmbientSoundType {
    return this.currentSound;
  }

  private clearOverlays() {
    this.overlayCleanupCallbacks.forEach((cb) => {
      try {
        cb();
      } catch {
        // ignore
      }
    });
    this.overlayCleanupCallbacks = [];
    this.layerGainNodes = {};
  }

  private tearDownNodesImmediately() {
    if (this.stopTimeoutId !== null) {
      window.clearTimeout(this.stopTimeoutId);
      this.stopTimeoutId = null;
    }
    this.clearOverlays();
    this.activeCleanupCallbacks.forEach((cb) => {
      try {
        cb();
      } catch {
        // ignore
      }
    });
    this.activeCleanupCallbacks = [];
  }

  public stop(fadeOutMs: number = 180) {
    this.currentSound = 'none';
    if (!this.ctx || !this.masterGain || fadeOutMs <= 0) {
      this.tearDownNodesImmediately();
      return;
    }

    try {
      const now = this.ctx.currentTime;
      this.masterGain.gain.cancelScheduledValues(now);
      this.masterGain.gain.setValueAtTime(this.masterGain.gain.value, now);
      this.masterGain.gain.linearRampToValueAtTime(0.0001, now + fadeOutMs / 1000);
      if (this.stopTimeoutId !== null) {
        window.clearTimeout(this.stopTimeoutId);
      }
      this.stopTimeoutId = window.setTimeout(() => {
        this.tearDownNodesImmediately();
      }, fadeOutMs + 30);
    } catch {
      this.tearDownNodesImmediately();
    }
  }

  private ensureMasterChain(ctx: AudioContext): AudioNode {
    // Master Gain with smooth 0.65s fade-in
    const master = ctx.createGain();
    master.gain.setValueAtTime(0.001, ctx.currentTime);
    master.gain.linearRampToValueAtTime(this.volume, ctx.currentTime + 0.65);

    // 1. Warm Low-Shelf Filter (145 Hz) for rich acoustic body
    const bassShelf = ctx.createBiquadFilter();
    bassShelf.type = 'lowshelf';
    bassShelf.frequency.setValueAtTime(145, ctx.currentTime);
    bassShelf.gain.setValueAtTime(this.getBassShelfGainDb(), ctx.currentTime);

    // 2. Psychoacoustic Ear-Comfort Notch (2900 Hz, -3.5 dB) to prevent ear fatigue during long study sessions
    const comfortNotch = ctx.createBiquadFilter();
    comfortNotch.type = 'peaking';
    comfortNotch.frequency.setValueAtTime(2900, ctx.currentTime);
    comfortNotch.Q.setValueAtTime(1.1, ctx.currentTime);
    comfortNotch.gain.setValueAtTime(-3.5, ctx.currentTime);

    // 3. Master Warmth Low-pass Filter to sculpt high frequencies
    const warmthFilter = ctx.createBiquadFilter();
    warmthFilter.type = 'lowpass';
    warmthFilter.frequency.setValueAtTime(this.getWarmthCutoffFrequency(), ctx.currentTime);
    warmthFilter.Q.setValueAtTime(0.45, ctx.currentTime);

    bassShelf.connect(comfortNotch);
    comfortNotch.connect(warmthFilter);
    warmthFilter.connect(master);
    master.connect(ctx.destination);

    this.masterGain = master;
    this.bassShelfFilter = bassShelf;
    this.earComfortNotch = comfortNotch;
    this.warmthFilter = warmthFilter;

    return bassShelf;
  }

  public play(sound: AmbientSoundType) {
    this.tearDownNodesImmediately();
    if (sound === 'none' && !this.hasAnyActiveLayer()) {
      this.currentSound = 'none';
      return;
    }

    const ctx = this.getContext();
    this.currentSound = sound;
    const inputBus = this.ensureMasterChain(ctx);

    switch (sound) {
      case 'alpha_waves':
        this.startWarmBinauralPad(ctx, inputBus, 196, 10); // G3 + 10Hz Alpha
        break;
      case 'theta_waves':
        this.startWarmBinauralPad(ctx, inputBus, 164.81, 6); // E3 + 6Hz Theta
        break;
      case 'beta_waves':
        this.startWarmBinauralPad(ctx, inputBus, 220, 14); // A3 + 14Hz Beta
        break;
      case 'brown_noise':
        this.startStereoBrownNoise(ctx, inputBus);
        break;
      case 'pink_noise':
        this.startStereoPinkNoise(ctx, inputBus);
        break;
      case 'white_noise':
        this.startStereoWhiteNoise(ctx, inputBus);
        break;
      case 'soft_rain':
        this.startRealisticRain(ctx, inputBus, false);
        break;
      case 'thunderstorm':
        this.startRealisticRain(ctx, inputBus, true);
        break;
      case 'ocean_waves':
        this.startOceanWaves(ctx, inputBus);
        break;
      case 'fireplace':
        this.startCracklingFireplace(ctx, inputBus);
        break;
      case 'forest_wind':
        this.startForestWind(ctx, inputBus);
        break;
      case 'library_cafe':
        this.startLibraryAmbience(ctx, inputBus);
        break;
      case 'lofi_study':
        this.startLofiStudyChords(ctx, inputBus);
        break;
      case 'night_crickets':
        this.startNightCrickets(ctx, inputBus);
        break;
      case 'zen_chime':
        this.startSingingBowls(ctx, inputBus);
        break;
    }

    this.refreshOverlays();
  }

  private refreshOverlays() {
    this.clearOverlays();
    if (!this.ctx || !this.bassShelfFilter) return;
    if (this.currentSound === 'none' && !this.hasAnyActiveLayer()) return;

    const inputBus = this.bassShelfFilter;

    // 1. Rain Layer
    if (
      this.layerVolumes.rain > 0.01 &&
      this.currentSound !== 'soft_rain' &&
      this.currentSound !== 'thunderstorm'
    ) {
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(this.layerVolumes.rain * 0.65, this.ctx.currentTime);
      g.connect(inputBus);
      this.layerGainNodes.rain = g;
      this.overlayCleanupCallbacks.push(this.createRainNodes(this.ctx, g, false));
    }

    // 2. Forest Layer
    if (this.layerVolumes.forest > 0.01 && this.currentSound !== 'forest_wind') {
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(this.layerVolumes.forest * 0.65, this.ctx.currentTime);
      g.connect(inputBus);
      this.layerGainNodes.forest = g;
      this.overlayCleanupCallbacks.push(this.createForestNodes(this.ctx, g));
    }

    // 3. Fireplace Layer
    if (this.layerVolumes.fire > 0.01 && this.currentSound !== 'fireplace') {
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(this.layerVolumes.fire * 0.65, this.ctx.currentTime);
      g.connect(inputBus);
      this.layerGainNodes.fire = g;
      this.overlayCleanupCallbacks.push(this.createFireplaceNodes(this.ctx, g));
    }

    // 4. Binaural Alpha 10Hz Layer
    if (
      this.layerVolumes.binaural > 0.01 &&
      this.currentSound !== 'alpha_waves' &&
      this.currentSound !== 'beta_waves' &&
      this.currentSound !== 'theta_waves'
    ) {
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(this.layerVolumes.binaural * 0.55, this.ctx.currentTime);
      g.connect(inputBus);
      this.layerGainNodes.binaural = g;
      this.overlayCleanupCallbacks.push(this.createBinauralNodes(this.ctx, g, 196, 10));
    }
  }

  /**
   * Generates a seamless stereo-decorrelated buffer of Brown, Pink, or Velvet White noise
   */
  private createStereoNoiseBuffer(
    ctx: AudioContext,
    type: 'brown' | 'pink' | 'white',
    durationSeconds: number = 12
  ): AudioBuffer {
    const cacheKey = `${type}_${durationSeconds}_${ctx.sampleRate}`;
    const existing = this.cachedBuffers.get(cacheKey);
    if (existing) return existing;

    const length = ctx.sampleRate * durationSeconds;
    const buffer = ctx.createBuffer(2, length, ctx.sampleRate);

    for (let ch = 0; ch < 2; ch++) {
      const data = buffer.getChannelData(ch);
      if (type === 'brown') {
        let lastOut = 0.0;
        for (let i = 0; i < length; i++) {
          const white = Math.random() * 2 - 1;
          data[i] = (lastOut + 0.02 * white) / 1.02;
          lastOut = data[i];
          data[i] *= 2.6;
        }
      } else if (type === 'pink') {
        let b0 = 0,
          b1 = 0,
          b2 = 0,
          b3 = 0,
          b4 = 0,
          b5 = 0,
          b6 = 0;
        for (let i = 0; i < length; i++) {
          const white = Math.random() * 2 - 1;
          b0 = 0.99886 * b0 + white * 0.0555179;
          b1 = 0.99332 * b1 + white * 0.0750759;
          b2 = 0.969 * b2 + white * 0.153852;
          b3 = 0.8665 * b3 + white * 0.3104856;
          b4 = 0.55 * b4 + white * 0.5329522;
          b5 = -0.7616 * b5 - white * 0.016898;
          data[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.088;
          b6 = white * 0.115926;
        }
      } else {
        // Softly smoothed white noise (1-pole gentle smoothing so it's never razor-sharp)
        let prev = 0;
        for (let i = 0; i < length; i++) {
          const w = (Math.random() * 2 - 1) * 0.24;
          data[i] = prev * 0.28 + w * 0.72;
          prev = data[i];
        }
      }

      // Smooth equal-power crossfade on first/last 8192 samples to guarantee zero loop seam
      const fadeSamples = Math.min(8192, Math.floor(length * 0.06));
      for (let i = 0; i < fadeSamples; i++) {
        const t = i / fadeSamples;
        const fadeIn = Math.sin(t * Math.PI * 0.5);
        const fadeOut = Math.cos(t * Math.PI * 0.5);
        const endIdx = length - fadeSamples + i;
        data[i] = data[i] * fadeIn + data[endIdx] * fadeOut;
      }
    }

    this.cachedBuffers.set(cacheKey, buffer);
    return buffer;
  }

  // 1. Warm Harmonic Binaural Pad (Alpha / Beta / Theta)
  private startWarmBinauralPad(
    ctx: AudioContext,
    output: AudioNode,
    baseFreq: number,
    beatFreq: number
  ) {
    this.activeCleanupCallbacks.push(
      this.createBinauralNodes(ctx, output, baseFreq, beatFreq)
    );
  }

  private createBinauralNodes(
    ctx: AudioContext,
    output: AudioNode,
    baseFreq: number,
    beatFreq: number
  ): () => void {
    const oscL = ctx.createOscillator();
    const gainL = ctx.createGain();
    oscL.type = 'sine';
    oscL.frequency.setValueAtTime(baseFreq, ctx.currentTime);
    gainL.gain.setValueAtTime(0.16, ctx.currentTime);

    const oscR = ctx.createOscillator();
    const gainR = ctx.createGain();
    oscR.type = 'sine';
    oscR.frequency.setValueAtTime(baseFreq + beatFreq, ctx.currentTime);
    gainR.gain.setValueAtTime(0.16, ctx.currentTime);

    // Sub-octave warm foundation + Fifth harmonic pad with slow breathing LFO
    const subOsc = ctx.createOscillator();
    const fifthOsc = ctx.createOscillator();
    const padFilter = ctx.createBiquadFilter();
    const padGain = ctx.createGain();

    subOsc.type = 'triangle';
    subOsc.frequency.setValueAtTime(baseFreq * 0.5, ctx.currentTime);
    fifthOsc.type = 'sine';
    fifthOsc.frequency.setValueAtTime(baseFreq * 1.498, ctx.currentTime);

    padFilter.type = 'lowpass';
    padFilter.frequency.setValueAtTime(320, ctx.currentTime);
    padGain.gain.setValueAtTime(0.085, ctx.currentTime);

    const lfo = ctx.createOscillator();
    const lfoGain = ctx.createGain();
    lfo.type = 'sine';
    lfo.frequency.setValueAtTime(0.11, ctx.currentTime);
    lfoGain.gain.setValueAtTime(0.03, ctx.currentTime);
    lfo.connect(lfoGain);
    lfoGain.connect(padGain.gain);

    // Soft pink air texture underneath
    const airSource = ctx.createBufferSource();
    airSource.buffer = this.createStereoNoiseBuffer(ctx, 'pink', 12);
    airSource.loop = true;
    const airFilter = ctx.createBiquadFilter();
    airFilter.type = 'lowpass';
    airFilter.frequency.setValueAtTime(480, ctx.currentTime);
    const airGain = ctx.createGain();
    airGain.gain.setValueAtTime(0.06, ctx.currentTime);

    airSource.connect(airFilter);
    airFilter.connect(airGain);
    airGain.connect(output);

    if (ctx.createStereoPanner) {
      const panL = ctx.createStereoPanner();
      panL.pan.setValueAtTime(-0.85, ctx.currentTime);
      oscL.connect(gainL);
      gainL.connect(panL);
      panL.connect(output);

      const panR = ctx.createStereoPanner();
      panR.pan.setValueAtTime(0.85, ctx.currentTime);
      oscR.connect(gainR);
      gainR.connect(panR);
      panR.connect(output);
    } else {
      oscL.connect(gainL);
      gainL.connect(output);
      oscR.connect(gainR);
      gainR.connect(output);
    }

    subOsc.connect(padFilter);
    fifthOsc.connect(padFilter);
    padFilter.connect(padGain);
    padGain.connect(output);

    oscL.start();
    oscR.start();
    subOsc.start();
    fifthOsc.start();
    lfo.start();
    airSource.start();

    return () => {
      try {
        oscL.stop();
        oscR.stop();
        subOsc.stop();
        fifthOsc.stop();
        lfo.stop();
        airSource.stop();
      } catch {}
    };
  }

  // 2. Stereo Decorrelated Brown Noise
  private startStereoBrownNoise(ctx: AudioContext, output: AudioNode) {
    const source = ctx.createBufferSource();
    source.buffer = this.createStereoNoiseBuffer(ctx, 'brown', 12);
    source.loop = true;

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(360, ctx.currentTime);

    const lfo = ctx.createOscillator();
    const lfoGain = ctx.createGain();
    lfo.frequency.setValueAtTime(0.07, ctx.currentTime);
    lfoGain.gain.setValueAtTime(55, ctx.currentTime);
    lfo.connect(lfoGain);
    lfoGain.connect(filter.frequency);

    source.connect(filter);
    filter.connect(output);
    source.start();
    lfo.start();

    this.activeCleanupCallbacks.push(() => {
      try {
        source.stop();
        lfo.stop();
      } catch {}
    });
  }

  // 3. Stereo Velvet Pink Noise
  private startStereoPinkNoise(ctx: AudioContext, output: AudioNode) {
    const source = ctx.createBufferSource();
    source.buffer = this.createStereoNoiseBuffer(ctx, 'pink', 12);
    source.loop = true;

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(1650, ctx.currentTime);

    source.connect(filter);
    filter.connect(output);
    source.start();

    this.activeCleanupCallbacks.push(() => {
      try {
        source.stop();
      } catch {}
    });
  }

  // 3b. Stereo Silky White Noise (Blended with warm Pink body for fatigue-free masking)
  private startStereoWhiteNoise(ctx: AudioContext, output: AudioNode) {
    const whiteSource = ctx.createBufferSource();
    whiteSource.buffer = this.createStereoNoiseBuffer(ctx, 'white', 12);
    whiteSource.loop = true;

    const pinkFoundation = ctx.createBufferSource();
    pinkFoundation.buffer = this.createStereoNoiseBuffer(ctx, 'pink', 12);
    pinkFoundation.loop = true;

    const hpFilter = ctx.createBiquadFilter();
    hpFilter.type = 'highpass';
    hpFilter.frequency.setValueAtTime(160, ctx.currentTime);

    const lpFilter = ctx.createBiquadFilter();
    lpFilter.type = 'lowpass';
    lpFilter.frequency.setValueAtTime(3100, ctx.currentTime);
    lpFilter.Q.setValueAtTime(0.35, ctx.currentTime);

    const whiteGain = ctx.createGain();
    whiteGain.gain.setValueAtTime(0.42, ctx.currentTime);

    const pinkFilter = ctx.createBiquadFilter();
    pinkFilter.type = 'lowpass';
    pinkFilter.frequency.setValueAtTime(750, ctx.currentTime);
    const pinkGain = ctx.createGain();
    pinkGain.gain.setValueAtTime(0.32, ctx.currentTime);

    whiteSource.connect(hpFilter);
    hpFilter.connect(lpFilter);
    lpFilter.connect(whiteGain);
    whiteGain.connect(output);

    pinkFoundation.connect(pinkFilter);
    pinkFilter.connect(pinkGain);
    pinkGain.connect(output);

    whiteSource.start();
    pinkFoundation.start();

    this.activeCleanupCallbacks.push(() => {
      try {
        whiteSource.stop();
        pinkFoundation.stop();
      } catch {}
    });
  }

  // 4. Multi-Layered Organic Rain & Optional Distant Thunderstorm (Zero artificial sine blips!)
  private startRealisticRain(ctx: AudioContext, output: AudioNode, withThunder: boolean) {
    this.activeCleanupCallbacks.push(this.createRainNodes(ctx, output, withThunder));
  }

  private createRainNodes(
    ctx: AudioContext,
    output: AudioNode,
    withThunder: boolean = false
  ): () => void {
    // Layer A: Steady warm rainfall patter (Stereo Pink Noise through broad bandpass)
    const rainBed = ctx.createBufferSource();
    rainBed.buffer = this.createStereoNoiseBuffer(ctx, 'pink', 12);
    rainBed.loop = true;

    const bedFilter = ctx.createBiquadFilter();
    bedFilter.type = 'bandpass';
    bedFilter.frequency.setValueAtTime(1050, ctx.currentTime);
    bedFilter.Q.setValueAtTime(0.42, ctx.currentTime);

    const bedGain = ctx.createGain();
    bedGain.gain.setValueAtTime(0.58, ctx.currentTime);

    // Slow organic wind-swell LFO
    const swellLfo = ctx.createOscillator();
    const swellLfoGain = ctx.createGain();
    swellLfo.frequency.setValueAtTime(0.075, ctx.currentTime);
    swellLfoGain.gain.setValueAtTime(0.11, ctx.currentTime);
    swellLfo.connect(swellLfoGain);
    swellLfoGain.connect(bedGain.gain);

    rainBed.connect(bedFilter);
    bedFilter.connect(bedGain);
    bedGain.connect(output);

    // Layer B: Roof / window acoustic body (Warm Brown Noise)
    const deepRain = ctx.createBufferSource();
    deepRain.buffer = this.createStereoNoiseBuffer(ctx, 'brown', 12);
    deepRain.loop = true;
    const deepFilter = ctx.createBiquadFilter();
    deepFilter.type = 'lowpass';
    deepFilter.frequency.setValueAtTime(360, ctx.currentTime);
    const deepGain = ctx.createGain();
    deepGain.gain.setValueAtTime(0.36, ctx.currentTime);

    deepRain.connect(deepFilter);
    deepFilter.connect(deepGain);
    deepGain.connect(output);

    // Layer C: High soft mist shimmer (very low level)
    const mistSource = ctx.createBufferSource();
    mistSource.buffer = this.createStereoNoiseBuffer(ctx, 'white', 12);
    mistSource.loop = true;
    const mistFilter = ctx.createBiquadFilter();
    mistFilter.type = 'bandpass';
    mistFilter.frequency.setValueAtTime(2600, ctx.currentTime);
    mistFilter.Q.setValueAtTime(0.8, ctx.currentTime);
    const mistGain = ctx.createGain();
    mistGain.gain.setValueAtTime(0.09, ctx.currentTime);

    mistSource.connect(mistFilter);
    mistFilter.connect(mistGain);
    mistGain.connect(output);

    rainBed.start();
    deepRain.start();
    mistSource.start();
    swellLfo.start();

    // Layer D: Organic Filtered-Noise Raindrops on Windowpane (No sine wave beeps!)
    const noiseBuf = this.createStereoNoiseBuffer(ctx, 'pink', 12);
    const dropletInterval = window.setInterval(() => {
      if (!this.ctx || this.ctx.state !== 'running') return;
      if (Math.random() > 0.72) return;

      const now = ctx.currentTime;
      const dropBurst = ctx.createBufferSource();
      dropBurst.buffer = noiseBuf;

      // Natural water impact formant filter (soft wooden/glass tap)
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      const centerFreq = 1400 + Math.random() * 1600;
      bp.frequency.setValueAtTime(centerFreq, now);
      bp.Q.setValueAtTime(1.8 + Math.random() * 1.2, now);

      const env = ctx.createGain();
      const peak = 0.025 + Math.random() * 0.04;
      env.gain.setValueAtTime(0.0001, now);
      env.gain.linearRampToValueAtTime(peak, now + 0.003);
      env.gain.exponentialRampToValueAtTime(0.0001, now + 0.024 + Math.random() * 0.015);

      if (ctx.createStereoPanner) {
        const panner = ctx.createStereoPanner();
        panner.pan.setValueAtTime(Math.random() * 1.7 - 0.85, now);
        dropBurst.connect(bp);
        bp.connect(env);
        env.connect(panner);
        panner.connect(output);
      } else {
        dropBurst.connect(bp);
        bp.connect(env);
        env.connect(output);
      }

      const randomOffset = Math.random() * 10;
      dropBurst.start(now, randomOffset, 0.05);
    }, 85);

    // Layer E: Optional Distant Rolling Thunder (for 'thunderstorm' mode)
    let thunderInterval: number | null = null;
    if (withThunder) {
      const brownBuf = this.createStereoNoiseBuffer(ctx, 'brown', 12);
      const triggerThunder = () => {
        if (!this.ctx || this.ctx.state !== 'running') return;
        const now = ctx.currentTime;
        const rumble = ctx.createBufferSource();
        rumble.buffer = brownBuf;
        rumble.loop = true;

        const rumbleFilter = ctx.createBiquadFilter();
        rumbleFilter.type = 'lowpass';
        rumbleFilter.frequency.setValueAtTime(75 + Math.random() * 45, now);
        rumbleFilter.frequency.linearRampToValueAtTime(48, now + 5.5);

        const rumbleGain = ctx.createGain();
        const maxRumble = 0.42 + Math.random() * 0.25;
        rumbleGain.gain.setValueAtTime(0.001, now);
        rumbleGain.gain.linearRampToValueAtTime(maxRumble, now + 0.9);
        rumbleGain.gain.linearRampToValueAtTime(maxRumble * 0.65, now + 2.4);
        rumbleGain.gain.exponentialRampToValueAtTime(0.0005, now + 5.8);

        rumble.connect(rumbleFilter);
        rumbleFilter.connect(rumbleGain);
        rumbleGain.connect(output);

        rumble.start(now, Math.random() * 6, 6.0);
      };

      // Initial distant thunder after 2.5s
      const firstTimer = window.setTimeout(triggerThunder, 2500);
      thunderInterval = window.setInterval(() => {
        if (Math.random() > 0.35) {
          triggerThunder();
        }
      }, 11000);

      return () => {
        window.clearTimeout(firstTimer);
        window.clearInterval(dropletInterval);
        if (thunderInterval !== null) window.clearInterval(thunderInterval);
        try {
          rainBed.stop();
          deepRain.stop();
          mistSource.stop();
          swellLfo.stop();
        } catch {}
      };
    }

    return () => {
      window.clearInterval(dropletInterval);
      try {
        rainBed.stop();
        deepRain.stop();
        mistSource.stop();
        swellLfo.stop();
      } catch {}
    };
  }

  // 5. Rolling Stereo Ocean Waves (Shore wash + Foam + Deep Undertow)
  private startOceanWaves(ctx: AudioContext, output: AudioNode) {
    const waveSource = ctx.createBufferSource();
    waveSource.buffer = this.createStereoNoiseBuffer(ctx, 'pink', 12);
    waveSource.loop = true;

    const subWaveSource = ctx.createBufferSource();
    subWaveSource.buffer = this.createStereoNoiseBuffer(ctx, 'brown', 12);
    subWaveSource.loop = true;

    const waveFilter = ctx.createBiquadFilter();
    waveFilter.type = 'lowpass';
    waveFilter.frequency.setValueAtTime(380, ctx.currentTime);
    waveFilter.Q.setValueAtTime(0.65, ctx.currentTime);

    const waveGain = ctx.createGain();
    waveGain.gain.setValueAtTime(0.42, ctx.currentTime);

    // Primary wave rhythm (~9s per wave cycle)
    const waveLfo = ctx.createOscillator();
    const waveLfoFilterGain = ctx.createGain();
    const waveLfoAmpGain = ctx.createGain();
    waveLfo.type = 'sine';
    waveLfo.frequency.setValueAtTime(0.11, ctx.currentTime);

    waveLfoFilterGain.gain.setValueAtTime(290, ctx.currentTime);
    waveLfoAmpGain.gain.setValueAtTime(0.22, ctx.currentTime);

    waveLfo.connect(waveLfoFilterGain);
    waveLfoFilterGain.connect(waveFilter.frequency);

    waveLfo.connect(waveLfoAmpGain);
    waveLfoAmpGain.connect(waveGain.gain);

    // Secondary receding shore foam (out of phase)
    const foamSource = ctx.createBufferSource();
    foamSource.buffer = this.createStereoNoiseBuffer(ctx, 'pink', 12);
    foamSource.loop = true;
    const foamFilter = ctx.createBiquadFilter();
    foamFilter.type = 'bandpass';
    foamFilter.frequency.setValueAtTime(920, ctx.currentTime);
    foamFilter.Q.setValueAtTime(0.7, ctx.currentTime);
    const foamGain = ctx.createGain();
    foamGain.gain.setValueAtTime(0.12, ctx.currentTime);

    const foamLfo = ctx.createOscillator();
    const foamLfoGain = ctx.createGain();
    foamLfo.type = 'sine';
    foamLfo.frequency.setValueAtTime(0.11, ctx.currentTime);
    foamLfoGain.gain.setValueAtTime(0.08, ctx.currentTime);
    foamLfo.connect(foamLfoGain);
    foamLfoGain.connect(foamGain.gain);

    waveSource.connect(waveFilter);
    subWaveSource.connect(waveFilter);
    waveFilter.connect(waveGain);
    waveGain.connect(output);

    foamSource.connect(foamFilter);
    foamFilter.connect(foamGain);
    foamGain.connect(output);

    waveSource.start();
    subWaveSource.start();
    foamSource.start();
    waveLfo.start();
    foamLfo.start(ctx.currentTime + 2.2);

    this.activeCleanupCallbacks.push(() => {
      try {
        waveSource.stop();
        subWaveSource.stop();
        foamSource.stop();
        waveLfo.stop();
        foamLfo.stop();
      } catch {}
    });
  }

  // 6. Warm Crackling Fireplace (Hearth draft + Flame flicker + Multi-band wood snaps)
  private startCracklingFireplace(ctx: AudioContext, output: AudioNode) {
    this.activeCleanupCallbacks.push(this.createFireplaceNodes(ctx, output));
  }

  private createFireplaceNodes(ctx: AudioContext, output: AudioNode): () => void {
    // Layer 1: Warm hearth draft
    const hearthSource = ctx.createBufferSource();
    hearthSource.buffer = this.createStereoNoiseBuffer(ctx, 'brown', 12);
    hearthSource.loop = true;

    const hearthFilter = ctx.createBiquadFilter();
    hearthFilter.type = 'lowpass';
    hearthFilter.frequency.setValueAtTime(195, ctx.currentTime);

    const hearthGain = ctx.createGain();
    hearthGain.gain.setValueAtTime(0.52, ctx.currentTime);

    // Layer 2: Soft flame body
    const flameSource = ctx.createBufferSource();
    flameSource.buffer = this.createStereoNoiseBuffer(ctx, 'pink', 12);
    flameSource.loop = true;
    const flameFilter = ctx.createBiquadFilter();
    flameFilter.type = 'bandpass';
    flameFilter.frequency.setValueAtTime(540, ctx.currentTime);
    flameFilter.Q.setValueAtTime(0.9, ctx.currentTime);
    const flameGain = ctx.createGain();
    flameGain.gain.setValueAtTime(0.16, ctx.currentTime);

    const flickerLfo = ctx.createOscillator();
    const flickerGain = ctx.createGain();
    flickerLfo.frequency.setValueAtTime(0.24, ctx.currentTime);
    flickerGain.gain.setValueAtTime(0.09, ctx.currentTime);
    flickerLfo.connect(flickerGain);
    flickerGain.connect(hearthGain.gain);

    hearthSource.connect(hearthFilter);
    hearthFilter.connect(hearthGain);
    hearthGain.connect(output);

    flameSource.connect(flameFilter);
    flameFilter.connect(flameGain);
    flameGain.connect(output);

    hearthSource.start();
    flameSource.start();
    flickerLfo.start();

    // Layer 3: Organic wood crackles and warm ember pops
    const crackleBuffer = this.createStereoNoiseBuffer(ctx, 'pink', 12);
    const crackleInterval = window.setInterval(() => {
      if (!this.ctx || this.ctx.state !== 'running') return;
      if (Math.random() > 0.58) return;

      const now = ctx.currentTime;
      const burst = ctx.createBufferSource();
      burst.buffer = crackleBuffer;

      const bandpass = ctx.createBiquadFilter();
      bandpass.type = 'bandpass';
      bandpass.frequency.setValueAtTime(1350 + Math.random() * 1900, now);
      bandpass.Q.setValueAtTime(2.2, now);

      const env = ctx.createGain();
      const amp = 0.035 + Math.random() * 0.065;
      env.gain.setValueAtTime(0.0005, now);
      env.gain.linearRampToValueAtTime(amp, now + 0.0025);
      env.gain.exponentialRampToValueAtTime(0.0003, now + 0.025 + Math.random() * 0.025);

      if (ctx.createStereoPanner) {
        const pan = ctx.createStereoPanner();
        pan.pan.setValueAtTime(Math.random() * 1.1 - 0.55, now);
        burst.connect(bandpass);
        bandpass.connect(env);
        env.connect(pan);
        pan.connect(output);
      } else {
        burst.connect(bandpass);
        bandpass.connect(env);
        env.connect(output);
      }

      burst.start(now, Math.random() * 8, 0.06);
    }, 125);

    return () => {
      window.clearInterval(crackleInterval);
      try {
        hearthSource.stop();
        flameSource.stop();
        flickerLfo.stop();
      } catch {}
    };
  }

  // 7. 3D Forest Canopy Breeze, Soft Brook & Distant Birdsong
  private startForestWind(ctx: AudioContext, output: AudioNode) {
    this.activeCleanupCallbacks.push(this.createForestNodes(ctx, output));
  }

  private createForestNodes(ctx: AudioContext, output: AudioNode): () => void {
    // Layer A: Wide canopy leaf rustle (Low-Q natural air filters, no hollow resonance!)
    const windSource = ctx.createBufferSource();
    windSource.buffer = this.createStereoNoiseBuffer(ctx, 'pink', 12);
    windSource.loop = true;

    const canopyFilterL = ctx.createBiquadFilter();
    canopyFilterL.type = 'bandpass';
    canopyFilterL.frequency.setValueAtTime(520, ctx.currentTime);
    canopyFilterL.Q.setValueAtTime(0.65, ctx.currentTime);

    const canopyFilterR = ctx.createBiquadFilter();
    canopyFilterR.type = 'bandpass';
    canopyFilterR.frequency.setValueAtTime(980, ctx.currentTime);
    canopyFilterR.Q.setValueAtTime(0.7, ctx.currentTime);

    const lfoL = ctx.createOscillator();
    const lfoLGain = ctx.createGain();
    lfoL.frequency.setValueAtTime(0.065, ctx.currentTime);
    lfoLGain.gain.setValueAtTime(190, ctx.currentTime);
    lfoL.connect(lfoLGain);
    lfoLGain.connect(canopyFilterL.frequency);

    const lfoR = ctx.createOscillator();
    const lfoRGain = ctx.createGain();
    lfoR.frequency.setValueAtTime(0.088, ctx.currentTime);
    lfoRGain.gain.setValueAtTime(280, ctx.currentTime);
    lfoR.connect(lfoRGain);
    lfoRGain.connect(canopyFilterR.frequency);

    // Layer B: Warm forest floor air bed
    const floorSource = ctx.createBufferSource();
    floorSource.buffer = this.createStereoNoiseBuffer(ctx, 'brown', 12);
    floorSource.loop = true;
    const floorFilter = ctx.createBiquadFilter();
    floorFilter.type = 'lowpass';
    floorFilter.frequency.setValueAtTime(260, ctx.currentTime);
    const floorGain = ctx.createGain();
    floorGain.gain.setValueAtTime(0.28, ctx.currentTime);

    const windGain = ctx.createGain();
    windGain.gain.setValueAtTime(0.46, ctx.currentTime);

    windSource.connect(canopyFilterL);
    windSource.connect(canopyFilterR);
    canopyFilterL.connect(windGain);
    canopyFilterR.connect(windGain);
    windGain.connect(output);

    floorSource.connect(floorFilter);
    floorFilter.connect(floorGain);
    floorGain.connect(output);

    windSource.start();
    floorSource.start();
    lfoL.start();
    lfoR.start();

    // Layer C: Gentle distant forest birdsong (soft syrinx glides filtered through warm air)
    const triggerDistantBird = () => {
      if (!this.ctx || this.ctx.state !== 'running') return;
      const now = ctx.currentTime;
      const basePitch = 1650 + Math.random() * 750;
      const notesCount = Math.random() > 0.45 ? 2 : 3;

      const birdAirFilter = ctx.createBiquadFilter();
      birdAirFilter.type = 'lowpass';
      birdAirFilter.frequency.setValueAtTime(2400, now);

      let targetNode: AudioNode = output;
      if (ctx.createStereoPanner) {
        const panner = ctx.createStereoPanner();
        panner.pan.setValueAtTime(Math.random() * 1.5 - 0.75, now);
        birdAirFilter.connect(panner);
        panner.connect(output);
      } else {
        birdAirFilter.connect(output);
      }
      targetNode = birdAirFilter;

      for (let n = 0; n < notesCount; n++) {
        const startT = now + n * 0.16;
        const dur = 0.09 + Math.random() * 0.04;
        const osc = ctx.createOscillator();
        const g = ctx.createGain();

        osc.type = 'sine';
        const fStart = basePitch * (1 + n * 0.08);
        const fEnd = fStart * (n === notesCount - 1 ? 0.88 : 1.12);
        osc.frequency.setValueAtTime(fStart, startT);
        osc.frequency.exponentialRampToValueAtTime(fEnd, startT + dur);

        g.gain.setValueAtTime(0.0001, startT);
        g.gain.linearRampToValueAtTime(0.014, startT + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, startT + dur);

        osc.connect(g);
        g.connect(targetNode);
        osc.start(startT);
        osc.stop(startT + dur + 0.01);
      }
    };

    const birdInterval = window.setInterval(() => {
      if (Math.random() > 0.4) {
        triggerDistantBird();
      }
    }, 4200);

    return () => {
      window.clearInterval(birdInterval);
      try {
        windSource.stop();
        floorSource.stop();
        lfoL.stop();
        lfoR.stop();
      } catch {}
    };
  }

  // 8. Cozy Library / Study Room Ambience with Subtle Page Turns
  private startLibraryAmbience(ctx: AudioContext, output: AudioNode) {
    const roomSource = ctx.createBufferSource();
    roomSource.buffer = this.createStereoNoiseBuffer(ctx, 'brown', 12);
    roomSource.loop = true;

    const murmurSource = ctx.createBufferSource();
    murmurSource.buffer = this.createStereoNoiseBuffer(ctx, 'pink', 12);
    murmurSource.loop = true;

    const roomFilter = ctx.createBiquadFilter();
    roomFilter.type = 'lowpass';
    roomFilter.frequency.setValueAtTime(240, ctx.currentTime);

    const murmurFilter = ctx.createBiquadFilter();
    murmurFilter.type = 'bandpass';
    murmurFilter.frequency.setValueAtTime(390, ctx.currentTime);
    murmurFilter.Q.setValueAtTime(1.1, ctx.currentTime);

    const murmurLfo = ctx.createOscillator();
    const murmurLfoGain = ctx.createGain();
    murmurLfo.frequency.setValueAtTime(0.14, ctx.currentTime);
    murmurLfoGain.gain.setValueAtTime(85, ctx.currentTime);
    murmurLfo.connect(murmurLfoGain);
    murmurLfoGain.connect(murmurFilter.frequency);

    const mixGain = ctx.createGain();
    mixGain.gain.setValueAtTime(0.46, ctx.currentTime);

    roomSource.connect(roomFilter);
    roomFilter.connect(mixGain);

    murmurSource.connect(murmurFilter);
    murmurFilter.connect(mixGain);

    mixGain.connect(output);

    roomSource.start();
    murmurSource.start();
    murmurLfo.start();

    // Subtle periodic page-turn rustle
    const pinkBuf = this.createStereoNoiseBuffer(ctx, 'pink', 12);
    const pageInterval = window.setInterval(() => {
      if (!this.ctx || this.ctx.state !== 'running') return;
      if (Math.random() > 0.45) return;

      const now = ctx.currentTime;
      const pageRustle = ctx.createBufferSource();
      pageRustle.buffer = pinkBuf;

      const filter = ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(1500, now);
      filter.frequency.linearRampToValueAtTime(950, now + 0.14);
      filter.Q.setValueAtTime(1.4, now);

      const env = ctx.createGain();
      env.gain.setValueAtTime(0.0001, now);
      env.gain.linearRampToValueAtTime(0.025, now + 0.04);
      env.gain.exponentialRampToValueAtTime(0.0001, now + 0.16);

      pageRustle.connect(filter);
      filter.connect(env);
      env.connect(output);

      pageRustle.start(now, Math.random() * 8, 0.18);
    }, 5500);

    this.activeCleanupCallbacks.push(() => {
      window.clearInterval(pageInterval);
      try {
        roomSource.stop();
        murmurSource.stop();
        murmurLfo.stop();
      } catch {}
    });
  }

  // 9. Generative Lo-Fi Study Chords (Warm Rhodes Seventh Progressions + Vinyl Air)
  private startLofiStudyChords(ctx: AudioContext, output: AudioNode) {
    // Cozy vinyl / tape room air
    const vinylSource = ctx.createBufferSource();
    vinylSource.buffer = this.createStereoNoiseBuffer(ctx, 'pink', 12);
    vinylSource.loop = true;

    const vinylFilter = ctx.createBiquadFilter();
    vinylFilter.type = 'bandpass';
    vinylFilter.frequency.setValueAtTime(780, ctx.currentTime);
    vinylFilter.Q.setValueAtTime(0.7, ctx.currentTime);

    const vinylGain = ctx.createGain();
    vinylGain.gain.setValueAtTime(0.08, ctx.currentTime);

    vinylSource.connect(vinylFilter);
    vinylFilter.connect(vinylGain);
    vinylGain.connect(output);
    vinylSource.start();

    // Warm Rhodes-like chord progression: Fmaj7 -> Em7 -> Dm7 -> Cmaj7
    const chords = [
      [174.61, 220.0, 261.63, 329.63], // Fmaj7
      [164.81, 196.0, 246.94, 293.66], // Em7
      [146.83, 174.61, 220.0, 261.63], // Dm7
      [130.81, 164.81, 196.0, 246.94], // Cmaj7
    ];

    let chordIdx = 0;
    const playWarmChord = () => {
      if (!this.ctx || this.ctx.state !== 'running') return;
      const now = ctx.currentTime;
      const notes = chords[chordIdx % chords.length];
      chordIdx++;

      const chordFilter = ctx.createBiquadFilter();
      chordFilter.type = 'lowpass';
      chordFilter.frequency.setValueAtTime(620, now);
      chordFilter.frequency.exponentialRampToValueAtTime(340, now + 4.2);
      chordFilter.connect(output);

      notes.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const sub = ctx.createOscillator();
        const env = ctx.createGain();

        osc.type = 'sine';
        sub.type = 'triangle';
        // Slight analog pitch drift
        const detune = (Math.random() - 0.5) * 4;
        osc.frequency.setValueAtTime(freq, now);
        osc.detune.setValueAtTime(detune, now);
        sub.frequency.setValueAtTime(freq * 0.5, now);

        const stagger = idx * 0.045;
        env.gain.setValueAtTime(0.0001, now + stagger);
        env.gain.linearRampToValueAtTime(0.055, now + stagger + 0.35);
        env.gain.exponentialRampToValueAtTime(0.0005, now + 4.6);

        osc.connect(env);
        sub.connect(env);
        env.connect(chordFilter);

        osc.start(now + stagger);
        sub.start(now + stagger);
        osc.stop(now + 4.7);
        sub.stop(now + 4.7);
      });
    };

    playWarmChord();
    const chordTimer = window.setInterval(playWarmChord, 4600);

    this.activeCleanupCallbacks.push(() => {
      window.clearInterval(chordTimer);
      try {
        vinylSource.stop();
      } catch {}
    });
  }

  // 10. Summer Night Breeze & Gentle Distant Crickets
  private startNightCrickets(ctx: AudioContext, output: AudioNode) {
    const nightAir = ctx.createBufferSource();
    nightAir.buffer = this.createStereoNoiseBuffer(ctx, 'brown', 12);
    nightAir.loop = true;

    const airFilter = ctx.createBiquadFilter();
    airFilter.type = 'lowpass';
    airFilter.frequency.setValueAtTime(260, ctx.currentTime);
    const airGain = ctx.createGain();
    airGain.gain.setValueAtTime(0.32, ctx.currentTime);

    nightAir.connect(airFilter);
    airFilter.connect(airGain);
    airGain.connect(output);
    nightAir.start();

    const triggerCricketPulse = () => {
      if (!this.ctx || this.ctx.state !== 'running') return;
      const now = ctx.currentTime;
      const carrierFreq = 3650 + (Math.random() - 0.5) * 140;

      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(3900, now);
      filter.connect(output);

      // 3 soft micro-pulses per chirp
      for (let p = 0; p < 3; p++) {
        const startT = now + p * 0.045;
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(carrierFreq, startT);

        g.gain.setValueAtTime(0.0001, startT);
        g.gain.linearRampToValueAtTime(0.007, startT + 0.01);
        g.gain.exponentialRampToValueAtTime(0.0001, startT + 0.032);

        osc.connect(g);
        g.connect(filter);
        osc.start(startT);
        osc.stop(startT + 0.035);
      }
    };

    const cricketTimer = window.setInterval(() => {
      if (Math.random() > 0.25) {
        triggerCricketPulse();
      }
    }, 950);

    this.activeCleanupCallbacks.push(() => {
      window.clearInterval(cricketTimer);
      try {
        nightAir.stop();
      } catch {}
    });
  }

  // 11. Tibetan Singing Bowls & 432 Hz Harmonic Resonance
  private startSingingBowls(ctx: AudioContext, output: AudioNode) {
    const drone1 = ctx.createOscillator();
    const drone2 = ctx.createOscillator();
    const droneGain = ctx.createGain();

    drone1.type = 'sine';
    drone1.frequency.setValueAtTime(216, ctx.currentTime);
    drone2.type = 'sine';
    drone2.frequency.setValueAtTime(324, ctx.currentTime);
    droneGain.gain.setValueAtTime(0.08, ctx.currentTime);

    drone1.connect(droneGain);
    drone2.connect(droneGain);
    droneGain.connect(output);

    drone1.start();
    drone2.start();

    const strikeBowl = (fundamentalFreq: number) => {
      if (!this.ctx || this.ctx.state !== 'running') return;
      const now = ctx.currentTime;
      const partials = [1, 2.756, 5.404];
      const gains = [0.13, 0.04, 0.012];
      const decays = [5.8, 3.9, 2.3];

      partials.forEach((ratio, idx) => {
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(fundamentalFreq * ratio, now);

        g.gain.setValueAtTime(0.0001, now);
        g.gain.linearRampToValueAtTime(gains[idx], now + 0.08);
        g.gain.exponentialRampToValueAtTime(0.0001, now + decays[idx]);

        osc.connect(g);
        g.connect(output);
        osc.start(now);
        osc.stop(now + decays[idx] + 0.1);
      });
    };

    strikeBowl(432);

    const bowlNotes = [432, 324, 288, 384, 432];
    let noteIdx = 1;
    const bowlInterval = window.setInterval(() => {
      strikeBowl(bowlNotes[noteIdx % bowlNotes.length]);
      noteIdx++;
    }, 6500);

    this.activeCleanupCallbacks.push(() => {
      window.clearInterval(bowlInterval);
      try {
        drone1.stop();
        drone2.stop();
      } catch {}
    });
  }
}

export const ambientAudioService = new AmbientAudioEngine();
