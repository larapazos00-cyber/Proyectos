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

  /**
   * Generates a warm, natural stereo acoustic impulse response (early reflections + velvet diffuse tail)
   * so raindrops, wood crackles, birdsong, and chords sit inside a realistic 3D physical space.
   */
  private createAcousticReverbNode(
    ctx: AudioContext,
    decaySeconds: number = 1.85,
    wetMix: number = 0.24,
    destination: AudioNode
  ): { input: GainNode; cleanup: () => void } {
    const input = ctx.createGain();
    const dryGain = ctx.createGain();
    const wetGain = ctx.createGain();
    dryGain.gain.setValueAtTime(1.0, ctx.currentTime);
    wetGain.gain.setValueAtTime(wetMix, ctx.currentTime);

    const cacheKey = `ir_${decaySeconds}_${ctx.sampleRate}`;
    let irBuffer = this.cachedBuffers.get(cacheKey);
    if (!irBuffer) {
      const length = Math.floor(ctx.sampleRate * decaySeconds);
      irBuffer = ctx.createBuffer(2, length, ctx.sampleRate);
      const earlyTapTimes = [0.011, 0.019, 0.029, 0.043, 0.061, 0.083];
      const earlyTapGains = [0.48, 0.36, 0.28, 0.21, 0.15, 0.11];

      for (let ch = 0; ch < 2; ch++) {
        const data = irBuffer.getChannelData(ch);
        // Early room/canopy reflections
        earlyTapTimes.forEach((tapSec, idx) => {
          const jitter = (ch === 0 ? -0.0015 : 0.0018) * (idx + 1);
          const sampleIdx = Math.floor((tapSec + jitter) * ctx.sampleRate);
          if (sampleIdx > 0 && sampleIdx < length) {
            data[sampleIdx] += earlyTapGains[idx] * (ch % 2 === idx % 2 ? 1 : -0.85);
          }
        });

        // Smooth exponentially decaying LP-filtered diffuse tail
        let lp = 0;
        for (let i = 0; i < length; i++) {
          const t = i / length;
          const env = Math.pow(1 - t, 2.8) * Math.exp(-t * 3.4);
          const white = (Math.random() * 2 - 1) * 0.18;
          lp = lp * 0.76 + white * 0.24;
          data[i] += lp * env;
        }
      }
      this.cachedBuffers.set(cacheKey, irBuffer);
    }

    const convolver = ctx.createConvolver();
    convolver.buffer = irBuffer;

    const dampFilter = ctx.createBiquadFilter();
    dampFilter.type = 'lowpass';
    dampFilter.frequency.setValueAtTime(2900, ctx.currentTime);

    input.connect(dryGain);
    dryGain.connect(destination);

    input.connect(convolver);
    convolver.connect(dampFilter);
    dampFilter.connect(wetGain);
    wetGain.connect(destination);

    return {
      input,
      cleanup: () => {
        try {
          input.disconnect();
          convolver.disconnect();
          dampFilter.disconnect();
          dryGain.disconnect();
          wetGain.disconnect();
        } catch {}
      },
    };
  }

  /**
   * Schedules organic, non-robotic events using a randomized Poisson process
   */
  private scheduleOrganicLoop(
    minDelayMs: number,
    maxDelayMs: number,
    callback: () => void
  ): () => void {
    let active = true;
    let timerId: number | null = null;

    const tick = () => {
      if (!active) return;
      if (this.ctx && this.ctx.state === 'running') {
        callback();
      }
      // Exponential-weighted random interval for natural clustering
      const u = Math.random();
      const skewed = Math.pow(u, 1.35);
      const nextDelay = minDelayMs + skewed * (maxDelayMs - minDelayMs);
      timerId = window.setTimeout(tick, nextDelay);
    };

    timerId = window.setTimeout(tick, minDelayMs + Math.random() * (maxDelayMs - minDelayMs) * 0.5);

    return () => {
      active = false;
      if (timerId !== null) {
        window.clearTimeout(timerId);
      }
    };
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
    filter.frequency.setValueAtTime(340, ctx.currentTime);

    const warmthShelf = ctx.createBiquadFilter();
    warmthShelf.type = 'lowshelf';
    warmthShelf.frequency.setValueAtTime(140, ctx.currentTime);
    warmthShelf.gain.setValueAtTime(3.2, ctx.currentTime);

    const lfo = ctx.createOscillator();
    const lfoGain = ctx.createGain();
    lfo.frequency.setValueAtTime(0.065, ctx.currentTime);
    lfoGain.gain.setValueAtTime(45, ctx.currentTime);
    lfo.connect(lfoGain);
    lfoGain.connect(filter.frequency);

    source.connect(filter);
    filter.connect(warmthShelf);
    warmthShelf.connect(output);
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
    filter.frequency.setValueAtTime(1550, ctx.currentTime);

    const notch = ctx.createBiquadFilter();
    notch.type = 'peaking';
    notch.frequency.setValueAtTime(2400, ctx.currentTime);
    notch.Q.setValueAtTime(1.1, ctx.currentTime);
    notch.gain.setValueAtTime(-4.5, ctx.currentTime);

    source.connect(filter);
    filter.connect(notch);
    notch.connect(output);
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

  // 4. Multi-Layered 3D Acoustic Rain & Distant Rolling Thunderstorm
  private startRealisticRain(ctx: AudioContext, output: AudioNode, withThunder: boolean) {
    this.activeCleanupCallbacks.push(this.createRainNodes(ctx, output, withThunder));
  }

  private createRainNodes(
    ctx: AudioContext,
    output: AudioNode,
    withThunder: boolean = false
  ): () => void {
    const space = this.createAcousticReverbNode(ctx, withThunder ? 2.4 : 1.6, 0.28, output);

    // Layer A: Steady warm rainfall on leaves & pavement (Dual-band stereo Pink Noise)
    const rainBed = ctx.createBufferSource();
    rainBed.buffer = this.createStereoNoiseBuffer(ctx, 'pink', 12);
    rainBed.loop = true;

    const bedFilter = ctx.createBiquadFilter();
    bedFilter.type = 'bandpass';
    bedFilter.frequency.setValueAtTime(920, ctx.currentTime);
    bedFilter.Q.setValueAtTime(0.45, ctx.currentTime);

    const bedGain = ctx.createGain();
    bedGain.gain.setValueAtTime(0.52, ctx.currentTime);

    // Natural gusting rain intensity LFOs (two prime frequencies for non-repeating evolution)
    const swellLfo1 = ctx.createOscillator();
    const swellGain1 = ctx.createGain();
    swellLfo1.frequency.setValueAtTime(0.063, ctx.currentTime);
    swellGain1.gain.setValueAtTime(0.09, ctx.currentTime);
    swellLfo1.connect(swellGain1);
    swellGain1.connect(bedGain.gain);

    const swellLfo2 = ctx.createOscillator();
    const swellGain2 = ctx.createGain();
    swellLfo2.frequency.setValueAtTime(0.14, ctx.currentTime);
    swellGain2.gain.setValueAtTime(140, ctx.currentTime);
    swellLfo2.connect(swellGain2);
    swellGain2.connect(bedFilter.frequency);

    rainBed.connect(bedFilter);
    bedFilter.connect(bedGain);
    bedGain.connect(space.input);

    // Layer B: Warm roof & windowpane interior acoustic resonance (Brown Noise)
    const deepRain = ctx.createBufferSource();
    deepRain.buffer = this.createStereoNoiseBuffer(ctx, 'brown', 12);
    deepRain.loop = true;
    const deepFilter = ctx.createBiquadFilter();
    deepFilter.type = 'lowpass';
    deepFilter.frequency.setValueAtTime(320, ctx.currentTime);
    const deepGain = ctx.createGain();
    deepGain.gain.setValueAtTime(0.38, ctx.currentTime);

    deepRain.connect(deepFilter);
    deepFilter.connect(deepGain);
    deepGain.connect(output);

    // Layer C: Fine outdoor drizzle air (Velvet White + High Shelf cut)
    const mistSource = ctx.createBufferSource();
    mistSource.buffer = this.createStereoNoiseBuffer(ctx, 'white', 12);
    mistSource.loop = true;
    const mistFilter = ctx.createBiquadFilter();
    mistFilter.type = 'bandpass';
    mistFilter.frequency.setValueAtTime(2350, ctx.currentTime);
    mistFilter.Q.setValueAtTime(0.75, ctx.currentTime);
    const mistGain = ctx.createGain();
    mistGain.gain.setValueAtTime(0.075, ctx.currentTime);

    mistSource.connect(mistFilter);
    mistFilter.connect(mistGain);
    mistGain.connect(space.input);

    rainBed.start();
    deepRain.start();
    mistSource.start();
    swellLfo1.start();
    swellLfo2.start();

    // Layer D: Realistic Individual Water Droplets on Window Sill & Foliage
    // Combines a soft wood/glass tap + microscopic Minnaert bubble upward pitch-chirp
    const noiseBuf = this.createStereoNoiseBuffer(ctx, 'pink', 12);
    const stopDroplets = this.scheduleOrganicLoop(28, 135, () => {
      if (!this.ctx || this.ctx.state !== 'running') return;
      const now = ctx.currentTime;

      // Occasional micro-cluster of 2 droplets hitting closely
      const count = Math.random() > 0.76 ? 2 : 1;
      for (let d = 0; d < count; d++) {
        const t0 = now + d * (0.014 + Math.random() * 0.025);
        const dropBurst = ctx.createBufferSource();
        dropBurst.buffer = noiseBuf;

        // Impact surface filter (varies from dull leaf/wood at 700Hz to crisp glass/puddle at 2200Hz)
        const bp = ctx.createBiquadFilter();
        bp.type = 'bandpass';
        const startFreq = 750 + Math.random() * 1650;
        bp.frequency.setValueAtTime(startFreq, t0);
        bp.frequency.exponentialRampToValueAtTime(startFreq * 0.68, t0 + 0.022);
        bp.Q.setValueAtTime(2.4 + Math.random() * 2.2, t0);

        const env = ctx.createGain();
        const peak = 0.018 + Math.random() * 0.036;
        env.gain.setValueAtTime(0.0001, t0);
        env.gain.linearRampToValueAtTime(peak, t0 + 0.002);
        env.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.022 + Math.random() * 0.018);

        let target: AudioNode = space.input;
        if (ctx.createStereoPanner) {
          const panner = ctx.createStereoPanner();
          panner.pan.setValueAtTime(Math.random() * 1.8 - 0.9, t0);
          panner.connect(space.input);
          target = panner;
        }

        dropBurst.connect(bp);
        bp.connect(env);
        env.connect(target);
        dropBurst.start(t0, Math.random() * 10, 0.045);

        // 30% of droplets hit a shallow puddle, producing a subtle acoustic water bubble resonance
        if (Math.random() < 0.3) {
          const bubbleOsc = ctx.createOscillator();
          const bubbleEnv = ctx.createGain();
          bubbleOsc.type = 'sine';
          const bubbleBase = 950 + Math.random() * 900;
          bubbleOsc.frequency.setValueAtTime(bubbleBase, t0 + 0.003);
          bubbleOsc.frequency.exponentialRampToValueAtTime(bubbleBase * 1.38, t0 + 0.021);

          bubbleEnv.gain.setValueAtTime(0.0001, t0 + 0.003);
          bubbleEnv.gain.linearRampToValueAtTime(peak * 0.22, t0 + 0.006);
          bubbleEnv.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.024);

          bubbleOsc.connect(bubbleEnv);
          bubbleEnv.connect(target);
          bubbleOsc.start(t0 + 0.003);
          bubbleOsc.stop(t0 + 0.026);
        }
      }
    });

    // Layer E: Multi-Stage Rolling Distant Thunder (for 'thunderstorm' mode)
    let stopThunder: (() => void) | null = null;
    let firstThunderTimer: number | null = null;
    if (withThunder) {
      const brownBuf = this.createStereoNoiseBuffer(ctx, 'brown', 12);
      const pinkBuf = this.createStereoNoiseBuffer(ctx, 'pink', 12);

      const triggerThunder = () => {
        if (!this.ctx || this.ctx.state !== 'running') return;
        const now = ctx.currentTime;

        // Stage 1: Distant cloud crackle / tear (mid-low filtered pink noise)
        const crack = ctx.createBufferSource();
        crack.buffer = pinkBuf;
        const crackFilter = ctx.createBiquadFilter();
        crackFilter.type = 'lowpass';
        crackFilter.frequency.setValueAtTime(280 + Math.random() * 140, now);
        crackFilter.frequency.exponentialRampToValueAtTime(65, now + 2.2);

        const crackGain = ctx.createGain();
        crackGain.gain.setValueAtTime(0.0001, now);
        crackGain.gain.linearRampToValueAtTime(0.16 + Math.random() * 0.1, now + 0.18);
        crackGain.gain.exponentialRampToValueAtTime(0.0005, now + 2.4);

        // Stage 2: Deep rolling horizon rumble with 3 acoustic terrain echoes
        const rumble = ctx.createBufferSource();
        rumble.buffer = brownBuf;
        rumble.loop = true;

        const rumbleFilter = ctx.createBiquadFilter();
        rumbleFilter.type = 'lowpass';
        rumbleFilter.frequency.setValueAtTime(105 + Math.random() * 40, now);
        rumbleFilter.frequency.linearRampToValueAtTime(42, now + 6.8);

        const rumbleGain = ctx.createGain();
        const maxRumble = 0.44 + Math.random() * 0.22;
        rumbleGain.gain.setValueAtTime(0.001, now);
        rumbleGain.gain.linearRampToValueAtTime(maxRumble * 0.85, now + 0.55);
        rumbleGain.gain.linearRampToValueAtTime(maxRumble * 0.45, now + 1.4);
        rumbleGain.gain.linearRampToValueAtTime(maxRumble, now + 2.2);
        rumbleGain.gain.linearRampToValueAtTime(maxRumble * 0.55, now + 3.6);
        rumbleGain.gain.exponentialRampToValueAtTime(0.0004, now + 7.2);

        if (ctx.createStereoPanner) {
          const pan = ctx.createStereoPanner();
          const startPan = (Math.random() - 0.5) * 1.4;
          pan.pan.setValueAtTime(startPan, now);
          pan.pan.linearRampToValueAtTime(-startPan * 0.7, now + 6.5);

          crack.connect(crackFilter);
          crackFilter.connect(crackGain);
          crackGain.connect(pan);

          rumble.connect(rumbleFilter);
          rumbleFilter.connect(rumbleGain);
          rumbleGain.connect(pan);

          pan.connect(space.input);
        } else {
          crack.connect(crackFilter);
          crackFilter.connect(crackGain);
          crackGain.connect(space.input);

          rumble.connect(rumbleFilter);
          rumbleFilter.connect(rumbleGain);
          rumbleGain.connect(space.input);
        }

        crack.start(now, Math.random() * 5, 2.5);
        rumble.start(now, Math.random() * 4, 7.4);
      };

      firstThunderTimer = window.setTimeout(triggerThunder, 1800);
      stopThunder = this.scheduleOrganicLoop(9500, 21000, triggerThunder);
    }

    return () => {
      stopDroplets();
      if (stopThunder) stopThunder();
      if (firstThunderTimer !== null) window.clearTimeout(firstThunderTimer);
      try {
        rainBed.stop();
        deepRain.stop();
        mistSource.stop();
        swellLfo1.stop();
        swellLfo2.stop();
      } catch {}
      space.cleanup();
    };
  }

  // 5. Rolling Stereo Ocean Waves (Deep Swell + Breaking Crest + Receding Pebble/Foam Wash)
  private startOceanWaves(ctx: AudioContext, output: AudioNode) {
    const space = this.createAcousticReverbNode(ctx, 2.1, 0.25, output);

    // Layer 1: Deep ocean horizon swell
    const subWaveSource = ctx.createBufferSource();
    subWaveSource.buffer = this.createStereoNoiseBuffer(ctx, 'brown', 12);
    subWaveSource.loop = true;

    const subFilter = ctx.createBiquadFilter();
    subFilter.type = 'lowpass';
    subFilter.frequency.setValueAtTime(210, ctx.currentTime);
    const subGain = ctx.createGain();
    subGain.gain.setValueAtTime(0.38, ctx.currentTime);

    subWaveSource.connect(subFilter);
    subFilter.connect(subGain);
    subGain.connect(output);

    // Layer 2: Breaking wave crest & shore surge
    const waveSource = ctx.createBufferSource();
    waveSource.buffer = this.createStereoNoiseBuffer(ctx, 'pink', 12);
    waveSource.loop = true;

    const waveFilter = ctx.createBiquadFilter();
    waveFilter.type = 'lowpass';
    waveFilter.frequency.setValueAtTime(420, ctx.currentTime);
    waveFilter.Q.setValueAtTime(0.6, ctx.currentTime);

    const waveGain = ctx.createGain();
    waveGain.gain.setValueAtTime(0.38, ctx.currentTime);

    // Primary wave cycle (~9.5s)
    const waveLfo = ctx.createOscillator();
    const waveLfoFilterGain = ctx.createGain();
    const waveLfoAmpGain = ctx.createGain();
    waveLfo.type = 'sine';
    waveLfo.frequency.setValueAtTime(0.105, ctx.currentTime);

    waveLfoFilterGain.gain.setValueAtTime(340, ctx.currentTime);
    waveLfoAmpGain.gain.setValueAtTime(0.24, ctx.currentTime);

    waveLfo.connect(waveLfoFilterGain);
    waveLfoFilterGain.connect(waveFilter.frequency);
    waveLfo.connect(waveLfoAmpGain);
    waveLfoAmpGain.connect(waveGain.gain);

    // Layer 3: Receding fizzing shore foam & wet sand (delayed phase)
    const foamSource = ctx.createBufferSource();
    foamSource.buffer = this.createStereoNoiseBuffer(ctx, 'white', 12);
    foamSource.loop = true;
    const foamFilter = ctx.createBiquadFilter();
    foamFilter.type = 'bandpass';
    foamFilter.frequency.setValueAtTime(1350, ctx.currentTime);
    foamFilter.Q.setValueAtTime(0.65, ctx.currentTime);
    const foamGain = ctx.createGain();
    foamGain.gain.setValueAtTime(0.085, ctx.currentTime);

    const foamLfo = ctx.createOscillator();
    const foamLfoGain = ctx.createGain();
    foamLfo.type = 'sine';
    foamLfo.frequency.setValueAtTime(0.105, ctx.currentTime);
    foamLfoGain.gain.setValueAtTime(0.065, ctx.currentTime);
    foamLfo.connect(foamLfoGain);
    foamLfoGain.connect(foamGain.gain);

    waveSource.connect(waveFilter);
    waveFilter.connect(waveGain);
    waveGain.connect(space.input);

    foamSource.connect(foamFilter);
    foamFilter.connect(foamGain);
    foamGain.connect(space.input);

    subWaveSource.start();
    waveSource.start();
    foamSource.start();
    waveLfo.start();
    foamLfo.start(ctx.currentTime + 2.4);

    this.activeCleanupCallbacks.push(() => {
      try {
        subWaveSource.stop();
        waveSource.stop();
        foamSource.stop();
        waveLfo.stop();
        foamLfo.stop();
      } catch {}
      space.cleanup();
    });
  }

  // 6. Realistic Crackling Fireplace (Chimney Draft + Living Flame Tongues + Sizzling Resin + 3-Stage Wood Snaps)
  private startCracklingFireplace(ctx: AudioContext, output: AudioNode) {
    this.activeCleanupCallbacks.push(this.createFireplaceNodes(ctx, output));
  }

  private createFireplaceNodes(ctx: AudioContext, output: AudioNode): () => void {
    const hearthRoom = this.createAcousticReverbNode(ctx, 1.15, 0.2, output);

    // Layer 1: Deep chimney & hearth thermal draft
    const hearthSource = ctx.createBufferSource();
    hearthSource.buffer = this.createStereoNoiseBuffer(ctx, 'brown', 12);
    hearthSource.loop = true;

    const hearthFilter = ctx.createBiquadFilter();
    hearthFilter.type = 'lowpass';
    hearthFilter.frequency.setValueAtTime(175, ctx.currentTime);

    const hearthGain = ctx.createGain();
    hearthGain.gain.setValueAtTime(0.5, ctx.currentTime);

    // Layer 2: Dancing flame tongues (dual-LFO modulated warm midrange)
    const flameSource = ctx.createBufferSource();
    flameSource.buffer = this.createStereoNoiseBuffer(ctx, 'pink', 12);
    flameSource.loop = true;
    const flameFilter = ctx.createBiquadFilter();
    flameFilter.type = 'bandpass';
    flameFilter.frequency.setValueAtTime(420, ctx.currentTime);
    flameFilter.Q.setValueAtTime(0.85, ctx.currentTime);
    const flameGain = ctx.createGain();
    flameGain.gain.setValueAtTime(0.18, ctx.currentTime);

    const flickerLfo1 = ctx.createOscillator();
    const flickerGain1 = ctx.createGain();
    flickerLfo1.frequency.setValueAtTime(0.28, ctx.currentTime);
    flickerGain1.gain.setValueAtTime(0.1, ctx.currentTime);
    flickerLfo1.connect(flickerGain1);
    flickerGain1.connect(hearthGain.gain);

    const flickerLfo2 = ctx.createOscillator();
    const flickerGain2 = ctx.createGain();
    flickerLfo2.frequency.setValueAtTime(0.65, ctx.currentTime);
    flickerGain2.gain.setValueAtTime(110, ctx.currentTime);
    flickerLfo2.connect(flickerGain2);
    flickerGain2.connect(flameFilter.frequency);

    // Layer 3: Subtle glowing ember sizzle & pine resin hiss
    const sizzleSource = ctx.createBufferSource();
    sizzleSource.buffer = this.createStereoNoiseBuffer(ctx, 'white', 12);
    sizzleSource.loop = true;
    const sizzleFilter = ctx.createBiquadFilter();
    sizzleFilter.type = 'bandpass';
    sizzleFilter.frequency.setValueAtTime(3400, ctx.currentTime);
    sizzleFilter.Q.setValueAtTime(1.4, ctx.currentTime);
    const sizzleGain = ctx.createGain();
    sizzleGain.gain.setValueAtTime(0.018, ctx.currentTime);

    hearthSource.connect(hearthFilter);
    hearthFilter.connect(hearthGain);
    hearthGain.connect(output);

    flameSource.connect(flameFilter);
    flameFilter.connect(flameGain);
    flameGain.connect(hearthRoom.input);

    sizzleSource.connect(sizzleFilter);
    sizzleFilter.connect(sizzleGain);
    sizzleGain.connect(hearthRoom.input);

    hearthSource.start();
    flameSource.start();
    sizzleSource.start();
    flickerLfo1.start();
    flickerLfo2.start();

    // Layer 4: Authentic Multi-Stage Wood Fiber Snaps & Ember Crackle Clusters
    const pinkBuffer = this.createStereoNoiseBuffer(ctx, 'pink', 12);
    const whiteBuffer = this.createStereoNoiseBuffer(ctx, 'white', 12);

    const stopCrackles = this.scheduleOrganicLoop(45, 240, () => {
      if (!this.ctx || this.ctx.state !== 'running') return;
      const now = ctx.currentTime;
      const panPos = Math.random() * 1.1 - 0.55;

      let target: AudioNode = hearthRoom.input;
      if (ctx.createStereoPanner) {
        const pan = ctx.createStereoPanner();
        pan.pan.setValueAtTime(panPos, now);
        pan.connect(hearthRoom.input);
        target = pan;
      }

      // 1) Crisp wood snap transient (high-passed short impulse)
      const snap = ctx.createBufferSource();
      snap.buffer = whiteBuffer;
      const snapBp = ctx.createBiquadFilter();
      snapBp.type = 'bandpass';
      snapBp.frequency.setValueAtTime(2100 + Math.random() * 2400, now);
      snapBp.Q.setValueAtTime(2.8 + Math.random() * 1.8, now);

      const snapEnv = ctx.createGain();
      const snapAmp = 0.04 + Math.random() * 0.085;
      snapEnv.gain.setValueAtTime(0.0002, now);
      snapEnv.gain.linearRampToValueAtTime(snapAmp, now + 0.0012);
      snapEnv.gain.exponentialRampToValueAtTime(0.0001, now + 0.014 + Math.random() * 0.012);

      snap.connect(snapBp);
      snapBp.connect(snapEnv);
      snapEnv.connect(target);
      snap.start(now, Math.random() * 8, 0.035);

      // 2) Warm hollow log body resonance on bigger pops (40% chance)
      if (Math.random() < 0.42) {
        const logPop = ctx.createBufferSource();
        logPop.buffer = pinkBuffer;
        const logFilter = ctx.createBiquadFilter();
        logFilter.type = 'bandpass';
        logFilter.frequency.setValueAtTime(520 + Math.random() * 480, now + 0.002);
        logFilter.Q.setValueAtTime(3.2, now + 0.002);

        const logEnv = ctx.createGain();
        logEnv.gain.setValueAtTime(0.0001, now + 0.002);
        logEnv.gain.linearRampToValueAtTime(snapAmp * 0.55, now + 0.005);
        logEnv.gain.exponentialRampToValueAtTime(0.0001, now + 0.036);

        logPop.connect(logFilter);
        logFilter.connect(logEnv);
        logEnv.connect(target);
        logPop.start(now + 0.002, Math.random() * 8, 0.045);
      }
    });

    return () => {
      stopCrackles();
      try {
        hearthSource.stop();
        flameSource.stop();
        sizzleSource.stop();
        flickerLfo1.stop();
        flickerLfo2.stop();
      } catch {}
      hearthRoom.cleanup();
    };
  }

  // 7. 3D Forest Canopy Breeze, Babbling Brook & Natural Woodland Birdsong
  private startForestWind(ctx: AudioContext, output: AudioNode) {
    this.activeCleanupCallbacks.push(this.createForestNodes(ctx, output));
  }

  private createForestNodes(ctx: AudioContext, output: AudioNode): () => void {
    const canopySpace = this.createAcousticReverbNode(ctx, 2.2, 0.32, output);

    // Layer A: Stereo canopy leaf rustle (decorrelated left/right wind swells)
    const windSource = ctx.createBufferSource();
    windSource.buffer = this.createStereoNoiseBuffer(ctx, 'pink', 12);
    windSource.loop = true;

    const canopyFilterL = ctx.createBiquadFilter();
    canopyFilterL.type = 'bandpass';
    canopyFilterL.frequency.setValueAtTime(540, ctx.currentTime);
    canopyFilterL.Q.setValueAtTime(0.65, ctx.currentTime);

    const canopyFilterR = ctx.createBiquadFilter();
    canopyFilterR.type = 'bandpass';
    canopyFilterR.frequency.setValueAtTime(920, ctx.currentTime);
    canopyFilterR.Q.setValueAtTime(0.7, ctx.currentTime);

    const lfoL = ctx.createOscillator();
    const lfoLGain = ctx.createGain();
    lfoL.frequency.setValueAtTime(0.058, ctx.currentTime);
    lfoLGain.gain.setValueAtTime(180, ctx.currentTime);
    lfoL.connect(lfoLGain);
    lfoLGain.connect(canopyFilterL.frequency);

    const lfoR = ctx.createOscillator();
    const lfoRGain = ctx.createGain();
    lfoR.frequency.setValueAtTime(0.083, ctx.currentTime);
    lfoRGain.gain.setValueAtTime(240, ctx.currentTime);
    lfoR.connect(lfoRGain);
    lfoRGain.connect(canopyFilterR.frequency);

    const windGain = ctx.createGain();
    windGain.gain.setValueAtTime(0.36, ctx.currentTime);

    windSource.connect(canopyFilterL);
    windSource.connect(canopyFilterR);
    canopyFilterL.connect(windGain);
    canopyFilterR.connect(windGain);
    windGain.connect(canopySpace.input);

    // Layer B: Realistic Babbling Brook (Arroyo Cristalino)
    // Uses 2 water-formant resonators modulated by organic bubbling LFOs + gentle water bubble plinks
    const brookSource = ctx.createBufferSource();
    brookSource.buffer = this.createStereoNoiseBuffer(ctx, 'pink', 12);
    brookSource.loop = true;

    const brookFormant1 = ctx.createBiquadFilter();
    brookFormant1.type = 'bandpass';
    brookFormant1.frequency.setValueAtTime(640, ctx.currentTime);
    brookFormant1.Q.setValueAtTime(2.6, ctx.currentTime);

    const brookFormant2 = ctx.createBiquadFilter();
    brookFormant2.type = 'bandpass';
    brookFormant2.frequency.setValueAtTime(1180, ctx.currentTime);
    brookFormant2.Q.setValueAtTime(3.1, ctx.currentTime);

    const bubbleLfo1 = ctx.createOscillator();
    const bubbleGain1 = ctx.createGain();
    bubbleLfo1.frequency.setValueAtTime(4.2, ctx.currentTime);
    bubbleGain1.gain.setValueAtTime(195, ctx.currentTime);
    bubbleLfo1.connect(bubbleGain1);
    bubbleGain1.connect(brookFormant1.frequency);

    const bubbleLfo2 = ctx.createOscillator();
    const bubbleGain2 = ctx.createGain();
    bubbleLfo2.frequency.setValueAtTime(6.7, ctx.currentTime);
    bubbleGain2.gain.setValueAtTime(310, ctx.currentTime);
    bubbleLfo2.connect(bubbleGain2);
    bubbleGain2.connect(brookFormant2.frequency);

    const brookGain = ctx.createGain();
    brookGain.gain.setValueAtTime(0.14, ctx.currentTime);

    brookSource.connect(brookFormant1);
    brookSource.connect(brookFormant2);
    brookFormant1.connect(brookGain);
    brookFormant2.connect(brookGain);
    brookGain.connect(canopySpace.input);

    // Layer C: Warm forest floor foundation
    const floorSource = ctx.createBufferSource();
    floorSource.buffer = this.createStereoNoiseBuffer(ctx, 'brown', 12);
    floorSource.loop = true;
    const floorFilter = ctx.createBiquadFilter();
    floorFilter.type = 'lowpass';
    floorFilter.frequency.setValueAtTime(240, ctx.currentTime);
    const floorGain = ctx.createGain();
    floorGain.gain.setValueAtTime(0.24, ctx.currentTime);

    floorSource.connect(floorFilter);
    floorFilter.connect(floorGain);
    floorGain.connect(output);

    windSource.start();
    brookSource.start();
    floorSource.start();
    lfoL.start();
    lfoR.start();
    bubbleLfo1.start();
    bubbleLfo2.start();

    // Subtle brook water-bubble droplets
    const stopBrookDrops = this.scheduleOrganicLoop(90, 320, () => {
      if (!this.ctx || this.ctx.state !== 'running') return;
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const env = ctx.createGain();
      osc.type = 'sine';
      const f0 = 780 + Math.random() * 820;
      osc.frequency.setValueAtTime(f0, now);
      osc.frequency.exponentialRampToValueAtTime(f0 * 1.32, now + 0.024);

      env.gain.setValueAtTime(0.0001, now);
      env.gain.linearRampToValueAtTime(0.0055 + Math.random() * 0.006, now + 0.005);
      env.gain.exponentialRampToValueAtTime(0.0001, now + 0.028);

      osc.connect(env);
      env.connect(canopySpace.input);
      osc.start(now);
      osc.stop(now + 0.03);
    });

    // Layer D: Natural Distant Woodland Birdsong (Syrinx phrase glides with subtle vibrato & canopy reverb)
    const triggerDistantBird = () => {
      if (!this.ctx || this.ctx.state !== 'running') return;
      const now = ctx.currentTime;
      const basePitch = 1750 + Math.random() * 850;
      const notesCount = 2 + Math.floor(Math.random() * 3);

      const birdAirFilter = ctx.createBiquadFilter();
      birdAirFilter.type = 'lowpass';
      birdAirFilter.frequency.setValueAtTime(2650, now);

      if (ctx.createStereoPanner) {
        const panner = ctx.createStereoPanner();
        panner.pan.setValueAtTime(Math.random() * 1.6 - 0.8, now);
        birdAirFilter.connect(panner);
        panner.connect(canopySpace.input);
      } else {
        birdAirFilter.connect(canopySpace.input);
      }

      let cursor = now;
      for (let n = 0; n < notesCount; n++) {
        const dur = 0.08 + Math.random() * 0.065;
        const osc = ctx.createOscillator();
        const overtone = ctx.createOscillator();
        const overtoneGain = ctx.createGain();
        const g = ctx.createGain();

        osc.type = 'sine';
        overtone.type = 'sine';
        overtoneGain.gain.setValueAtTime(0.18, cursor);

        const contour = n % 2 === 0 ? 1.14 : 0.89;
        const fStart = basePitch * (1 + n * 0.05);
        const fEnd = fStart * contour;
        osc.frequency.setValueAtTime(fStart, cursor);
        osc.frequency.exponentialRampToValueAtTime(fEnd, cursor + dur);
        overtone.frequency.setValueAtTime(fStart * 2, cursor);
        overtone.frequency.exponentialRampToValueAtTime(fEnd * 2, cursor + dur);

        g.gain.setValueAtTime(0.0001, cursor);
        g.gain.linearRampToValueAtTime(0.015, cursor + 0.018);
        g.gain.exponentialRampToValueAtTime(0.0001, cursor + dur);

        osc.connect(g);
        overtone.connect(overtoneGain);
        overtoneGain.connect(g);
        g.connect(birdAirFilter);

        osc.start(cursor);
        overtone.start(cursor);
        osc.stop(cursor + dur + 0.01);
        overtone.stop(cursor + dur + 0.01);

        cursor += dur + 0.045 + Math.random() * 0.05;
      }
    };

    const stopBirds = this.scheduleOrganicLoop(2800, 7200, triggerDistantBird);

    return () => {
      stopBrookDrops();
      stopBirds();
      try {
        windSource.stop();
        brookSource.stop();
        floorSource.stop();
        lfoL.stop();
        lfoR.stop();
        bubbleLfo1.stop();
        bubbleLfo2.stop();
      } catch {}
      canopySpace.cleanup();
    };
  }

  // 8. Cozy Library / Study Room Ambience with Subtle Page Turns & Wooden Desk Resonance
  private startLibraryAmbience(ctx: AudioContext, output: AudioNode) {
    const roomSpace = this.createAcousticReverbNode(ctx, 1.4, 0.22, output);

    const roomSource = ctx.createBufferSource();
    roomSource.buffer = this.createStereoNoiseBuffer(ctx, 'brown', 12);
    roomSource.loop = true;

    const murmurSource = ctx.createBufferSource();
    murmurSource.buffer = this.createStereoNoiseBuffer(ctx, 'pink', 12);
    murmurSource.loop = true;

    const roomFilter = ctx.createBiquadFilter();
    roomFilter.type = 'lowpass';
    roomFilter.frequency.setValueAtTime(220, ctx.currentTime);

    const murmurFilter = ctx.createBiquadFilter();
    murmurFilter.type = 'bandpass';
    murmurFilter.frequency.setValueAtTime(360, ctx.currentTime);
    murmurFilter.Q.setValueAtTime(1.2, ctx.currentTime);

    const murmurLfo = ctx.createOscillator();
    const murmurLfoGain = ctx.createGain();
    murmurLfo.frequency.setValueAtTime(0.12, ctx.currentTime);
    murmurLfoGain.gain.setValueAtTime(70, ctx.currentTime);
    murmurLfo.connect(murmurLfoGain);
    murmurLfoGain.connect(murmurFilter.frequency);

    const mixGain = ctx.createGain();
    mixGain.gain.setValueAtTime(0.44, ctx.currentTime);

    roomSource.connect(roomFilter);
    roomFilter.connect(mixGain);

    murmurSource.connect(murmurFilter);
    murmurFilter.connect(mixGain);

    mixGain.connect(roomSpace.input);

    roomSource.start();
    murmurSource.start();
    murmurLfo.start();

    // Organic page-turn rustle & soft book movement
    const pinkBuf = this.createStereoNoiseBuffer(ctx, 'pink', 12);
    const stopPages = this.scheduleOrganicLoop(4200, 11000, () => {
      if (!this.ctx || this.ctx.state !== 'running') return;
      const now = ctx.currentTime;
      const pageRustle = ctx.createBufferSource();
      pageRustle.buffer = pinkBuf;

      const filter = ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(1650, now);
      filter.frequency.exponentialRampToValueAtTime(880, now + 0.18);
      filter.Q.setValueAtTime(1.5, now);

      const env = ctx.createGain();
      env.gain.setValueAtTime(0.0001, now);
      env.gain.linearRampToValueAtTime(0.022, now + 0.045);
      env.gain.exponentialRampToValueAtTime(0.0001, now + 0.2);

      pageRustle.connect(filter);
      filter.connect(env);
      env.connect(roomSpace.input);

      pageRustle.start(now, Math.random() * 8, 0.22);
    });

    this.activeCleanupCallbacks.push(() => {
      stopPages();
      try {
        roomSource.stop();
        murmurSource.stop();
        murmurLfo.stop();
      } catch {}
      roomSpace.cleanup();
    });
  }

  // 9. Generative Lo-Fi Study Chords (Warm Rhodes Electric Piano + Stereo Chorus + Vinyl Crackle)
  private startLofiStudyChords(ctx: AudioContext, output: AudioNode) {
    const lofiSpace = this.createAcousticReverbNode(ctx, 2.0, 0.34, output);

    // Cozy vinyl / tape room air
    const vinylSource = ctx.createBufferSource();
    vinylSource.buffer = this.createStereoNoiseBuffer(ctx, 'pink', 12);
    vinylSource.loop = true;

    const vinylFilter = ctx.createBiquadFilter();
    vinylFilter.type = 'bandpass';
    vinylFilter.frequency.setValueAtTime(820, ctx.currentTime);
    vinylFilter.Q.setValueAtTime(0.75, ctx.currentTime);

    const vinylGain = ctx.createGain();
    vinylGain.gain.setValueAtTime(0.065, ctx.currentTime);

    vinylSource.connect(vinylFilter);
    vinylFilter.connect(vinylGain);
    vinylGain.connect(output);
    vinylSource.start();

    // Warm Rhodes-like extended jazz chord progression: Fmaj9 -> Em7 -> Dm9 -> Cmaj7
    const chords = [
      [174.61, 220.0, 261.63, 329.63, 392.0], // Fmaj9
      [164.81, 196.0, 246.94, 293.66, 329.63], // Em7
      [146.83, 174.61, 220.0, 261.63, 329.63], // Dm9
      [130.81, 164.81, 196.0, 246.94, 293.66], // Cmaj9
    ];

    let chordIdx = 0;
    const playWarmChord = () => {
      if (!this.ctx || this.ctx.state !== 'running') return;
      const now = ctx.currentTime;
      const notes = chords[chordIdx % chords.length];
      chordIdx++;

      const chordFilter = ctx.createBiquadFilter();
      chordFilter.type = 'lowpass';
      chordFilter.frequency.setValueAtTime(740, now);
      chordFilter.frequency.exponentialRampToValueAtTime(340, now + 4.3);
      chordFilter.connect(lofiSpace.input);

      notes.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const tine = ctx.createOscillator();
        const tineGain = ctx.createGain();
        const sub = ctx.createOscillator();
        const env = ctx.createGain();

        osc.type = 'sine';
        tine.type = 'sine';
        sub.type = 'triangle';

        const detune = (Math.random() - 0.5) * 5;
        osc.frequency.setValueAtTime(freq, now);
        osc.detune.setValueAtTime(detune, now);
        tine.frequency.setValueAtTime(freq * 3, now);
        sub.frequency.setValueAtTime(freq * 0.5, now);

        const stagger = idx * 0.048;
        // Soft Rhodes bell tine attack that decays quickly
        tineGain.gain.setValueAtTime(0.0001, now + stagger);
        tineGain.gain.linearRampToValueAtTime(0.012, now + stagger + 0.015);
        tineGain.gain.exponentialRampToValueAtTime(0.0001, now + stagger + 0.35);

        env.gain.setValueAtTime(0.0001, now + stagger);
        env.gain.linearRampToValueAtTime(0.048, now + stagger + 0.25);
        env.gain.exponentialRampToValueAtTime(0.0004, now + 4.6);

        osc.connect(env);
        sub.connect(env);
        tine.connect(tineGain);
        tineGain.connect(env);
        env.connect(chordFilter);

        osc.start(now + stagger);
        sub.start(now + stagger);
        tine.start(now + stagger);
        osc.stop(now + 4.7);
        sub.stop(now + 4.7);
        tine.stop(now + stagger + 0.4);
      });
    };

    playWarmChord();
    const chordTimer = window.setInterval(playWarmChord, 4600);

    this.activeCleanupCallbacks.push(() => {
      window.clearInterval(chordTimer);
      try {
        vinylSource.stop();
      } catch {}
      lofiSpace.cleanup();
    });
  }

  // 10. Summer Night Breeze & Stereo Distant Field Crickets
  private startNightCrickets(ctx: AudioContext, output: AudioNode) {
    const nightSpace = this.createAcousticReverbNode(ctx, 1.8, 0.28, output);

    const nightAir = ctx.createBufferSource();
    nightAir.buffer = this.createStereoNoiseBuffer(ctx, 'brown', 12);
    nightAir.loop = true;

    const airFilter = ctx.createBiquadFilter();
    airFilter.type = 'lowpass';
    airFilter.frequency.setValueAtTime(240, ctx.currentTime);
    const airGain = ctx.createGain();
    airGain.gain.setValueAtTime(0.32, ctx.currentTime);

    nightAir.connect(airFilter);
    airFilter.connect(airGain);
    airGain.connect(output);
    nightAir.start();

    const triggerCricketPulse = () => {
      if (!this.ctx || this.ctx.state !== 'running') return;
      const now = ctx.currentTime;
      const carrierFreq = 3580 + (Math.random() - 0.5) * 180;

      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(3850, now);

      if (ctx.createStereoPanner) {
        const pan = ctx.createStereoPanner();
        pan.pan.setValueAtTime(Math.random() * 1.6 - 0.8, now);
        filter.connect(pan);
        pan.connect(nightSpace.input);
      } else {
        filter.connect(nightSpace.input);
      }

      const pulses = 3 + Math.floor(Math.random() * 2);
      for (let p = 0; p < pulses; p++) {
        const startT = now + p * 0.042;
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(carrierFreq, startT);

        g.gain.setValueAtTime(0.0001, startT);
        g.gain.linearRampToValueAtTime(0.0065, startT + 0.009);
        g.gain.exponentialRampToValueAtTime(0.0001, startT + 0.032);

        osc.connect(g);
        g.connect(filter);
        osc.start(startT);
        osc.stop(startT + 0.035);
      }
    };

    const stopCrickets = this.scheduleOrganicLoop(480, 1450, triggerCricketPulse);

    this.activeCleanupCallbacks.push(() => {
      stopCrickets();
      try {
        nightAir.stop();
      } catch {}
      nightSpace.cleanup();
    });
  }

  // 11. Tibetan Singing Bowls & 432 Hz Harmonic Resonance
  private startSingingBowls(ctx: AudioContext, output: AudioNode) {
    const bowlSpace = this.createAcousticReverbNode(ctx, 2.5, 0.35, output);

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
    droneGain.connect(bowlSpace.input);

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
        g.connect(bowlSpace.input);
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
      bowlSpace.cleanup();
    });
  }
}

export const ambientAudioService = new AmbientAudioEngine();
