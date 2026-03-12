import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import PracticePanel from './PracticePanel';

// Wrap with QueryClientProvider because PracticePanel uses useMutation internally
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createElement } from 'react';

function wrap(el: React.ReactElement) {
  const qc = new QueryClient();
  return renderToStaticMarkup(
    createElement(QueryClientProvider, { client: qc }, el)
  );
}

describe('PracticePanel', () => {
  it('renders heading and beta badge', () => {
    const html = wrap(<PracticePanel gameId="test-game-id" />);
    expect(html).toContain('Practice Mode');
    expect(html).toContain('BETA');
  });

  it('renders Get Hint and Undo buttons', () => {
    const html = wrap(<PracticePanel gameId="test-game-id" />);
    expect(html).toContain('Get Hint');
    expect(html).toContain('Undo Full Round');
  });

  it('renders disabled undo when undoEnabled is false', () => {
    const html = wrap(<PracticePanel gameId="test-game-id" undoEnabled={false} />);
    expect(html).toContain('disabled');
  });

  it('renders study mode labels when mode=study', () => {
    const html = wrap(<PracticePanel gameId="test-game-id" mode="study" />);
    expect(html).toContain('Study Mode');
    expect(html).toContain('Undo Move');
  });
});
