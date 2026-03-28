import { useState, useCallback } from 'react'
import Library from './components/Library'
import Reader from './components/Reader'
import ToastContainer from './components/ToastContainer'

export default function App() {
  const [view, setView]         = useState('library') // 'library' | 'reader'
  const [activeBook, setActiveBook] = useState(null)
  const [toasts, setToasts]     = useState([])

  const addToast = useCallback((message, type = 'success') => {
    const id = Date.now()
    setToasts(t => [...t, { id, message, type }])
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 3500)
  }, [])

  const openBook = useCallback((book) => {
    setActiveBook(book)
    setView('reader')
  }, [])

  const closeReader = useCallback(() => {
    setActiveBook(null)
    setView('library')
  }, [])

  return (
    <>
      {view === 'library' && (
        <Library onOpenBook={openBook} addToast={addToast} />
      )}
      {view === 'reader' && activeBook && (
        <Reader book={activeBook} onClose={closeReader} addToast={addToast} />
      )}
      <ToastContainer toasts={toasts} />
    </>
  )
}
