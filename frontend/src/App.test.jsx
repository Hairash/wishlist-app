import { fireEvent, render, screen, waitFor } from '@testing-library/react';

import { App } from './App';

function createJsonResponse(payload, ok = true, status = 200) {
  return {
    ok,
    status,
    json: async () => payload,
  };
}

describe('App', () => {
  beforeEach(() => {
    globalThis.fetch = vi.fn();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  test('renders items and markdown content from API', async () => {
    globalThis.fetch.mockResolvedValueOnce(
      createJsonResponse([
        {
          id: 1,
          title: 'Coffee Grinder',
          content_markdown: '**Great** for espresso',
          metadata: { links: ['https://example.com'] },
          reservation: null,
          comments_enabled: true,
        },
      ]),
    );

    render(<App />);

    expect(await screen.findByRole('heading', { name: 'Coffee Grinder' })).toBeInTheDocument();
    expect(screen.getByText('Great')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'https://example.com' })).toBeInTheDocument();
  });

  test('supports reserve flow and updates reservation status', async () => {
    globalThis.fetch
      .mockResolvedValueOnce(
        createJsonResponse([
          {
            id: 2,
            title: 'Headphones',
            content_markdown: 'Noise cancelling',
            metadata: {},
            reservation: null,
            comments_enabled: true,
          },
        ]),
      )
      .mockResolvedValueOnce(
        createJsonResponse({
          id: 2,
          title: 'Headphones',
          content_markdown: 'Noise cancelling',
          metadata: {},
          reservation: { reserved_by_name: 'Alex' },
          comments_enabled: true,
        }, true, 201),
      );

    render(<App />);

    await screen.findByRole('heading', { name: 'Headphones' });
    fireEvent.change(screen.getByLabelText('Your name (optional)'), { target: { value: 'Alex' } });
    fireEvent.click(screen.getByRole('button', { name: 'Reserve' }));

    await screen.findByText('Reserved by Alex');
    expect(globalThis.fetch).toHaveBeenCalledWith(
      '/api/wishlist-items/2/reserve/',
      expect.objectContaining({ method: 'POST' }),
    );
  });

  test('loads and posts comments', async () => {
    globalThis.fetch
      .mockResolvedValueOnce(
        createJsonResponse([
          {
            id: 3,
            title: 'Books',
            content_markdown: 'Fantasy picks',
            metadata: {},
            reservation: null,
            comments_enabled: true,
          },
        ]),
      )
      .mockResolvedValueOnce(
        createJsonResponse([{ id: 5, author_name: 'Nora', text: 'Nice list!' }]),
      )
      .mockResolvedValueOnce(
        createJsonResponse({ id: 6, author_name: '', text: 'Adding another note.' }, true, 201),
      );

    render(<App />);

    await screen.findByRole('heading', { name: 'Books' });
    fireEvent.click(screen.getByRole('button', { name: 'Refresh comments' }));

    expect(await screen.findByText(/Nora:/)).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Comment'), {
      target: { value: 'Adding another note.' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Post comment' }));

    await waitFor(() => {
      expect(screen.getByText(/Anonymous:/)).toBeInTheDocument();
      expect(screen.getByText(/Adding another note./)).toBeInTheDocument();
    });
  });

  test('shows API error state when item loading fails', async () => {
    globalThis.fetch.mockResolvedValueOnce(createJsonResponse({ detail: 'Server unavailable' }, false, 500));

    render(<App />);

    expect(await screen.findByRole('alert')).toHaveTextContent('Server unavailable');
  });
});
