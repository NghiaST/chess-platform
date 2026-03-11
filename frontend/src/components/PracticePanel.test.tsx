import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import PracticePanel from './PracticePanel';

describe('PracticePanel', () => {
  it('renders heading and beta helper text', () => {
    const html = renderToStaticMarkup(<PracticePanel />);

    expect(html).toContain('Practice Mode');
    expect(html).toContain('BETA');
    expect(html).toContain('Hint engine and coach rules will be added');
  });

  it('renders disabled undo button by default', () => {
    const html = renderToStaticMarkup(<PracticePanel />);

    expect(html).toContain('Undo Last Move (coming soon)');
    expect(html).toContain('disabled=""');
  });
});
