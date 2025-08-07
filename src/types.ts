// Type declarations for the core kit. These interfaces mirror the design
// described in the user specification and are used for documentation and IDE
// support. They are not consumed at runtime unless compiled with TypeScript.

export type Handler<T = any> = (payload: T) => void;

export interface EventBus {
  on(evt: string, h: Handler): void;
  off(evt: string, h: Handler): void;
  emit(evt: string, payload?: any): void;
}

export interface Registry {
  get(key: string): any;
  set(key: string, val: any): void;
  observe(key: string, cb: (val: any) => void): void;
}

export interface DialogAPI {
  open(model: { title?: string; text: string; options?: { label: string; value: any }[] }, onChoose?: (val: any) => void): void;
  close(): void;
  isOpen(): boolean;
}

export interface HudAPI {
  set(stats: Record<string, string | number>): void;
  patch(delta: Record<string, string | number>): void;
}

export interface CoreOptions {
  container?: string | HTMLElement;
  width?: number;
  height?: number;
  backgroundColor?: number;
  seed?: number;
  input?: Record<string, any>;
}

export interface Core {
  apiVersion: string;
  app: any; // Phaser.Game
  bus: EventBus;
  registry: Registry;
  rng: () => number;
  loadConfig: (urlOrObject: string | any) => Promise<void>;
  start: () => void;
  save: (slot?: string) => Promise<void>;
  load: (slot?: string) => Promise<void>;
  ui: { dialog: DialogAPI; hud: HudAPI; toast: (msg: string) => void };
  // Plugins may extend core with additional fields like inventory, characters, etc.
  [key: string]: any;
}