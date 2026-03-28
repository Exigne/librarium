import { useState, useEffect, useRef, useCallback } from 'react'
import styles from './Reader.module.css'

export default function Reader({ book, onClose, addToast }) {
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState(null)
  const [progress, setProgress] = useState(0)
  const [showControls, setShowControls] = useState(true)
  const [fontSize, setFontSize] = useState(100) // percentage
  const [theme, setTheme]       = useState('dark') // dark | sepia | light

  const readerRef  = useRef(null)
  const epubRef    = useRef(null)
  const rendRef    = useRef(null)
  const pdfRef     = useRef(null)
  const pdfPageRef = useRef(1)
  const pdfTotalRef = useRef(0)
  const hideTimer  = useRef(null)

  const [pdfPage, setPdfPage]   = useState(1)
  const [pdfTotal, setPdfTotal] = useState(0)

  useEffect(() => {
    loadBook()
    return () => cleanup()
  }, [])

  const cleanup = () => {
    if (rendRef.current) { try { rendRef.current.destroy() } catch {} }
    if (epubRef.current) { try { epubRef.current.destroy() } catch {} }
    if (pdfRef.current)  { pdfRef.current = null }
  }

  const loadBook = async () => {
    try {
      setLoading(true)
      const res = await fetch(`/api/book?id=${book.id}`)
      if (!res.ok) throw new Error('Failed to load book')
      const data = await res.json()

      const binary = base64ToArrayBuffer(data.file_content)

      if (book.file_type === 'epub') {
        await loadEpub(binary)
      } else if (book.file_type === 'pdf') {
        await loadPdf(binary)
      } else {
        throw new Error(`Unsupported format: ${book.file_type}`)
      }
    } catch (err) {
      setError(err.message)
      addToast(err.message, 'error')
    } finally {
      setLoading(false)
    }
  }

  const loadEpub = async (arrayBuffer) => {
    const ePub = (await import('epubjs')).default
    const epub = ePub(arrayBuffer)
    epubRef.current = epub

    const rendition = epub.renderTo(readerRef.current, {
      width: '100%',
      height: '100%',
      flow: 'paginated',
    })
    rendRef.current = rendition

    applyEpubTheme(rendition, theme, fontSize)

    await rendition.display()

    // Track progress
    epub.ready.then(() => {
      epub.locations.generate(1600).then(() => {
        rendition.on('locationChanged', (loc) => {
          const pct = epub.locations.percentageFromCfi(loc.start.cfi)
          setProgress(Math.round((pct || 0) * 100))
        })
      })
    })
  }

  const loadPdf = async (arrayBuffer) => {
    const pdfjsLib = await import('pdfjs-dist')
    pdfjsLib.GlobalWorkerOptions.workerSrc =
      `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`

    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise
    pdfRef.current = pdf
    pdfTotalRef.current = pdf.numPages
    setPdfTotal(pdf.numPages)
    await renderPdfPage(pdf, 1)
  }

  const renderPdfPage = async (pdf, pageNum) => {
    if (!pdf) return
    const page = await pdf.getPage(pageNum)
    const canvas = readerRef.current?.querySelector('canvas')
    if (!canvas) return

    const viewport = page.getViewport({ scale: (fontSize / 100) * 1.5 })
    const ctx = canvas.getContext('2d')
    canvas.width  = viewport.width
    canvas.height = viewport.height

    await page.render({ canvasContext: ctx, viewport }).promise
    pdfPageRef.current = pageNum
    setPdfPage(pageNum)
    setProgress(Math.round((pageNum / pdf.numPages) * 100))
  }

  const applyEpubTheme = (rendition, t, fs) => {
    const themes = {
      dark:  { body: { background: '#0e0c0a', color: '#e4d8c0' } },
      sepia: { body: { background: '#f4ece0', color: '#3a2c1a' } },
      light: { body: { background: '#ffffff', color: '#1a1a1a' } },
    }
    rendition.themes.register('custom', themes[t] || themes.dark)
    rendition.themes.select('custom')
    rendition.themes.fontSize(`${fs}%`)
  }

  // Keyboard nav
  useEffect(() => {
    const handler = (e) => {
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') nextPage()
      if (e.key === 'ArrowLeft'  || e.key === 'ArrowUp')   prevPage()
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  const nextPage = useCallback(() => {
    if (rendRef.current) rendRef.current.next()
    if (pdfRef.current && pdfPageRef.current < pdfTotalRef.current) {
      const next = pdfPageRef.current + 1
      renderPdfPage(pdfRef.current, next)
    }
  }, [])

  const prevPage = useCallback(() => {
    if (rendRef.current) rendRef.current.prev()
    if (pdfRef.current && pdfPageRef.current > 1) {
      const prev = pdfPageRef.current - 1
      renderPdfPage(pdfRef.current, prev)
    }
  }, [])

  // Font size changes
  useEffect(() => {
    if (rendRef.current) rendRef.current.themes.fontSize(`${fontSize}%`)
    if (pdfRef.current)  renderPdfPage(pdfRef.current, pdfPageRef.current)
  }, [fontSize])

  // Theme changes
  useEffect(() => {
    if (rendRef.current) applyEpubTheme(rendRef.current, theme, fontSize)
  }, [theme])

  // Auto-hide controls
  const resetHideTimer = () => {
    setShowControls(true)
    clearTimeout(hideTimer.current)
    hideTimer.current = setTimeout(() => setShowControls(false), 3000)
  }

  useEffect(() => {
    resetHideTimer()
    return () => clearTimeout(hideTimer.current)
  }, [])

  const themeColors = {
    dark:  { bg: '#0e0c0a', fg: '#e4d8c0' },
    sepia: { bg: '#f4ece0', fg: '#3a2c1a' },
    light: { bg: '#ffffff', fg: '#1a1a1a' },
  }

  return (
    <div
      className={`${styles.root} ${styles[theme]}`}
      onMouseMove={resetHideTimer}
    >
      {/* Top bar */}
      <div className={`${styles.topBar} ${showControls ? styles.visible : ''}`}>
        <button className={styles.closeReader} onClick={onClose}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M3 3l10 10M13 3L3 13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
          Library
        </button>
        <div className={styles.bookInfo}>
          <span className={styles.bookTitleBar}>{book.title}</span>
          {book.author && <span className={styles.bookAuthorBar}>— {book.author}</span>}
        </div>
        <div className={styles.controls}>
          {/* Font size */}
          <div className={styles.controlGroup}>
            <button className={styles.controlBtn} onClick={() => setFontSize(s => Math.max(70, s - 10))}>A-</button>
            <span className={styles.controlLabel}>{fontSize}%</span>
            <button className={styles.controlBtn} onClick={() => setFontSize(s => Math.min(160, s + 10))}>A+</button>
          </div>
          {/* Theme */}
          <div className={styles.controlGroup}>
            {['dark', 'sepia', 'light'].map(t => (
              <button
                key={t}
                className={`${styles.themeBtn} ${theme === t ? styles.activeTheme : ''}`}
                onClick={() => setTheme(t)}
                style={{ background: themeColors[t].bg, color: themeColors[t].fg }}
                title={t}
              >
                {t[0].toUpperCase()}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Progress bar */}
      <div className={styles.progressBar}>
        <div className={styles.progressFill} style={{ width: `${progress}%` }} />
      </div>

      {/* Reader area */}
      <div className={styles.readerWrapper}>
        {/* Prev button */}
        <button
          className={`${styles.navBtn} ${styles.prevBtn} ${showControls ? styles.visible : ''}`}
          onClick={prevPage}
          aria-label="Previous page"
        >
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <path d="M12 4L6 10l6 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>

        {/* Content */}
        <div className={styles.contentArea}>
          {loading && (
            <div className={styles.loadingState}>
              <div className={styles.loadingSpinner} />
              <p>Opening {book.title}…</p>
            </div>
          )}
          {error && (
            <div className={styles.errorState}>
              <p>⚠ {error}</p>
              <button onClick={onClose}>Go back</button>
            </div>
          )}

          {book.file_type === 'epub' && !error && (
            <div ref={readerRef} className={styles.epubArea} />
          )}

          {book.file_type === 'pdf' && !error && (
            <div ref={readerRef} className={styles.pdfArea}>
              <canvas className={styles.pdfCanvas} />
              {!loading && (
                <div className={styles.pdfPageInfo}>
                  {pdfPage} / {pdfTotal}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Next button */}
        <button
          className={`${styles.navBtn} ${styles.nextBtn} ${showControls ? styles.visible : ''}`}
          onClick={nextPage}
          aria-label="Next page"
        >
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <path d="M8 4l6 6-6 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
      </div>

      {/* Progress label */}
      <div className={`${styles.progressLabel} ${showControls ? styles.visible : ''}`}>
        {progress}% read
      </div>
    </div>
  )
}

function base64ToArrayBuffer(base64) {
  const binaryString = atob(base64)
  const bytes = new Uint8Array(binaryString.length)
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i)
  }
  return bytes.buffer
}
