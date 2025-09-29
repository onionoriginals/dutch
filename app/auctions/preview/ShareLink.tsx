"use client";
import React from 'react';
import { encodeAuctionToQuery, type Auction } from '@/lib/auctionSchema';

export function ShareLink({ auction }: { auction: Auction }) {
  const [copied, setCopied] = React.useState(false);
  const url = React.useMemo(() => {
    if (typeof window === 'undefined') return '';
    const base = new URL(window.location.href);
    base.pathname = '/auctions/preview';
    base.search = `?state=${encodeAuctionToQuery(auction)}`;
    return base.toString();
  }, [auction]);

  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {}
  };

  return (
    <div className="flex items-center gap-2">
      <input readOnly value={url} className="w-64 truncate rounded-md border border-gray-300 bg-gray-50 px-2 py-1 text-xs text-gray-700" />
      <button onClick={onCopy} className="rounded-md bg-primary-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-primary-700">
        {copied ? 'Copied' : 'Copy link'}
      </button>
    </div>
  );
}
