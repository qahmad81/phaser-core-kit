/**
 * Type definitions for phaser-core-kit.
 * Each comment explains the exact behavior for AI agents.
 */

/** Handler invoked with a payload. */
export type Handler<T = any> = (payload: T) => void;

/** Event dispatch system used by the core. */
export class EventBus {
  /** Subscribe handler to event name. */
  on(evt: string, h: Handler): void;
  /** Remove handler from event name. */
  off(evt: string, h: Handler): void;
  /** Emit event name with optional payload. */
  emit(evt: string, payload?: any): void;
}

/** Shared key-value store with observers. */
export class Registry {
  /** Retrieve value stored at dotted path. */
  get(key: string): any;
  /** Store value at dotted path and notify observers. */
  set(key: string, val: any): void;
  /** Register callback for changes on dotted path. */
  observe(key: string, cb: (val: any) => void): void;
}

/** Dialog overlay API. */
export interface DialogAPI {
  /** Display dialog box using provided model. */
  open(model: { title?: string; text: string; options?: { label: string; value: any }[] }, onChoose?: (val: any) => void): void;
  /** Remove dialog box from screen. */
  close(): void;
  /** True if dialog currently visible. */
  isOpen(): boolean;
}

/** HUD overlay API showing key-value pairs. */
export interface HudAPI {
  /** Replace entire HUD state with provided values. */
  set(stats: Record<string, string | number>): void;
  /** Merge provided values into existing HUD state. */
  patch(delta: Record<string, string | number>): void;
}

/** Inventory management API attached by InventoryLite. */
export interface InventoryAPI {
  add(id: string, q?: number, charId?: string): void;
  remove(id: string, q?: number, charId?: string): void;
  has(id: string, q?: number, charId?: string): boolean;
  list(charId?: string): { id: string; q: number }[];
}

/** Character management API attached by CharactersLite. */
export interface CharactersAPI {
  getMoney(id: string): number;
  addMoney(id: string, amount: number): void;
  getEnergy(id: string): number;
  addEnergy(id: string, amount: number): void;
  setEnergy(id: string, value: number): void;
}

/** Trade API attached by TradeLite. */
export interface TradeAPI {
  buy(item: string, price: number, q?: number, charId?: string): boolean;
  sell(item: string, price: number, q?: number, charId?: string): boolean;
  handleDialogTrade(action: { op: 'buy' | 'sell'; item: string; price: number; q?: number }): void;
}

/** Dialogue API attached by DialogueLite. */
export interface DialogueAPI {
  open(id: string): void;
  close(): void;
  getAvailable(): string[];
}

/** Location API attached by LocationLite. */
export interface LocationsAPI {
  get(id: string): any;
  list(): string[];
}

/** Options for creating core engine. */
export interface CoreOptions {
  container?: string | HTMLElement;
  width?: number;
  height?: number;
  backgroundColor?: number;
  seed?: number;
  input?: Record<string, any>;
  Phaser?: any;
}

/** Main core instance returned by createCore. */
export interface Core {
  apiVersion: string;
  app: any;
  bus: EventBus;
  registry: Registry;
  rng: () => number;
  setSeed(seed: number): void;
  setInputMapping(mapping: Record<string, any>): void;
  loadConfig(urlOrObject: string | any): Promise<void>;
  start(): void;
  save(slot?: string): Promise<void>;
  load(slot?: string): Promise<void>;
  ui: { dialog: DialogAPI; hud: HudAPI; toast: (msg: string, duration?: number) => void };
  Phaser: any;
  dialogue?: DialogueAPI;
  inventory?: InventoryAPI;
  trade?: TradeAPI;
  characters?: CharactersAPI;
  locations?: LocationsAPI;
  [key: string]: any;
}

/**
 * Create the core kit instance. Sets up Phaser, event bus, registry, RNG,
 * input mapping, configuration loader and UI elements.
 */
export function createCore(opts?: CoreOptions): Core;

/**
 * Create deterministic pseudo-random number generator using mulberry32.
 * Returned function yields float in [0,1).
 */
export function createRng(seed?: number): () => number;

/**
 * Install keydown listener based on mapping and emit `input` events.
 * Returns a function removing installed listener.
 */
export function setupInput(mapping: Record<string, any>, bus: EventBus): () => void;

/**
 * Bind configuration loader to specific core instance.
 * Parses JSON/YAML config, loads assets and emits `core:config_loaded`.
 */
export function createConfigLoader(core: Core): (urlOrObject: string | object) => Promise<void>;

/** Build dialog overlay attached to container. */
export function createDialog(container: HTMLElement, bus: EventBus): DialogAPI;

/** Build HUD overlay attached to container. */
export function createHud(container: HTMLElement): HudAPI;

/** Build toast notification function attached to container. */
export function createToast(container: HTMLElement): (msg: string, duration?: number) => void;

/** Plugin exporting dialogue features. Call `init` with core to activate. */
export const DialogueLite: { init(core: Core): void };

/** Plugin exporting inventory features. Call `init` with core to activate. */
export const InventoryLite: { init(core: Core): void };

/** Plugin exporting trade features. Call `init` with core to activate. */
export const TradeLite: { init(core: Core): void };

/** Plugin exporting character features. Call `init` with core to activate. */
export const CharactersLite: { init(core: Core): void };

/** Plugin exporting location features. Call `init` with core to activate. */
export const LocationLite: { init(core: Core): void };

