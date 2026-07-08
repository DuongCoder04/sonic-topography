import assert from 'node:assert/strict';

let frameId = 1;
(globalThis as any).performance = { now: () => 1000 };
(globalThis as any).requestAnimationFrame = (callback: FrameRequestCallback) => {
  const id = frameId++;
  return id;
};
(globalThis as any).cancelAnimationFrame = () => {};

class MockAudio {
  public crossOrigin = '';
  public src = '';
  public currentTime = 0;
  public duration = 0;
  public addEventListener() {}
  public load() {}
  public play() { return Promise.resolve(); }
  public pause() {}
}

class MockNode {
  public connectedTo: unknown[] = [];
  public disconnected = false;
  public gain = {
    value: 0,
    setTargetAtTime() {},
    cancelScheduledValues() {},
    setValueAtTime() {},
    linearRampToValueAtTime() {},
  };

  connect(target: unknown) {
    this.connectedTo.push(target);
    return target;
  }

  disconnect() {
    this.disconnected = true;
    this.connectedTo = [];
  }
}

class MockAudioContext {
  public destination = new MockNode();
  public currentTime = 0;
  public state = 'running';
  public mediaElementSource = new MockNode();
  public mediaStreamSources: MockNode[] = [];
  public analyser = new MockNode() as MockNode & {
    fftSize: number;
    smoothingTimeConstant: number;
    minDecibels: number;
    frequencyBinCount: number;
    getByteFrequencyData: (target: Uint8Array) => void;
  };

  constructor() {
    this.analyser.frequencyBinCount = 512;
    this.analyser.getByteFrequencyData = (target: Uint8Array) => {
      target[0] = 255;
    };
  }

  createAnalyser() {
    return this.analyser;
  }

  createGain() {
    return new MockNode();
  }

  createMediaElementSource() {
    return this.mediaElementSource;
  }

  createMediaStreamSource() {
    const source = new MockNode();
    this.mediaStreamSources.push(source);
    return source;
  }

  resume() {
    return Promise.resolve();
  }
}

(globalThis as any).Audio = MockAudio;
(globalThis as any).AudioContext = MockAudioContext;
(globalThis as any).window = {
  AudioContext: MockAudioContext,
};

const { AudioEngine } = await import('./AudioEngine');
const { normalizeAudioInputDevices } = await import('./audioInput');

const devices = normalizeAudioInputDevices([
  { kind: 'audioinput', deviceId: 'default', label: '' },
  { kind: 'audioinput', deviceId: 'usb', label: 'USB Mic' },
  { kind: 'audiooutput', deviceId: 'speaker', label: 'Speaker' },
] as MediaDeviceInfo[]);

assert.deepEqual(devices, [
  { id: 'default', label: 'Microphone 1' },
  { id: 'usb', label: 'USB Mic' },
]);

const engine = new AudioEngine();
engine.init();

const trackA = { stopped: false, stop() { this.stopped = true; } };
const trackB = { stopped: false, stop() { this.stopped = true; } };
const streamA = { getTracks: () => [trackA] } as unknown as MediaStream;
const streamB = { getTracks: () => [trackB] } as unknown as MediaStream;

engine.loadStream(streamA, 'microphone');

const context = (engine as any).audioCtx as MockAudioContext;
const streamSourceA = context.mediaStreamSources[0];
assert.equal(engine.getInputMode(), 'microphone');
assert.equal(streamSourceA.connectedTo.includes((engine as any).analyser), true);
assert.equal(streamSourceA.connectedTo.includes(context.destination), false);
assert.equal(trackA.stopped, false);

engine.loadStream(streamB, 'system');

assert.equal(trackA.stopped, true);
assert.equal(streamSourceA.disconnected, true);
assert.equal(engine.getInputMode(), 'system');

engine.stopExternalInput();

assert.equal(trackB.stopped, true);
assert.equal(engine.getInputMode(), 'player');

console.log('audioInput tests passed');
