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
    expect(globalThis.fetch).toHaveBeenLastCalledWith(
      '/api/admin/wishlist-items/',
      expect.objectContaining({
        credentials: 'include',
        headers: expect.objectContaining({ 'Content-Type': 'application/json' }),
      }),
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

  test('adds uploaded image URLs into metadata JSON immediately after file selection', async () => {
    window.history.replaceState({}, '', '/admin');
    globalThis.fetch
      .mockResolvedValueOnce(createJsonResponse({ is_authenticated: true }))
      .mockResolvedValueOnce(
        createJsonResponse([
          {
            id: 1,
            title: 'Camera',
            content_markdown: 'Mirrorless',
            metadata: {},
            reservation: null,
            comments_enabled: true,
          },
        ]),
      )
      .mockResolvedValueOnce(
        createJsonResponse({
          urls: ['https://example.com/image-1.jpg'],
        }),
      );

    render(<App />);

    await screen.findByRole('heading', { name: 'Admin Wishlist Manager' });
    expect(screen.queryByText(/Attached images:/)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Upload image(s)' }));
    const input = document.querySelector('#images-1');
    const file = new File(['image-bytes'], 'camera.jpg', { type: 'image/jpeg' });
    fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() => {
      expect(screen.getAllByLabelText('Metadata JSON')[1]).toHaveValue(
        '{\n  "images": [\n    "https://example.com/image-1.jpg"\n  ]\n}',
      );
    });

    expect(globalThis.fetch).toHaveBeenLastCalledWith(
      '/api/admin/wishlist-items/1/images/',
      expect.objectContaining({
        method: 'POST',
        body: expect.any(FormData),
      }),
    );
    expect(screen.getByText('Images added to metadata.')).toBeInTheDocument();
  });

});
