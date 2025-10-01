import React from 'react'

export interface InscriptionPreviewProps {
  inscriptionId: string
  contentType?: string
  inscriptionNumber?: number
}

/**
 * Component to preview inscription content based on content type
 * Supports images, text, HTML, and other formats
 */
export function InscriptionPreview({ inscriptionId, contentType, inscriptionNumber }: InscriptionPreviewProps) {
  const [content, setContent] = React.useState<string | null>(null)
  const [isLoading, setIsLoading] = React.useState(false)
  const [error, setError] = React.useState(false)

  // Determine the ordinals content URL based on inscription ID
  const getContentUrl = (inscriptionId: string): string => {
    // Check if we're on testnet or mainnet based on environment
    const isTestnet = inscriptionId.includes('testnet') || 
                      (typeof window !== 'undefined' && window.location.hostname.includes('testnet'))
    
    // Use ordinals.com for mainnet, testnet.ordinals.com for testnet
    const baseUrl = isTestnet 
      ? 'https://testnet.ordinals.com'
      : 'https://ordinals.com'
    
    return `${baseUrl}/content/${inscriptionId}`
  }

  const contentUrl = getContentUrl(inscriptionId)

  // Determine how to render based on content type
  const renderContent = () => {
    if (!contentType) {
      return <DefaultPreview inscriptionNumber={inscriptionNumber} />
    }

    // Image types
    if (contentType.startsWith('image/')) {
      return (
        <div className="relative w-16 h-16 bg-gray-100 dark:bg-gray-700 rounded overflow-hidden flex-shrink-0">
          <img
            src={contentUrl}
            alt={`Inscription #${inscriptionNumber || ''}`}
            className="w-full h-full object-cover"
            loading="lazy"
            onError={(e) => {
              setError(true)
              const target = e.target as HTMLImageElement
              target.style.display = 'none'
            }}
          />
          {error && <DefaultPreview inscriptionNumber={inscriptionNumber} />}
        </div>
      )
    }

    // Text types
    if (contentType.startsWith('text/plain')) {
      return (
        <div className="relative w-16 h-16 bg-gray-100 dark:bg-gray-700 rounded overflow-hidden flex-shrink-0 flex items-center justify-center">
          <svg className="w-8 h-8 text-gray-400 dark:text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <span className="absolute bottom-0 right-0 text-[8px] font-mono bg-blue-500 text-white px-1 rounded-tl">TXT</span>
        </div>
      )
    }

    // HTML types
    if (contentType.startsWith('text/html') || contentType.includes('html')) {
      return (
        <div className="relative w-16 h-16 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded overflow-hidden flex-shrink-0">
          <iframe
            src={contentUrl}
            className="w-full h-full pointer-events-none"
            sandbox="allow-scripts"
            title={`Inscription #${inscriptionNumber || ''}`}
            loading="lazy"
            onError={() => setError(true)}
          />
          {error && <DefaultPreview inscriptionNumber={inscriptionNumber} />}
          <span className="absolute bottom-0 right-0 text-[8px] font-mono bg-purple-500 text-white px-1 rounded-tl">HTML</span>
        </div>
      )
    }

    // SVG
    if (contentType.includes('svg')) {
      return (
        <div className="relative w-16 h-16 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded overflow-hidden flex-shrink-0">
          <img
            src={contentUrl}
            alt={`Inscription #${inscriptionNumber || ''}`}
            className="w-full h-full object-contain"
            loading="lazy"
            onError={() => setError(true)}
          />
          {error && <DefaultPreview inscriptionNumber={inscriptionNumber} />}
          <span className="absolute bottom-0 right-0 text-[8px] font-mono bg-green-500 text-white px-1 rounded-tl">SVG</span>
        </div>
      )
    }

    // JSON
    if (contentType.includes('json')) {
      return (
        <div className="relative w-16 h-16 bg-gray-100 dark:bg-gray-700 rounded overflow-hidden flex-shrink-0 flex items-center justify-center">
          <svg className="w-8 h-8 text-gray-400 dark:text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
          </svg>
          <span className="absolute bottom-0 right-0 text-[8px] font-mono bg-yellow-500 text-white px-1 rounded-tl">JSON</span>
        </div>
      )
    }

    // Video
    if (contentType.startsWith('video/')) {
      return (
        <div className="relative w-16 h-16 bg-gray-100 dark:bg-gray-700 rounded overflow-hidden flex-shrink-0">
          <video
            src={contentUrl}
            className="w-full h-full object-cover"
            muted
            loop
            playsInline
            onError={() => setError(true)}
          />
          {error && <DefaultPreview inscriptionNumber={inscriptionNumber} />}
          <span className="absolute bottom-0 right-0 text-[8px] font-mono bg-red-500 text-white px-1 rounded-tl">VIDEO</span>
        </div>
      )
    }

    // Audio
    if (contentType.startsWith('audio/')) {
      return (
        <div className="relative w-16 h-16 bg-gray-100 dark:bg-gray-700 rounded overflow-hidden flex-shrink-0 flex items-center justify-center">
          <svg className="w-8 h-8 text-gray-400 dark:text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
          </svg>
          <span className="absolute bottom-0 right-0 text-[8px] font-mono bg-pink-500 text-white px-1 rounded-tl">AUDIO</span>
        </div>
      )
    }

    // Default fallback
    return <DefaultPreview inscriptionNumber={inscriptionNumber} />
  }

  return renderContent()
}

/**
 * Default preview component for unknown content types
 */
function DefaultPreview({ inscriptionNumber }: { inscriptionNumber?: number }) {
  return (
    <div className="relative w-16 h-16 bg-gradient-to-br from-orange-400 to-pink-500 rounded overflow-hidden flex-shrink-0 flex items-center justify-center">
      <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
      </svg>
      {inscriptionNumber !== undefined && (
        <span className="absolute bottom-0 right-0 text-[8px] font-mono bg-black bg-opacity-50 text-white px-1 rounded-tl">
          #{inscriptionNumber}
        </span>
      )}
    </div>
  )
}
