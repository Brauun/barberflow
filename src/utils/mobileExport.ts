function isStandalonePwa() {
  return (
    window.matchMedia?.('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  )
}

function isIosLike() {
  const platform = navigator.platform || ''
  const userAgent = navigator.userAgent || ''
  const touchMac = platform === 'MacIntel' && navigator.maxTouchPoints > 1

  return /iPad|iPhone|iPod/.test(userAgent) || touchMac
}

function isMobileLike() {
  return /Android|webOS|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent)
}

function downloadHtml(html: string, filename: string) {
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')

  link.href = url
  link.download = filename
  link.rel = 'noopener'
  document.body.appendChild(link)
  link.click()
  link.remove()

  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export function exportHtmlReport(input: {
  filename: string
  html: string
  previewFeatures?: string
}) {
  const filename = input.filename.endsWith('.html')
    ? input.filename
    : `${input.filename}.html`
  const shouldDownload = isMobileLike() || isIosLike() || isStandalonePwa()

  if (shouldDownload) {
    downloadHtml(input.html, filename)
    return
  }

  const printWindow = window.open(
    '',
    '_blank',
    input.previewFeatures ?? 'width=920,height=1200',
  )

  if (!printWindow) {
    downloadHtml(input.html, filename)
    return
  }

  printWindow.document.open()
  printWindow.document.write(input.html)
  printWindow.document.close()
}
