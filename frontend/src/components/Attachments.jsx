import { useEffect, useRef, useState } from 'react';
import { api, fetchBlob, upload } from '../api.js';
import { fileSize } from '../format.js';
import { useToast } from './Toast.jsx';
import Icon from './Icon.jsx';

const ACCEPT = 'image/*,.pdf,.txt,.csv,.docx,.xlsx,.pptx,.zip';
const MAX = 10;

/** Pick photos or files; each one uploads right away and its id is kept in {@code value}. */
export function AttachmentPicker({ token, value, onChange }) {
  const toast = useToast();
  const input = useRef();
  const [busy, setBusy] = useState(0);

  async function add(files) {
    const list = [...files].slice(0, MAX - value.length);
    setBusy((b) => b + list.length);
    const added = [];
    for (const file of list) {
      try {
        if (file.size > 10 * 1024 * 1024) throw new Error(`${file.name} is larger than 10 MB`);
        added.push(await upload(file, token));
      } catch (err) {
        toast(err.message, 'error');
      } finally {
        setBusy((b) => b - 1);
      }
    }
    if (added.length) onChange((current) => [...current, ...added]);
  }

  return (
    <div className="attach">
      <div
        className="attach-drop"
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          add(e.dataTransfer.files);
        }}
      >
        <button type="button" className="btn btn-light btn-sm" onClick={() => input.current.click()} disabled={value.length >= MAX}>
          <Icon name="clip" size={16} /> Attach photos or files
        </button>
        <span className="muted small">{busy ? `Uploading ${busy}…` : 'or drop them here · up to 10 MB each'}</span>
        <input
          ref={input}
          type="file"
          multiple
          accept={ACCEPT}
          hidden
          onChange={(e) => {
            add(e.target.files);
            e.target.value = '';
          }}
        />
      </div>
      {value.length > 0 && (
        <AttachmentList
          token={token}
          items={value}
          onRemove={(id) => onChange((current) => current.filter((a) => a.id !== id))}
        />
      )}
    </div>
  );
}

function Thumb({ token, item }) {
  const [url, setUrl] = useState(null);
  useEffect(() => {
    let objectUrl;
    let alive = true;
    fetchBlob(`/api/attachments/${item.id}/file`, token)
      .then((blob) => {
        objectUrl = URL.createObjectURL(blob);
        if (alive) setUrl(objectUrl);
      })
      .catch(() => {});
    return () => {
      alive = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [item.id, token]);
  return url ? <img src={url} alt={item.filename} /> : <span className="thumb-placeholder" />;
}

async function download(token, item) {
  const blob = await fetchBlob(`/api/attachments/${item.id}/file`, token);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = item.filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function AttachmentList({ token, items, onRemove }) {
  const toast = useToast();
  if (!items?.length) return null;
  return (
    <ul className="attach-list">
      {items.map((item) => {
        const image = item.contentType.startsWith('image/');
        return (
          <li key={item.id} className={image ? 'attach-image' : 'attach-file'}>
            <button
              type="button"
              className="attach-open"
              onClick={() => download(token, item).catch((err) => toast(err.message, 'error'))}
              title={`Download ${item.filename}`}
            >
              {image ? <Thumb token={token} item={item} /> : <Icon name="file" size={22} />}
              <span className="attach-name">
                {item.filename}
                <span className="muted small">{fileSize(item.sizeBytes)}</span>
              </span>
            </button>
            {onRemove && (
              <button type="button" className="icon-btn attach-remove" onClick={() => onRemove(item.id)} aria-label={`Remove ${item.filename}`}>
                ✕
              </button>
            )}
          </li>
        );
      })}
    </ul>
  );
}

/** Loads file details for a list of ids (daily updates store only ids). */
export function AttachmentIds({ token, ids }) {
  const [items, setItems] = useState([]);
  const key = (ids ?? []).join(',');
  useEffect(() => {
    if (!key) return;
    let alive = true;
    api(`/api/attachments?ids=${key}`, { token })
      .then((d) => alive && setItems(d.attachments))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [key, token]);
  return key ? <AttachmentList token={token} items={items} /> : null;
}
