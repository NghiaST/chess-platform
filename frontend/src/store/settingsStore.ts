import { create } from 'zustand';
import { createJSONStorage, persist, type StateStorage } from 'zustand/middleware';

export type BoardTheme = 'classic' | 'green' | 'blue';
export type PieceTheme = 'default';
export type BackgroundTheme = 'default' | 'linen' | 'slate';

export interface AppSettings {
  settingsVersion: number;
  showLegalMoves: boolean;
  premoveEnabled: boolean;
  aiAssistEnabled: boolean;
  boardTheme: BoardTheme;
  pieceTheme: PieceTheme;
  backgroundTheme: BackgroundTheme;
  annotationColor: string;
}

export interface SettingsState extends AppSettings {
  setShowLegalMoves: (enabled: boolean) => void;
  setPremoveEnabled: (enabled: boolean) => void;
  setAiAssistEnabled: (enabled: boolean) => void;
  setBoardTheme: (theme: BoardTheme) => void;
  setPieceTheme: (theme: PieceTheme) => void;
  setBackgroundTheme: (theme: BackgroundTheme) => void;
  setAnnotationColor: (color: string) => void;
  resetSettings: () => void;
}

export const SETTINGS_VERSION = 1;

export const DEFAULT_SETTINGS: AppSettings = {
  settingsVersion: SETTINGS_VERSION,
  showLegalMoves: true,
  premoveEnabled: false,
  aiAssistEnabled: false,
  boardTheme: 'classic',
  pieceTheme: 'default',
  backgroundTheme: 'default',
  annotationColor: '#22c55e',
};

const createMemoryStorage = (): StateStorage => {
  const map = new Map<string, string>();
  return {
    getItem: (name: string) => map.get(name) ?? null,
    setItem: (name: string, value: string) => {
      map.set(name, value);
    },
    removeItem: (name: string) => {
      map.delete(name);
    },
  };
};

const fallbackStorage = createMemoryStorage();

const resolveStorage = (storage?: StateStorage): StateStorage => {
  if (storage) return storage;
  if (typeof window !== 'undefined' && window.localStorage) {
    return window.localStorage;
  }
  return fallbackStorage;
};

export const createSettingsStore = (storage?: StateStorage) =>
  create<SettingsState>()(
    persist(
      (set) => ({
        ...DEFAULT_SETTINGS,

        setShowLegalMoves: (enabled) => set({ showLegalMoves: enabled }),
        setPremoveEnabled: (enabled) => set({ premoveEnabled: enabled }),
        setAiAssistEnabled: (enabled) => set({ aiAssistEnabled: enabled }),
        setBoardTheme: (theme) => set({ boardTheme: theme }),
        setPieceTheme: (theme) => set({ pieceTheme: theme }),
        setBackgroundTheme: (theme) => set({ backgroundTheme: theme }),
        setAnnotationColor: (color) => set({ annotationColor: color }),
        resetSettings: () => set({ ...DEFAULT_SETTINGS }),
      }),
      {
        name: 'chess-settings-v1',
        version: SETTINGS_VERSION,
        storage: createJSONStorage(() => resolveStorage(storage)),
      },
    ),
  );

export const useSettingsStore = createSettingsStore();
