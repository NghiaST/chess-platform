import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import SettingsPage from './SettingsPage';

describe('SettingsPage', () => {
  it('renders the settings headings and toggle labels', () => {
    const html = renderToStaticMarkup(<SettingsPage />);

    expect(html).toContain('Settings');
    expect(html).toContain('Show legal moves');
    expect(html).toContain('Enable premove');
    expect(html).toContain('Reset to defaults');
  });

  it('renders two switch inputs for gameplay toggles', () => {
    const html = renderToStaticMarkup(<SettingsPage />);

    const switchCount = (html.match(/role="switch"/g) ?? []).length;
    expect(switchCount).toBe(2);
    expect(html).toContain('aria-label="Show legal moves"');
    expect(html).toContain('aria-label="Enable premove"');
  });
});
