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
    window.history.replaceState({}, '', '/');
    globalThis.fetch = vi.fn();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  test('renders items and markdown content from API', async () => {
    globalThis.fetch
      .mockResolvedValueOnce(createJsonResponse({ is_authenticated: false }))
      .mockResolvedValueOnce(
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
      .mockResolvedValueOnce(createJsonResponse({ is_authenticated: false }))
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
      expect.objectContaining({ method: 'POST', credentials: 'include' }),
    );
  });

  test('supports admin login and protected admin route', async () => {
    window.history.replaceState({}, '', '/admin');
    globalThis.fetch
      .mockResolvedValueOnce(createJsonResponse({ is_authenticated: false }))
      .mockResolvedValueOnce(createJsonResponse({ is_authenticated: true }))
      .mockResolvedValueOnce(createJsonResponse([]));

    render(<App />);

    await screen.findByRole('heading', { name: 'Admin Login' });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'super-secret' } });
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));

    expect(await screen.findByRole('heading', { name: 'Admin Wishlist Manager' })).toBeInTheDocument();
    expect(globalThis.fetch).toHaveBeenCalledWith(
      '/api/admin/session/',
      expect.objectContaining({ method: 'POST' }),
    );
  });

  test('redirects authenticated admin from public route to /admin', async () => {
    globalThis.fetch
      .mockResolvedValueOnce(createJsonResponse({ is_authenticated: true }))
      .mockResolvedValueOnce(createJsonResponse([]));

    render(<App />);

    await screen.findByRole('heading', { name: 'Admin Wishlist Manager' });
    await waitFor(() => {
      expect(window.location.pathname).toBe('/admin');
    });
  });
});
