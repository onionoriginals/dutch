"use client";

import React from "react";
import { AuctionCard, AuctionCardSkeleton } from "../../src/components/AuctionCard";
import { createMockAdapter } from "../../src/lib/auctions/mockAdapter";
import type { AuctionFilter, Auction } from "../../src/types/auction";
import { AuctionStatus, AuctionType } from "../../src/types/auction";

const adapter = createMockAdapter();

type State = {
  items: Auction[];
  total: number;
  loading: boolean;
  error?: string;
};

export default function AuctionsPage() {
  const [state, setState] = React.useState({ items: [], total: 0, loading: true } as State);
  const [filter, setFilter] = React.useState({
    types: [],
    statuses: [],
    sort: "endTimeAsc",
    page: 1,
    pageSize: 12,
  });

  const [search, setSearch] = React.useState("");
  const [startDate, setStartDate] = React.useState("");
  const [endDate, setEndDate] = React.useState("");

  const fetchData = React.useCallback(async () => {
    setState((s: State) => ({ ...s, loading: true, error: undefined }));
    try {
      const res = await adapter.list({ ...filter, search, startDate: startDate || undefined, endDate: endDate || undefined });
      setState({ items: res.items, total: res.total, loading: false });
    } catch (e: any) {
      setState({ items: [], total: 0, loading: false, error: e?.message || "Failed to load" });
    }
  }, [filter, search, startDate, endDate]);

  React.useEffect(() => {
    fetchData();
  }, [fetchData]);

  function onToggleType(t: AuctionType) {
    setFilter((f: AuctionFilter) => {
      const types = new Set(f.types || []);
      types.has(t) ? types.delete(t) : types.add(t);
      return { ...f, page: 1, types: Array.from(types) };
    });
  }

  function onToggleStatus(s: AuctionStatus) {
    setFilter((f: AuctionFilter) => {
      const statuses = new Set(f.statuses || []);
      statuses.has(s) ? statuses.delete(s) : statuses.add(s);
      return { ...f, page: 1, statuses: Array.from(statuses) };
    });
  }

  function onSortChange(e: any) {
    setFilter((f: AuctionFilter) => ({ ...f, page: 1, sort: e.target.value as any }));
  }

  function onPageChange(nextPage: number) {
    setFilter((f: AuctionFilter) => ({ ...f, page: nextPage }));
  }

  const totalPages = Math.max(1, Math.ceil(state.total / (filter.pageSize || 12)));

  return (
    <main className="container">
      <h1 className="sr-only">Auctions</h1>
      <Filters
        search={search}
        setSearch={setSearch}
        startDate={startDate}
        setStartDate={setStartDate}
        endDate={endDate}
        setEndDate={setEndDate}
        types={filter.types || []}
        toggleType={onToggleType}
        statuses={filter.statuses || []}
        toggleStatus={onToggleStatus}
        sort={filter.sort || "endTimeAsc"}
        onSortChange={onSortChange}
        onApply={() => setFilter((f: AuctionFilter) => ({ ...f, page: 1 }))}
      />

      <section aria-busy={state.loading} aria-live="polite">
        {state.loading ? (
          <div className="grid">
            {Array.from({ length: 8 }).map((_, i) => (
              <AuctionCardSkeleton key={i} />
            ))}
          </div>
        ) : state.error ? (
          <div role="alert" className="error">{state.error}</div>
        ) : state.items.length === 0 ? (
          <div className="empty">No auctions found.</div>
        ) : (
          <div className="grid">
            {state.items.map((a: Auction) => (
              <AuctionCard key={a.id} auction={a} />
            ))}
          </div>
        )}
      </section>

      <Pagination
        page={filter.page || 1}
        totalPages={totalPages}
        onChange={onPageChange}
      />

      <style jsx>{`
        .container { padding: 16px; display: grid; gap: 16px; }
        .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 16px; }
        .empty { color: #6b7280; padding: 24px; }
        .error { color: #b91c1c; padding: 24px; background: #fee2e2; border: 1px solid #fecaca; border-radius: 8px; }
        .sr-only { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0,0,0,0); white-space: nowrap; border: 0; }
      `}</style>
    </main>
  );
}

function Filters(props: {
  search: string;
  setSearch: (v: string) => void;
  startDate: string;
  setStartDate: (v: string) => void;
  endDate: string;
  setEndDate: (v: string) => void;
  types: AuctionType[];
  toggleType: (t: AuctionType) => void;
  statuses: AuctionStatus[];
  toggleStatus: (s: AuctionStatus) => void;
  sort: NonNullable<AuctionFilter["sort"]>;
  onSortChange: (e: any) => void;
  onApply: () => void;
}) {
  const { search, setSearch, startDate, setStartDate, endDate, setEndDate, types, toggleType, statuses, toggleStatus, sort, onSortChange, onApply } = props;
  return (
    <form className="filters" role="search" aria-label="Filter auctions" onSubmit={(e: any) => { e.preventDefault(); onApply(); }}>
      <div className="row">
        <label>
          <span className="label">Search</span>
          <input
            type="search"
            value={search}
            onChange={(e: any) => setSearch(e.target.value)}
            placeholder="Search auctions"
            aria-label="Search"
          />
        </label>

        <fieldset>
          <legend>Type</legend>
          {Object.values(AuctionType).map((t) => (
            <label key={t} className="chip">
              <input type="checkbox" checked={types.includes(t)} onChange={() => toggleType(t)} />
              <span>{t}</span>
            </label>
          ))}
        </fieldset>

        <fieldset>
          <legend>Status</legend>
          {Object.values(AuctionStatus).map((s) => (
            <label key={s} className="chip">
              <input type="checkbox" checked={statuses.includes(s)} onChange={() => toggleStatus(s)} />
              <span>{s}</span>
            </label>
          ))}
        </fieldset>
      </div>

      <div className="row">
        <label>
          <span className="label">Start date</span>
          <input type="date" value={startDate} onChange={(e: any) => setStartDate(e.target.value)} />
        </label>
        <label>
          <span className="label">End date</span>
          <input type="date" value={endDate} onChange={(e: any) => setEndDate(e.target.value)} />
        </label>
        <label>
          <span className="label">Sort</span>
          <select value={sort} onChange={onSortChange} aria-label="Sort">
            <option value="endTimeAsc">End time ↑</option>
            <option value="endTimeDesc">End time ↓</option>
            <option value="startTimeAsc">Start time ↑</option>
            <option value="priceAsc">Price ↑</option>
            <option value="priceDesc">Price ↓</option>
          </select>
        </label>
        <button type="submit" className="apply">Apply</button>
      </div>

      <style jsx>{`
        .filters { display: grid; gap: 12px; border: 1px solid #e5e7eb; border-radius: 8px; padding: 12px; }
        .row { display: flex; flex-wrap: wrap; gap: 12px; align-items: end; }
        label { display: grid; gap: 6px; font-size: 14px; }
        .label { font-weight: 600; }
        input[type="search"], input[type="date"], select { padding: 8px; border: 1px solid #d1d5db; border-radius: 6px; min-width: 220px; }
        fieldset { display: flex; gap: 8px; border: 0; margin: 0; padding: 0; }
        legend { font-weight: 600; margin-right: 4px; }
        .chip { display: inline-flex; gap: 6px; align-items: center; padding: 6px 8px; border: 1px solid #d1d5db; border-radius: 999px; }
        .apply { background: #111827; color: white; border: 0; padding: 8px 12px; border-radius: 6px; cursor: pointer; }
      `}</style>
    </form>
  );
}

function Pagination(props: { page: number; totalPages: number; onChange: (n: number) => void }) {
  const { page, totalPages, onChange } = props;
  return (
    <nav className="pagination" aria-label="Pagination">
      <button
        type="button"
        onClick={() => onChange(Math.max(1, page - 1))}
        disabled={page <= 1}
        aria-label="Previous page"
      >
        Prev
      </button>
      <span aria-live="polite" aria-atomic="true">Page {page} of {totalPages}</span>
      <button
        type="button"
        onClick={() => onChange(Math.min(totalPages, page + 1))}
        disabled={page >= totalPages}
        aria-label="Next page"
      >
        Next
      </button>
      <style jsx>{`
        .pagination { display: flex; gap: 12px; align-items: center; justify-content: center; padding: 12px; }
        button { background: #e5e7eb; color: #111827; border: 0; padding: 8px 12px; border-radius: 6px; cursor: pointer; }
        button[disabled] { opacity: 0.5; cursor: not-allowed; }
      `}</style>
    </nav>
  );
}

