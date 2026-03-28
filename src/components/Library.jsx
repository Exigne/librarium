import { useState, useEffect, useRef } from 'react'
import styles from './Library.module.css'

export default function Library({ onOpenBook, addToast }) {
  const [books, setBooks]       = useState([])
  const [loading, setLoading]   = useState(true)
  const [uploading, setUploading] = useState(false)
  const [showUpload, setShowUpload] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const [uploadFile, setUploadFile] = useState(null)
  const [meta, setMeta]         = useState({ title: '', author: '' })
  const [deleteId, setDeleteId] = useState(null)
  const fileInputRef            = useRef()

  const fetchBooks = async () => {
    try {
      const res = await fetch('/api/books')
      const text = await res.text()
      let data
      try { data = JSON.parse(text) } catch {
        throw new Error(`Server error: ${text.slice(0, 120)}`)
      }
      if (!res.ok) throw new Error(data.error || 'Failed to load library')
      setBooks(data.books || [])
    } catch (err) {
      addToast(err.message, 'error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchBooks() }, [])

  const handleFile = (file) => {
    if (!file) return
    const allowed = ['application/epub+zip', 'application/pdf',
                     'application/x-mobipocket-ebook']
    const ext = file.name.split('.').pop().toLowerCase()
    if (!allowed.includes(file.type) && !['epub','pdf'].includes(ext)) {
      addToast('Only EPUB and PDF files are supported', 'error')
      return
    }
    setUploadFile(file)
    // Auto-fill title from filename
    const guessTitle = file.name.replace(/\.(epub|pdf)$/i, '').replace(/[-_]/g, ' ')
    setMeta(m => ({ ...m, title: m.title || guessTitle }))
    setShowUpload(true)
  }

  const handleDrop = (e) => {
    e.preventDefault()
    setDragOver(false)
    handleFile(e.dataTransfer.files[0])
  }

  const handleUpload = async () => {
    if (!uploadFile || !meta.title.trim()) return
    setUploading(true)
    try {
      // Read file as base64
      const base64 = await fileToBase64(uploadFile)
      const ext = uploadFile.name.split('.').pop().toLowerCase()

      const res = await fetch('/api/books', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title:        meta.title.trim(),
          author:       meta.author.trim() || 'Unknown',
          filename:     uploadFile.name,
          file_type:    ext,
          file_size:    uploadFile.size,
          file_content: base64,
        })
      })

      const text = await res.text()
      let result
      try { result = JSON.parse(text) } catch {
        throw new Error(`Server error: ${text.slice(0, 120)}`)
      }
      if (!res.ok) throw new Error(result.error || 'Upload failed')

      addToast(`"${meta.title}" added to your library`)
      setShowUpload(false)
      setUploadFile(null)
      setMeta({ title: '', author: '' })
      fetchBooks()
    } catch (err) {
      addToast(err.message || 'Upload failed', 'error')
    } finally {
      setUploading(false)
    }
  }

  const handleDelete = async (id, title) => {
    if (deleteId === id) {
      try {
        await fetch(`/api/book?id=${id}`, { method: 'DELETE' })
        addToast(`"${title}" removed`)
        setBooks(b => b.filter(x => x.id !== id))
      } catch {
        addToast('Delete failed', 'error')
      }
      setDeleteId(null)
    } else {
      setDeleteId(id)
      setTimeout(() => setDeleteId(null), 2500)
    }
  }

  const fileToBase64 = (file) => new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload  = () => resolve(reader.result.split(',')[1])
    reader.onerror = reject
    reader.readAsDataURL(file)
  })

  const formatSize = (bytes) => {
    if (!bytes) return ''
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`
  }

  const formatDate = (iso) => {
    if (!iso) return ''
    return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
  }

  return (
    <div className={styles.root}>
      {/* Header */}
      <header className={styles.header}>
        <div className={styles.headerInner}>
          <div className={styles.brand}>
            <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
              <rect x="3" y="2" width="14" height="24" rx="2" fill="#c8922a" opacity="0.3"/>
              <rect x="5" y="4" width="14" height="24" rx="2" fill="#c8922a" opacity="0.5"/>
              <rect x="7" y="2" width="14" height="24" rx="2" fill="#c8922a"/>
              <rect x="9" y="6" width="8" height="1.5" rx="0.75" fill="#0e0c0a" opacity="0.5"/>
              <rect x="9" y="9" width="10" height="1" rx="0.5" fill="#0e0c0a" opacity="0.3"/>
            </svg>
            <span className={styles.brandName}>Librarium</span>
          </div>
          <button className={styles.uploadBtn} onClick={() => setShowUpload(true)}>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M7 1v9M3 4l4-4 4 4M2 11h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            Add Book
          </button>
        </div>
      </header>

      {/* Drop zone overlay */}
      <div
        className={`${styles.dropZone} ${dragOver ? styles.dropActive : ''}`}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
      >
        {dragOver && (
          <div className={styles.dropOverlay}>
            <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
              <path d="M24 8v24M12 20l12-12 12 12M8 36h32" stroke="#c8922a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            <p>Drop your ebook here</p>
          </div>
        )}
      </div>

      {/* Content */}
      <main className={styles.main}>
        {loading ? (
          <div className={styles.grid}>
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className={styles.skeletonCard} style={{ animationDelay: `${i * 0.08}s` }}>
                <div className="skeleton" style={{ width: '100%', height: '200px', borderRadius: '6px' }} />
                <div className="skeleton" style={{ width: '70%', height: '18px', marginTop: '14px' }} />
                <div className="skeleton" style={{ width: '45%', height: '13px', marginTop: '8px' }} />
              </div>
            ))}
          </div>
        ) : books.length === 0 ? (
          <div className={styles.empty}>
            <svg width="64" height="64" viewBox="0 0 64 64" fill="none" opacity="0.25">
              <rect x="8" y="6" width="30" height="52" rx="3" stroke="#c8922a" strokeWidth="1.5"/>
              <rect x="14" y="6" width="30" height="52" rx="3" stroke="#c8922a" strokeWidth="1.5"/>
              <rect x="20" y="6" width="30" height="52" rx="3" stroke="#c8922a" strokeWidth="1.5"/>
              <line x1="26" y1="18" x2="44" y2="18" stroke="#c8922a" strokeWidth="1.5" strokeLinecap="round"/>
              <line x1="26" y1="24" x2="44" y2="24" stroke="#c8922a" strokeWidth="1.5" strokeLinecap="round"/>
              <line x1="26" y1="30" x2="36" y2="30" stroke="#c8922a" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
            <h2>Your library is empty</h2>
            <p>Upload EPUB or PDF files to start reading</p>
            <button className={styles.emptyBtn} onClick={() => setShowUpload(true)}>
              Add your first book
            </button>
          </div>
        ) : (
          <>
            <div className={styles.libraryHeader}>
              <h1 className={styles.libraryTitle}>My Library</h1>
              <span className={styles.bookCount}>{books.length} {books.length === 1 ? 'book' : 'books'}</span>
            </div>
            <div className={styles.grid}>
              {books.map((book, i) => (
                <div
                  key={book.id}
                  className={`${styles.card} fade-in`}
                  style={{ animationDelay: `${i * 0.06}s` }}
                >
                  <button className={styles.cardCover} onClick={() => onOpenBook(book)}>
                    <BookCover title={book.title} author={book.author} fileType={book.file_type} index={i} />
                    <div className={styles.cardOverlay}>
                      <span className={styles.readBtn}>
                        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                          <path d="M8 2C4.5 2 2 5 2 8s2.5 6 6 6 6-3 6-6-2.5-6-6-6z" stroke="currentColor" strokeWidth="1.5"/>
                          <path d="M6.5 5.5l4 2.5-4 2.5V5.5z" fill="currentColor"/>
                        </svg>
                        Read
                      </span>
                    </div>
                  </button>
                  <div className={styles.cardInfo}>
                    <h3 className={styles.cardTitle} title={book.title}>{book.title}</h3>
                    <p className={styles.cardAuthor}>{book.author}</p>
                    <div className={styles.cardMeta}>
                      <span className={`${styles.badge} ${styles[book.file_type]}`}>
                        {book.file_type?.toUpperCase()}
                      </span>
                      <span className={styles.cardSize}>{formatSize(book.file_size)}</span>
                    </div>
                    <div className={styles.cardFooter}>
                      <span className={styles.cardDate}>{formatDate(book.created_at)}</span>
                      <button
                        className={`${styles.deleteBtn} ${deleteId === book.id ? styles.deleteConfirm : ''}`}
                        onClick={() => handleDelete(book.id, book.title)}
                        title={deleteId === book.id ? 'Click again to confirm' : 'Remove book'}
                      >
                        {deleteId === book.id ? 'Confirm?' : (
                          <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
                            <path d="M2 3h9M5 3V2h3v1M4 3l.5 8M9 3l-.5 8M6.5 3v8" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
                          </svg>
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </main>

      {/* Upload Modal */}
      {showUpload && (
        <div className={styles.modalBackdrop} onClick={(e) => e.target === e.currentTarget && !uploading && setShowUpload(false)}>
          <div className={styles.modal}>
            <div className={styles.modalHeader}>
              <h2>Add a Book</h2>
              <button className={styles.closeBtn} onClick={() => !uploading && setShowUpload(false)}>
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <path d="M3 3l10 10M13 3L3 13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                </svg>
              </button>
            </div>

            {/* File drop area */}
            <div
              className={`${styles.fileDropArea} ${uploadFile ? styles.fileSelected : ''}`}
              onClick={() => !uploading && fileInputRef.current?.click()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => { e.preventDefault(); handleFile(e.dataTransfer.files[0]) }}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".epub,.pdf"
                style={{ display: 'none' }}
                onChange={(e) => handleFile(e.target.files[0])}
              />
              {uploadFile ? (
                <div className={styles.fileInfo}>
                  <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
                    <rect x="5" y="2" width="18" height="24" rx="3" fill="#c8922a" opacity="0.2"/>
                    <rect x="5" y="2" width="18" height="24" rx="3" stroke="#c8922a" strokeWidth="1.5"/>
                    <path d="M9 10h10M9 14h10M9 18h6" stroke="#c8922a" strokeWidth="1.2" strokeLinecap="round"/>
                  </svg>
                  <div>
                    <p className={styles.fileName}>{uploadFile.name}</p>
                    <p className={styles.fileSize}>{formatSize(uploadFile.size)}</p>
                  </div>
                  <button className={styles.changeFile} onClick={(e) => { e.stopPropagation(); setUploadFile(null) }}>×</button>
                </div>
              ) : (
                <>
                  <svg width="36" height="36" viewBox="0 0 36 36" fill="none">
                    <path d="M18 6v18M9 15l9-9 9 9M5 27h26" stroke="#5a5048" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                  <p>Drop an EPUB or PDF here</p>
                  <span>or click to browse</span>
                </>
              )}
            </div>

            {/* Metadata */}
            <div className={styles.fieldGroup}>
              <label className={styles.label}>Title *</label>
              <input
                className={styles.input}
                type="text"
                placeholder="Book title"
                value={meta.title}
                onChange={(e) => setMeta(m => ({ ...m, title: e.target.value }))}
                disabled={uploading}
              />
            </div>
            <div className={styles.fieldGroup}>
              <label className={styles.label}>Author</label>
              <input
                className={styles.input}
                type="text"
                placeholder="Author name"
                value={meta.author}
                onChange={(e) => setMeta(m => ({ ...m, author: e.target.value }))}
                disabled={uploading}
              />
            </div>

            <div className={styles.sizeNote}>
              ⚠ Files up to ~4 MB are supported (Netlify function limit)
            </div>

            <button
              className={styles.submitBtn}
              onClick={handleUpload}
              disabled={!uploadFile || !meta.title.trim() || uploading}
            >
              {uploading ? (
                <>
                  <span className={styles.spinner} />
                  Uploading…
                </>
              ) : 'Add to Library'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// Deterministic book cover generator
function BookCover({ title, author, fileType, index }) {
  const palettes = [
    { bg: '#3d2810', spine: '#c8922a', text: '#f5e6cc' },
    { bg: '#0d2235', spine: '#4a90a4', text: '#c8dde8' },
    { bg: '#1a2d1a', spine: '#6aaa5e', text: '#c8e8c0' },
    { bg: '#2d1428', spine: '#9a5aaa', text: '#e8c8f0' },
    { bg: '#2d1414', spine: '#aa4a4a', text: '#f0c8c8' },
    { bg: '#1a1a2d', spine: '#5a6aaa', text: '#c8ccf0' },
  ]
  const p = palettes[index % palettes.length]

  return (
    <div className={styles.cover} style={{ background: p.bg }}>
      <div className={styles.coverSpine} style={{ background: p.spine }} />
      <div className={styles.coverLines}>
        {[0,1,2,3].map(i => (
          <div key={i} className={styles.coverLine} style={{ background: p.spine, opacity: 0.12 + i * 0.04 }} />
        ))}
      </div>
      <div className={styles.coverContent}>
        <p className={styles.coverTitle} style={{ color: p.text }}>{title}</p>
        {author && <p className={styles.coverAuthor} style={{ color: p.spine }}>{author}</p>}
      </div>
      <div className={styles.coverType} style={{ color: p.spine, borderColor: p.spine }}>
        {fileType?.toUpperCase()}
      </div>
    </div>
  )
}
