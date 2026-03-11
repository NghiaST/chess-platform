import { describe, expect, it } from 'vitest';
import type { StateStorage } from 'zustand/middleware';
import {
  DEFAULT_SETTINGS,
  createSettingsStore,
  type BoardTheme,
  type BackgroundTheme,
} from './settingsStore';

const createMockStorage = (): StateStorage => {
  const data = new Map<string, string>();
  return {
    getItem: (name) => data.get(name) ?? null,
    setItem: (name, value) => {
      data.set(name, value);
    },
    removeItem: (name) => {
      data.delete(name);
    },
  };
};

describe('settingsStore', () => {
  it('uses expected default settings', () => {
    const store = createSettingsStore(createMockStorage());
    const state = store.getState();

    expect(state.showLegalMoves).toBe(DEFAULT_SETTINGS.showLegalMoves);
    expect(state.premoveEnabled).toBe(DEFAULT_SETTINGS.premoveEnabled);
    expect(state.aiAssistEnabled).toBe(DEFAULT_SETTINGS.aiAssistEnabled);
    expect(state.boardTheme).toBe(DEFAULT_SETTINGS.boardTheme);
    expect(state.backgroundTheme).toBe(DEFAULT_SETTINGS.backgroundTheme);
    expect(state.annotationColor).toBe(DEFAULT_SETTINGS.annotationColor);
  });

  it('updates settings via actions', () => {
    const store = createSettingsStore(createMockStorage());
    const state = store.getState();

    state.setShowLegalMoves(false);
    state.setPremoveEnabled(true);
    state.setAiAssistEnabled(true);
    state.setBoardTheme('green' as BoardTheme);
    state.setBackgroundTheme('slate' as BackgroundTheme);
    state.setAnnotationColor('#ef4444');

    const updated = store.getState();
    expect(updated.showLegalMoves).toBe(false);
    expect(updated.premoveEnabled).toBe(true);
    expect(updated.aiAssistEnabled).toBe(true);
    expect(updated.boardTheme).toBe('green');
    expect(updated.backgroundTheme).toBe('slate');
    expect(updated.annotationColor).toBe('#ef4444');
  });

  it('resets all settings to defaults', () => {
    const store = createSettingsStore(createMockStorage());
    const state = store.getState();

    state.setShowLegalMoves(false);
    state.setPremoveEnabled(true);
    state.setAiAssistEnabled(true);
    state.setBoardTheme('blue');
    state.setBackgroundTheme('linen');
    state.setAnnotationColor('#f59e0b');

    store.getState().resetSettings();

    const reset = store.getState();
    expect(reset.showLegalMoves).toBe(DEFAULT_SETTINGS.showLegalMoves);
    expect(reset.premoveEnabled).toBe(DEFAULT_SETTINGS.premoveEnabled);
    expect(reset.aiAssistEnabled).toBe(DEFAULT_SETTINGS.aiAssistEnabled);
    expect(reset.boardTheme).toBe(DEFAULT_SETTINGS.boardTheme);
    expect(reset.backgroundTheme).toBe(DEFAULT_SETTINGS.backgroundTheme);
    expect(reset.annotationColor).toBe(DEFAULT_SETTINGS.annotationColor);
  });
});
