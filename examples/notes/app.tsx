import { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';

interface Article {
  title: string;
  text: string;
}

function Notebook() {
  const [note, setNote] = useState(() => localStorage.getItem('note') ?? '');
  const [article, setArticle] = useState<Article | null>(null);
  const [status, setStatus] = useState('Ready.');
  const words = note.trim() ? note.trim().split(/\s+/).length : 0;

  async function loadArticle() {
    try {
      const response = await fetch('./article.json');
      if (!response.ok) throw new Error('Article unavailable');
      setArticle((await response.json()) as Article);
      setStatus('Article loaded using native fetch.');
    } catch {
      setStatus('The installed article could not be loaded.');
    }
  }

  useEffect(() => {
    void loadArticle();
    // The publisher uses ordinary PWA precaching; the host prepares this worker
    // during installation and supplies its supported registration interface.
    navigator.serviceWorker?.register('./sw.js').catch(() => {});
  }, []);

  function save() {
    localStorage.setItem('note', note);
    setStatus('Saved locally.');
  }

  function clear() {
    localStorage.removeItem('note');
    setNote('');
    setStatus('Note cleared.');
  }

  return (
    <main>
      <header>
        <strong>Private notes</strong>
        <span id="mode" className="badge">
          {window.privacyHost ? 'Installed · network isolated' : 'Notebook'}
        </span>
      </header>
      <label htmlFor="note">Your note</label>
      <textarea
        id="note"
        value={note}
        onChange={(event) => setNote(event.target.value)}
        placeholder="Write a note…"
      />
      <div className="row">
        <button id="save" onClick={save}>
          Save note
        </button>
        <button id="clear" className="secondary" onClick={clear}>
          Clear
        </button>
        <span id="word-count" className="muted">
          {words} words
        </span>
      </div>
      <p id="status" className="status" role="status">
        {status}
      </p>
      <section className="panel" aria-labelledby="article-title">
        <img
          id="illustration"
          src="./cover.svg"
          width="180"
          alt="Abstract green landscape"
        />
        <h2 id="article-title">{article?.title ?? 'Loading installed article…'}</h2>
        <p id="article">{article?.text}</p>
        <button id="load" onClick={() => void loadArticle()}>
          Reload article
        </button>
        <button
          id="external"
          className="secondary"
          onClick={async () => {
            try {
              await fetch('https://example.com/not-installed');
              setStatus('Unexpected network response.');
            } catch {
              setStatus('Uninstalled URL blocked.');
            }
          }}
        >
          Try an uninstalled URL
        </button>
      </section>
    </main>
  );
}

const root = document.getElementById('root');
if (!root) throw new Error('Notebook root is missing');
createRoot(root).render(<Notebook />);
