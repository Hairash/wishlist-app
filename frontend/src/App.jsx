import { useEffect, useRef, useState } from 'react';

const API_BASE = (import.meta.env.VITE_API_BASE_URL || '/api').replace(/\/$/, '');

function isSafeHttpUrl(value) {
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

function renderInlineMarkdown(text, keyPrefix) {
  const parts = [];
  const regex = /(!?\[[^\]]*\]\([^)]+\))/g;
  const tokens = text.split(regex);

  tokens.forEach((token, idx) => {
    const imageMatch = token.match(/^!\[([^\]]*)\]\(([^)]+)\)$/);
    if (imageMatch) {
      const [, alt, src] = imageMatch;
      if (isSafeHttpUrl(src)) {
        parts.push(<img key={`${keyPrefix}-img-${idx}`} src={src} alt={alt || 'Markdown image'} />);
      }
      return;
    }

    const linkMatch = token.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
    if (linkMatch) {
      const [, label, href] = linkMatch;
      if (isSafeHttpUrl(href)) {
        parts.push(
          <a key={`${keyPrefix}-link-${idx}`} href={href} target="_blank" rel="noreferrer">
            {label}
          </a>,
        );
      } else {
        parts.push(label);
      }
      return;
    }

    const boldRegex = /(\*\*[^*]+\*\*)/g;
    const boldParts = token.split(boldRegex);
    boldParts.forEach((segment, boldIdx) => {
      if (segment.startsWith('**') && segment.endsWith('**')) {
        parts.push(<strong key={`${keyPrefix}-bold-${idx}-${boldIdx}`}>{segment.slice(2, -2)}</strong>);
      } else {
        parts.push(segment);
      }
    });
  });

  return parts;
}

function renderSafeMarkdown(markdown) {
  return (markdown || '').split(/\n{2,}/).map((paragraph, index) => (
    <p key={`md-${index}`}>{renderInlineMarkdown(paragraph, `md-${index}`)}</p>
  ));
}

async function requestJson(url, options) {
  const isFormDataBody = options?.body instanceof FormData;
  const response = await fetch(url, {
    headers: isFormDataBody
      ? { ...(options?.headers ?? {}) }
      : {
          'Content-Type': 'application/json',
          ...(options?.headers ?? {}),
        },
    credentials: 'include',
    ...options,
  });

  let payload = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  if (!response.ok) {
    throw new Error(payload?.detail ?? 'Something went wrong. Please try again.');
  }

  return payload;
}

function parseMetadataDraft(metadataText) {
  const parsed = JSON.parse(metadataText || '{}');

  if (!parsed || Array.isArray(parsed) || typeof parsed !== 'object') {
    throw new Error('Metadata JSON must be an object.');
  }

  if (parsed.images !== undefined && !Array.isArray(parsed.images)) {
    throw new Error('Metadata JSON "images" must be an array.');
  }

  return parsed;
}

function ItemCard({
  item,
  comments,
  commentsLoading,
  commentsError,
  onReserve,
  onUndoReserve,
  onCreateComment,
  onUndoComment,
}) {
  const [reservationName, setReservationName] = useState('');
  const [commentAuthor, setCommentAuthor] = useState('');
  const [commentText, setCommentText] = useState('');
  const [isReserveDialogOpen, setIsReserveDialogOpen] = useState(false);
  const [isCommentFormDialogOpen, setIsCommentFormDialogOpen] = useState(false);
  const [reserveState, setReserveState] = useState({ status: 'idle', message: '' });
  const [commentState, setCommentState] = useState({ status: 'idle', message: '' });

  const images = Array.isArray(item.metadata?.images) ? item.metadata.images : [];
  const commentCount = Number.isInteger(item.comments_count) ? item.comments_count : 0;

  async function handleReserve(event) {
    event.preventDefault();
    setReserveState({ status: 'loading', message: '' });

    try {
      const updatedItem = await onReserve(item.id, reservationName);
      setReserveState({
        status: 'success',
        message: updatedItem.reservation?.reserved_by_name ? `Reserved by ${updatedItem.reservation.reserved_by_name}` : 'Reserved anonymously',
      });
      setReservationName('');
      setIsReserveDialogOpen(false);
    } catch (error) {
      setReserveState({ status: 'error', message: error.message });
    }
  }

  async function handleCommentSubmit(event) {
    event.preventDefault();
    setCommentState({ status: 'loading', message: '' });

    try {
      await onCreateComment(item.id, {
        author_name: commentAuthor,
        text: commentText,
      });
      setCommentState({ status: 'success', message: 'Comment posted.' });
      setCommentAuthor('');
      setCommentText('');
      setIsCommentFormDialogOpen(false);
    } catch (error) {
      setCommentState({ status: 'error', message: error.message });
    }
  }

  return (
    <article className="item-card">
      <div className="item-card-header">
        <h2>{item.title}</h2>
        <div className="item-card-actions">
          {item.reservation ? (
            <>
              <span className="reservation-pill">Reserved: {item.reservation.reserved_by_name || 'Anonymous'}</span>
              {item.reservation.can_undo ? (
                <button type="button" onClick={() => onUndoReserve(item.id)} className="button-pill">Undo reserve</button>
              ) : null}
            </>
          ) : (
            <button type="button" onClick={() => setIsReserveDialogOpen(true)} className="button-pill">
              Reserve
            </button>
          )}
          {commentCount > 0 ? <span className="comment-count">{commentCount} comments</span> : null}
        </div>
      </div>

      <div className="markdown">{renderSafeMarkdown(item.content_markdown)}</div>

      {images.length > 0 && (
        <div className="item-images">
          {images.map((imageUrl) => (
            <img key={imageUrl} src={imageUrl} alt={`Preview for ${item.title}`} />
          ))}
        </div>
      )}

      <section className="comments-preview">
        {commentsLoading ? <p>Loading comments...</p> : null}
        {commentsError ? <p role="alert">{commentsError}</p> : null}

        {!commentsLoading && comments.length > 0 ? (
          <ul className="comment-blocks">
            {comments.map((comment) => (
              <li key={comment.id} className="comment-pill">
                <span>
                  <strong>{comment.author_name || 'Anonymous'}:</strong> {comment.text}
                </span>
                {comment.can_undo ? (
                  <button type="button" onClick={() => onUndoComment(item.id, comment.id)} className="button-pill">
                    Remove comment
                  </button>
                ) : null}
              </li>
            ))}
          </ul>
        ) : null}

        {item.comments_enabled ? (
          <button type="button" onClick={() => setIsCommentFormDialogOpen(true)} className="button-pill">
            Add comment
          </button>
        ) : (
          <p>Comments are disabled for this item.</p>
        )}
      </section>

      {reserveState.message && <p role="status">{reserveState.message}</p>}

      {isReserveDialogOpen && (
        <div className="modal-backdrop" role="presentation">
          <div className="modal-content" role="dialog" aria-modal="true" aria-labelledby={`reserve-title-${item.id}`}>
            <h3 id={`reserve-title-${item.id}`}>Reserve: {item.title}</h3>
            <form onSubmit={handleReserve}>
              <label htmlFor={`reserve-name-${item.id}`}>Your name (optional)</label>
              <input
                id={`reserve-name-${item.id}`}
                value={reservationName}
                onChange={(event) => setReservationName(event.target.value)}
                placeholder="Anonymous"
              />
              <div className="dialog-actions">
                <button type="submit" disabled={reserveState.status === 'loading'}>
                  {reserveState.status === 'loading' ? 'Reserving...' : 'Confirm reserve'}
                </button>
                <button type="button" onClick={() => setIsReserveDialogOpen(false)}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isCommentFormDialogOpen && (
        <div className="modal-backdrop" role="presentation">
          <div className="modal-content" role="dialog" aria-modal="true" aria-labelledby={`comment-form-title-${item.id}`}>
            <div className="comments-heading">
              <h3 id={`comment-form-title-${item.id}`}>Add comment: {item.title}</h3>
              <button type="button" onClick={() => setIsCommentFormDialogOpen(false)}>Close</button>
            </div>

            {item.comments_enabled ? (
              <form onSubmit={handleCommentSubmit}>
                <label htmlFor={`comment-author-${item.id}`}>Name (optional)</label>
                <input
                  id={`comment-author-${item.id}`}
                  value={commentAuthor}
                  onChange={(event) => setCommentAuthor(event.target.value)}
                />

                <label htmlFor={`comment-text-${item.id}`}>Comment</label>
                <textarea
                  id={`comment-text-${item.id}`}
                  required
                  value={commentText}
                  onChange={(event) => setCommentText(event.target.value)}
                />

                <button type="submit" disabled={commentState.status === 'loading'}>
                  {commentState.status === 'loading' ? 'Posting...' : 'Post comment'}
                </button>
              </form>
            ) : (
              <p>Comments are disabled for this item.</p>
            )}
            {commentState.message && <p role="status">{commentState.message}</p>}
          </div>
        </div>
      )}
    </article>
  );
}

function PublicWishlistView() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [commentsByItem, setCommentsByItem] = useState({});

  useEffect(() => {
    let alive = true;
    async function loadItems() {
      try {
        const data = await requestJson(`${API_BASE}/wishlist-items/`);
        if (alive) {
          if (!Array.isArray(data)) {
            setError('Unexpected wishlist API response.');
            return;
          }

          setItems(data);
          setError('');

          const commentResults = await Promise.all(
            data.map(async (item) => {
              try {
                const list = await requestJson(`${API_BASE}/wishlist-items/${item.id}/comments/`);
                return [item.id, { list, loading: false, error: '' }];
              } catch (commentLoadError) {
                return [item.id, { list: [], loading: false, error: commentLoadError.message }];
              }
            }),
          );
          if (alive) {
            setCommentsByItem(Object.fromEntries(commentResults));
          }
        }
      } catch (loadError) {
        if (alive) {
          setError(loadError.message);
        }
      } finally {
        if (alive) {
          setLoading(false);
        }
      }
    }

    loadItems();
    return () => {
      alive = false;
    };
  }, []);

  async function reserveItem(itemId, reservedByName) {
    const updatedItem = await requestJson(`${API_BASE}/wishlist-items/${itemId}/reserve/`, {
      method: 'POST',
      body: JSON.stringify({ reserved_by_name: reservedByName }),
    });

    setItems((current) => current.map((item) => (item.id === itemId ? updatedItem : item)));
    return updatedItem;
  }

  async function createComment(itemId, payload) {
    const comment = await requestJson(`${API_BASE}/wishlist-items/${itemId}/comments/`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });

    setCommentsByItem((current) => {
      const currentList = current[itemId]?.list ?? [];
      return {
        ...current,
        [itemId]: {
          list: [...currentList, comment],
          loading: false,
          error: '',
        },
      };
    });
    setItems((current) =>
      current.map((item) => {
        if (item.id !== itemId) {
          return item;
        }
        const existingCount = Number.isInteger(item.comments_count) ? item.comments_count : 0;
        return { ...item, comments_count: existingCount + 1 };
      }),
    );
    return comment;
  }

  async function undoReserve(itemId) {
    const updatedItem = await requestJson(`${API_BASE}/wishlist-items/${itemId}/reserve/`, {
      method: 'DELETE',
    });
    setItems((current) => current.map((item) => (item.id === itemId ? updatedItem : item)));
  }

  async function undoComment(itemId, commentId) {
    await requestJson(`${API_BASE}/wishlist-items/${itemId}/comments/${commentId}/`, {
      method: 'DELETE',
    });
    setCommentsByItem((current) => {
      const currentList = current[itemId]?.list ?? [];
      return {
        ...current,
        [itemId]: {
          list: currentList.filter((comment) => comment.id !== commentId),
          loading: false,
          error: '',
        },
      };
    });
    setItems((current) =>
      current.map((item) => {
        if (item.id !== itemId) {
          return item;
        }
        const existingCount = Number.isInteger(item.comments_count) ? item.comments_count : 0;
        return { ...item, comments_count: Math.max(0, existingCount - 1) };
      }),
    );
  }

  if (loading) {
    return <p>Loading wishlist...</p>;
  }

  if (error) {
    return <p role="alert">{error}</p>;
  }

  return (
    <>
      {items.length === 0 && <p>No wishlist items available yet.</p>}
      {items.map((item) => {
        const commentState = commentsByItem[item.id] ?? { list: [], loading: false, error: '' };
        return (
          <ItemCard
            key={item.id}
            item={item}
            comments={commentState.list}
            commentsLoading={commentState.loading}
            commentsError={commentState.error}
            onReserve={reserveItem}
            onUndoReserve={undoReserve}
            onCreateComment={createComment}
            onUndoComment={undoComment}
          />
        );
      })}
    </>
  );
}

function AdminPanel({ onLogout }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [formState, setFormState] = useState({ title: '', content_markdown: '', metadata: '{}' });

  async function loadItems() {
    try {
      const payload = await requestJson(`${API_BASE}/admin/wishlist-items/`);
      setItems(Array.isArray(payload) ? payload : []);
      setError(Array.isArray(payload) ? '' : 'Unexpected admin API response.');
    } catch (loadError) {
      setError(loadError.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadItems();
  }, []);

  async function handleCreate(event) {
    event.preventDefault();
    try {
      const created = await requestJson(`${API_BASE}/admin/wishlist-items/`, {
        method: 'POST',
        body: JSON.stringify({ ...formState, metadata: JSON.parse(formState.metadata || '{}') }),
      });
      setItems((current) => [...current, created]);
      setFormState({ title: '', content_markdown: '', metadata: '{}' });
    } catch (createError) {
      setError(createError.message);
    }
  }

  async function updateItem(itemId, fields) {
    const updated = await requestJson(`${API_BASE}/admin/wishlist-items/${itemId}/`, {
      method: 'PATCH',
      body: JSON.stringify(fields),
    });
    setItems((current) => current.map((item) => (item.id === itemId ? updated : item)));
  }

  async function deleteItem(itemId) {
    await requestJson(`${API_BASE}/admin/wishlist-items/${itemId}/`, { method: 'DELETE' });
    setItems((current) => current.filter((item) => item.id !== itemId));
  }

  return (
    <>
      <div className="admin-header">
        <h1>Admin Wishlist Manager</h1>
        <button type="button" onClick={onLogout}>Log out</button>
      </div>
      {error && <p role="alert">{error}</p>}
      <form className="item-card" onSubmit={handleCreate}>
        <h2>Create item</h2>
        <label htmlFor="create-title">Title</label>
        <input id="create-title" required value={formState.title} onChange={(event) => setFormState((s) => ({ ...s, title: event.target.value }))} />
        <label htmlFor="create-markdown">Markdown description</label>
        <textarea id="create-markdown" required value={formState.content_markdown} onChange={(event) => setFormState((s) => ({ ...s, content_markdown: event.target.value }))} />
        <label htmlFor="create-metadata">Metadata JSON</label>
        <textarea id="create-metadata" value={formState.metadata} onChange={(event) => setFormState((s) => ({ ...s, metadata: event.target.value }))} />
        <button type="submit">Create</button>
      </form>

      {loading ? <p>Loading admin items...</p> : null}
      {items.map((item) => (
        <AdminItemEditor key={item.id} item={item} onUpdate={updateItem} onDelete={deleteItem} />
      ))}
    </>
  );
}

function AdminItemEditor({ item, onUpdate, onDelete }) {
  const [draft, setDraft] = useState({
    title: item.title,
    content_markdown: item.content_markdown,
    metadata: JSON.stringify(item.metadata ?? {}, null, 2),
  });
  const imageInputRef = useRef(null);
  const [imageUploadState, setImageUploadState] = useState({ status: 'idle', message: '' });

  let remainingImageSlots = 5;
  try {
    const metadata = parseMetadataDraft(draft.metadata);
    const currentImageCount = Array.isArray(metadata.images) ? metadata.images.length : 0;
    remainingImageSlots = Math.max(0, 5 - currentImageCount);
  } catch {
    remainingImageSlots = 5;
  }

  async function handleSave(event) {
    event.preventDefault();
    await onUpdate(item.id, {
      title: draft.title,
      content_markdown: draft.content_markdown,
      metadata: JSON.parse(draft.metadata || '{}'),
    });
  }

  async function handleImageSelection(event) {
    const files = Array.from(event.target.files ?? []);
    event.target.value = '';

    if (files.length === 0) {
      return;
    }

    let metadata;
    try {
      metadata = parseMetadataDraft(draft.metadata);
    } catch (error) {
      setImageUploadState({ status: 'error', message: error.message });
      return;
    }

    const existingImages = Array.isArray(metadata.images) ? metadata.images : [];
    if (existingImages.length + files.length > 5) {
      setImageUploadState({
        status: 'error',
        message: `You can upload ${remainingImageSlots} more image(s) for this item.`,
      });
      return;
    }

    const formData = new FormData();
    files.forEach((file) => formData.append('images', file));
    formData.append('persist_metadata', 'false');
    formData.append('existing_image_count', String(existingImages.length));

    setImageUploadState({ status: 'loading', message: '' });
    try {
      const payload = await requestJson(`${API_BASE}/admin/wishlist-items/${item.id}/images/`, {
        method: 'POST',
        body: formData,
      });
      const uploadedUrls = Array.isArray(payload?.urls) ? payload.urls : [];
      setDraft((current) => {
        const currentMetadata = parseMetadataDraft(current.metadata);
        const currentImages = Array.isArray(currentMetadata.images) ? currentMetadata.images : [];
        return {
          ...current,
          metadata: JSON.stringify(
            { ...currentMetadata, images: [...currentImages, ...uploadedUrls] },
            null,
            2,
          ),
        };
      });
      setImageUploadState({ status: 'success', message: 'Images added to metadata.' });
    } catch (uploadError) {
      setImageUploadState({ status: 'error', message: uploadError.message });
    }
  }

  function handleUploadButtonClick() {
    imageInputRef.current?.click();
  }

  return (
    <form className="item-card" onSubmit={handleSave}>
      <h2>Edit: {item.title}</h2>
      <label htmlFor={`title-${item.id}`}>Title</label>
      <input id={`title-${item.id}`} value={draft.title} onChange={(event) => setDraft((current) => ({ ...current, title: event.target.value }))} />
      <label htmlFor={`markdown-${item.id}`}>Markdown</label>
      <textarea id={`markdown-${item.id}`} value={draft.content_markdown} onChange={(event) => setDraft((current) => ({ ...current, content_markdown: event.target.value }))} />
      <label htmlFor={`metadata-${item.id}`}>Metadata JSON</label>
      <textarea id={`metadata-${item.id}`} value={draft.metadata} onChange={(event) => setDraft((current) => ({ ...current, metadata: event.target.value }))} />
      <input
        id={`images-${item.id}`}
        type="file"
        accept="image/*"
        multiple
        ref={imageInputRef}
        onChange={handleImageSelection}
        style={{ display: 'none' }}
      />
      <div className="admin-actions">
        <button type="submit">Save</button>
        <button type="button" onClick={handleUploadButtonClick} disabled={imageUploadState.status === 'loading' || remainingImageSlots === 0}>
          {imageUploadState.status === 'loading' ? 'Uploading...' : 'Upload image(s)'}
        </button>
        <button type="button" onClick={() => onDelete(item.id)}>Delete</button>
      </div>
      {imageUploadState.message && <p role="status">{imageUploadState.message}</p>}
    </form>
  );
}

function AdminLogin({ onLogin }) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  async function handleSubmit(event) {
    event.preventDefault();
    try {
      await requestJson(`${API_BASE}/admin/session/`, {
        method: 'POST',
        body: JSON.stringify({ password }),
      });
      onLogin();
    } catch (loginError) {
      setError(loginError.message);
    }
  }

  return (
    <form className="item-card" onSubmit={handleSubmit}>
      <h1>Admin Login</h1>
      <label htmlFor="admin-password">Password</label>
      <input id="admin-password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} />
      <button type="submit">Sign in</button>
      {error && <p role="alert">{error}</p>}
    </form>
  );
}

export function App() {
  const [path, setPath] = useState(window.location.pathname);
  const [checkingSession, setCheckingSession] = useState(true);
  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState(false);

  function navigate(nextPath, replace = false) {
    if (replace) {
      window.history.replaceState({}, '', nextPath);
    } else {
      window.history.pushState({}, '', nextPath);
    }
    setPath(nextPath);
  }

  useEffect(() => {
    function onPopState() {
      setPath(window.location.pathname);
    }

    window.addEventListener('popstate', onPopState);
    return () => {
      window.removeEventListener('popstate', onPopState);
    };
  }, []);

  useEffect(() => {
    async function checkSession() {
      try {
        const payload = await requestJson(`${API_BASE}/admin/session/`);
        const isAuthenticated = payload?.is_authenticated === true;
        setIsAdminAuthenticated(isAuthenticated);
        if (isAuthenticated && window.location.pathname === '/') {
          navigate('/admin', true);
        }
      } finally {
        setCheckingSession(false);
      }
    }

    checkSession();
  }, []);

  async function handleLogout() {
    await requestJson(`${API_BASE}/admin/session/`, { method: 'DELETE' });
    setIsAdminAuthenticated(false);
    navigate('/', true);
  }

  if (checkingSession) {
    return <main className="container"><p>Loading...</p></main>;
  }

  if (path === '/admin') {
    return (
      <main className="container">
        {isAdminAuthenticated ? (
          <AdminPanel onLogout={handleLogout} />
        ) : (
          <AdminLogin onLogin={() => setIsAdminAuthenticated(true)} />
        )}
      </main>
    );
  }

  return (
    <main className="container">
      <h1>Wishlist</h1>
      <PublicWishlistView />
    </main>
  );
}
