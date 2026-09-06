import { useEffect } from 'react'

// Sets <title> and the meta-description tag for the current page, restoring
// the previous values on unmount so navigating back to a page that doesn't
// call this (e.g. Landing) doesn't keep a stale title/description from
// whichever page was visited last.
export function useDocumentMeta(title, description) {
  useEffect(() => {
    const prevTitle = document.title
    if (title) document.title = title

    let tag = document.querySelector('meta[name="description"]')
    const prevDescription = tag?.getAttribute('content') ?? null
    if (description) {
      if (!tag) {
        tag = document.createElement('meta')
        tag.setAttribute('name', 'description')
        document.head.appendChild(tag)
      }
      tag.setAttribute('content', description)
    }

    return () => {
      document.title = prevTitle
      if (tag && prevDescription !== null) tag.setAttribute('content', prevDescription)
    }
  }, [title, description])
}
