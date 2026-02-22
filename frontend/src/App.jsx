import { useEffect, useState } from 'react';
const API_BASE = '/api';


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
  const response = await fetch(url, {
    headers: {
      'Content-Type': 'application/json',
      ...(options?.headers ?? {}),
    },
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

function ItemCard({ item, comments, commentsLoading, commentsError, onReserve, onLoadComments, onCreateComment }) {
  const [name, setName] = useState('');
  const [commentAuthor, setCommentAuthor] = useState('');
  const [commentText, setCommentText] = useState('');
  const [reserveState, setReserveState] = useState({ status: 'idle', message: '' });
  const [commentState, setCommentState] = useState({ status: 'idle', message: '' });

  const reservationLabel = item.reservation
    ? `Reserved by ${item.reservation.reserved_by_name || 'Anonymous'}`
    : 'Available';

  const links = Array.isArray(item.metadata?.links) ? item.metadata.links : [];
  const images = Array.isArray(item.metadata?.images) ? item.metadata.images : [];

  async function handleReserve(event) {
    event.preventDefault();
    setReserveState({ status: 'loading', message: '' });

    try {
      const updatedItem = await onReserve(item.id, name);
      setReserveState({ status: 'success', message: updatedItem.reservation?.reserved_by_name ? `Reserved by ${updatedItem.reservation.reserved_by_name}` : 'Reserved anonymously' });
      setName('');
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
    } catch (error) {
      setCommentState({ status: 'error', message: error.message });
    }
  }

  return (
    <article className="item-card">
      <h2>{item.title}</h2>
      <div className="markdown">{renderSafeMarkdown(item.content_markdown)}</div>

      {images.length > 0 && (
        <div className="item-images">
          {images.map((imageUrl) => (
            <img key={imageUrl} src={imageUrl} alt={`Preview for ${item.title}`} />
          ))}
        </div>
      )}

      {links.length > 0 && (
        <ul className="item-links">
          {links.map((link) => (
            <li key={link}>
              <a href={link} target="_blank" rel="noreferrer">
                {link}
              </a>
            </li>
          ))}
        </ul>
      )}

      <section className="item-section">
        <h3>Reservation</h3>
        <p aria-label={`Reservation status for ${item.title}`}>{reservationLabel}</p>
        {!item.reservation && (
          <form onSubmit={handleReserve}>
            <label htmlFor={`reserve-name-${item.id}`}>Your name (optional)</label>
            <input
              id={`reserve-name-${item.id}`}
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Anonymous"
            />
            <button type="submit" disabled={reserveState.status === 'loading'}>
              {reserveState.status === 'loading' ? 'Reserving...' : 'Reserve'}
            </button>
          </form>
        )}
        {reserveState.message && <p role="status">{reserveState.message}</p>}
      </section>

      <section className="item-section">
        <div className="comments-heading">
          <h3>Comments</h3>
          <button type="button" onClick={() => onLoadComments(item.id)}>
            Refresh comments
          </button>
        </div>

        {commentsLoading ? <p>Loading comments...</p> : null}
        {commentsError ? <p role="alert">{commentsError}</p> : null}

        {!commentsLoading && comments.length === 0 && <p>No comments yet.</p>}
        {comments.length > 0 && (
          <ul className="comments-list">
            {comments.map((comment) => (
              <li key={comment.id}>
                <strong>{comment.author_name || 'Anonymous'}:</strong> {comment.text}
              </li>
            ))}
          </ul>
        )}

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
      </section>
    </article>
  );
}

export function App() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [commentsByItem, setCommentsByItem] = useState({});

  useEffect(() => {
    let alive = true;

    async function loadItems() {
      try {
        const data = await requestJson(`${API_BASE}/wishlist-items/`);
        if (!alive) {
          return;
        }
        setItems(data);
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

  async function loadComments(itemId) {
    setCommentsByItem((current) => ({
      ...current,
      [itemId]: { ...(current[itemId] ?? { list: [] }), loading: true, error: '' },
    }));

    try {
      const comments = await requestJson(`${API_BASE}/wishlist-items/${itemId}/comments/`);
      setCommentsByItem((current) => ({
        ...current,
        [itemId]: { list: comments, loading: false, error: '' },
      }));
    } catch (loadError) {
      setCommentsByItem((current) => ({
        ...current,
        [itemId]: { ...(current[itemId] ?? { list: [] }), loading: false, error: loadError.message },
      }));
    }
  }

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
  }

  if (loading) {
    return <main className="container"><p>Loading wishlist...</p></main>;
  }

  if (error) {
    return (
      <main className="container">
        <h1>Wishlist</h1>
        <p role="alert">{error}</p>
      </main>
    );
  }

  return (
    <main className="container">
      <h1>Wishlist</h1>
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
            onLoadComments={loadComments}
            onCreateComment={createComment}
          />
        );
      })}
    </main>
  );
}
