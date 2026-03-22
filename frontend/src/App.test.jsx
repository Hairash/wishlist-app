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
            metadata: {},
            reservation: null,
            comments_enabled: true,
            comments_count: 0,
          },
        ]),
      )
      .mockResolvedValueOnce(createJsonResponse([]));

    render(<App />);

    expect(await screen.findByRole('heading', { name: 'Coffee Grinder' })).toBeInTheDocument();
    expect(screen.getByText('Great')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reserve' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add comment' })).toBeInTheDocument();
    expect(screen.queryByText('No comments yet.')).not.toBeInTheDocument();
  });

  test('supports reserve flow and updates reservation label', async () => {
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
            comments_count: 0,
          },
        ]),
      )
      .mockResolvedValueOnce(createJsonResponse([]))
      .mockResolvedValueOnce(
        createJsonResponse({
          id: 2,
          title: 'Headphones',
          content_markdown: 'Noise cancelling',
          metadata: {},
          reservation: { id: 22, reserved_by_name: 'Alex', can_undo: true },
          comments_enabled: true,
          comments_count: 0,
        }, true, 201),
      );

    render(<App />);

    await screen.findByRole('heading', { name: 'Headphones' });
    await screen.findByRole('button', { name: 'Reserve' });
    fireEvent.click(screen.getByRole('button', { name: 'Reserve' }));
    fireEvent.change(screen.getByLabelText('Your name (optional)'), { target: { value: 'Alex' } });
    fireEvent.click(screen.getByRole('button', { name: 'Confirm reserve' }));

    await screen.findByText('Reserved: Alex');
    expect(globalThis.fetch).toHaveBeenCalledWith(
      '/api/wishlist-items/2/reserve/',
      expect.objectContaining({ method: 'POST', credentials: 'include' }),
    );
    expect(screen.getByRole('button', { name: 'Undo reserve' })).toBeInTheDocument();
  });

  test('shows comments on card and opens add comment dialog', async () => {
    globalThis.fetch
      .mockResolvedValueOnce(createJsonResponse({ is_authenticated: false }))
      .mockResolvedValueOnce(
        createJsonResponse([
          {
            id: 3,
            title: 'Laptop Stand',
            content_markdown: 'Aluminum stand',
            metadata: {},
            reservation: null,
            comments_enabled: true,
            comments_count: 2,
          },
        ]),
      )
      .mockResolvedValueOnce(
        createJsonResponse([
          { id: 11, author_name: 'Sam', text: 'Looks great!', can_undo: false },
          { id: 12, author_name: '', text: 'Interested', can_undo: false },
        ]),
      );

    render(<App />);

    await screen.findByRole('heading', { name: 'Laptop Stand' });
    expect(screen.getByText('2 comments')).toBeInTheDocument();
    expect(screen.getByText(/Sam:/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Add comment' }));

    expect(await screen.findByText('Add comment: Laptop Stand')).toBeInTheDocument();
  });

  test('supports undoing reservation and comment made by same user', async () => {
    globalThis.fetch
      .mockResolvedValueOnce(createJsonResponse({ is_authenticated: false }))
      .mockResolvedValueOnce(
        createJsonResponse([
          {
            id: 5,
            title: 'Desk',
            content_markdown: 'Standing desk',
            metadata: {},
            reservation: { id: 50, reserved_by_name: 'Jamie', can_undo: true },
            comments_enabled: true,
            comments_count: 1,
          },
        ]),
      )
      .mockResolvedValueOnce(
        createJsonResponse([{ id: 501, author_name: 'Jamie', text: 'I can get this', can_undo: true }]),
      )
      .mockResolvedValueOnce(
        createJsonResponse({
          id: 5,
          title: 'Desk',
          content_markdown: 'Standing desk',
          metadata: {},
          reservation: null,
          comments_enabled: true,
          comments_count: 1,
        }),
      )
      .mockResolvedValueOnce(createJsonResponse(null, true, 204));

    render(<App />);

    await screen.findByRole('heading', { name: 'Desk' });
    fireEvent.click(screen.getByRole('button', { name: 'Undo reserve' }));
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Reserve' })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Remove comment' }));
    await waitFor(() => {
      expect(screen.queryByText(/Jamie:/)).not.toBeInTheDocument();
    });
    expect(globalThis.fetch).toHaveBeenCalledWith(
      '/api/wishlist-items/5/comments/501/',
      expect.objectContaining({ method: 'DELETE' }),
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
            comments_count: 0,
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
