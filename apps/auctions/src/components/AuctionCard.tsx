"use client";

import React from "react";
import type { Auction } from "../types/auction";

type Props = {
  auction: Auction;
};

export const AuctionCard = React.memo(function AuctionCard({ auction }: Props) {
  const priceLabel = auction.highBid
    ? `High bid: ${formatMoney(auction.highBid)}`
    : auction.currentPrice
    ? `Current: ${formatMoney(auction.currentPrice)}`
    : auction.reservePrice
    ? `Reserve: ${formatMoney(auction.reservePrice)}`
    : "";

  const remaining = timeRemaining(auction.endTime);

  return (
    <article
      className="auction-card"
      aria-labelledby={`auction-${auction.id}-title`}
    >
      <div className="media">
        {/* Fix intrinsic size to avoid layout shift */}
        <img
          src={auction.imageUrl || "https://picsum.photos/seed/fallback/640/480"}
          alt=""
          width={320}
          height={240}
          loading="lazy"
        />
        {auction.reserveMet ? (
          <span className="badge" aria-label="Reserve met">
            Reserve met
          </span>
        ) : null}
      </div>
      <div className="content">
        <h3 id={`auction-${auction.id}-title`} className="title">
          {auction.title}
        </h3>
        <div className="meta" aria-live="polite">
          <span className="price">{priceLabel}</span>
          <span className="time">{remaining}</span>
        </div>
        <div className="actions">
          {/* Quick actions placeholder */}
          <button type="button" className="btn" aria-label="View auction">
            View
          </button>
          <button type="button" className="btn-secondary" aria-label="Share auction">
            Share
          </button>
        </div>
      </div>
      <style jsx>{`
        .auction-card {
          display: grid;
          grid-template-rows: auto 1fr;
          border: 1px solid #e5e7eb;
          border-radius: 0.5rem;
          overflow: hidden;
          background: white;
          width: 320px;
        }
        .media {
          position: relative;
          width: 320px;
          height: 240px;
          overflow: hidden;
          background: #f3f4f6;
        }
        img { display: block; width: 100%; height: 100%; object-fit: cover; }
        .badge {
          position: absolute;
          top: 8px;
          left: 8px;
          background: #10b981;
          color: white;
          padding: 2px 6px;
          border-radius: 9999px;
          font-size: 12px;
        }
        .content { padding: 12px; display: grid; gap: 8px; }
        .title { margin: 0; font-size: 16px; line-height: 1.25; }
        .meta { display: flex; justify-content: space-between; font-size: 14px; color: #374151; }
        .actions { display: flex; gap: 8px; }
        .btn { background: #111827; color: white; border: 0; padding: 6px 10px; border-radius: 6px; cursor: pointer; }
        .btn-secondary { background: #e5e7eb; color: #111827; border: 0; padding: 6px 10px; border-radius: 6px; cursor: pointer; }
      `}</style>
    </article>
  );
});

export function AuctionCardSkeleton() {
  return (
    <div className="auction-card" aria-hidden="true">
      <div className="media skeleton" />
      <div className="content">
        <div className="skeleton line" style={{ width: "70%", height: 16 }} />
        <div className="skeleton line" style={{ width: "50%", height: 14 }} />
        <div className="actions">
          <div className="skeleton" style={{ width: 60, height: 28, borderRadius: 6 }} />
          <div className="skeleton" style={{ width: 72, height: 28, borderRadius: 6 }} />
        </div>
      </div>
      <style jsx>{`
        .auction-card {
          display: grid;
          grid-template-rows: auto 1fr;
          border: 1px solid #e5e7eb;
          border-radius: 0.5rem;
          overflow: hidden;
          background: white;
          width: 320px;
        }
        .media { width: 320px; height: 240px; background: #e5e7eb; }
        .content { padding: 12px; display: grid; gap: 8px; }
        .actions { display: flex; gap: 8px; }
        .skeleton { background: linear-gradient(90deg, #e5e7eb 25%, #f3f4f6 37%, #e5e7eb 63%); background-size: 400% 100%; animation: shimmer 1.4s ease infinite; }
        .line { border-radius: 4px; }
        @keyframes shimmer { 0% { background-position: 100% 0; } 100% { background-position: -100% 0; } }
      `}</style>
    </div>
  );
}

function formatMoney(m: { amount: number; currency: string }): string {
  try {
    return new Intl.NumberFormat(undefined, { style: "currency", currency: m.currency }).format(m.amount);
  } catch {
    return `${m.amount.toFixed(2)} ${m.currency}`;
  }
}

function timeRemaining(isoEnd: string): string {
  const end = new Date(isoEnd).getTime();
  const now = Date.now();
  const diff = Math.max(0, end - now);
  const minutes = Math.floor(diff / 60000);
  if (minutes < 60) return `${minutes}m left`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h left`;
  const days = Math.floor(hours / 24);
  return `${days}d left`;
}

