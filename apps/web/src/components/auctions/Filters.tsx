import React from 'react'

type FiltersValues = {
  q?: string
  type?: 'all' | 'english' | 'dutch'
  status?: 'all' | 'draft' | 'scheduled' | 'live' | 'ended'
  startDate?: string
  endDate?: string
  sort?: 'endingSoon' | 'newest' | 'priceHigh' | 'priceLow'
}

function readFromURL(): FiltersValues {
  const sp = new URLSearchParams(window.location.search)
  return {
    q: sp.get('q') ?? '',
    type: (sp.get('type') as FiltersValues['type']) ?? 'all',
    status: (sp.get('status') as FiltersValues['status']) ?? 'all',
    startDate: sp.get('startDate') ?? '',
    endDate: sp.get('endDate') ?? '',
    sort: (sp.get('sort') as FiltersValues['sort']) ?? 'endingSoon'
  }
}

function writeToURL(values: FiltersValues) {
  const sp = new URLSearchParams(window.location.search)
  const set = (k: string, v?: string) => {
    if (v && v.length) sp.set(k, v)
    else sp.delete(k)
  }
  set('q', values.q)
  set('type', values.type)
  set('status', values.status)
  set('startDate', values.startDate)
  set('endDate', values.endDate)
  set('sort', values.sort)
  const url = `${window.location.pathname}?${sp.toString()}`
  window.history.replaceState({}, '', url)
}

export default function Filters({ initial }: { initial?: Partial<FiltersValues> }) {
  const [values, setValues] = React.useState<FiltersValues>(() => ({
    q: initial?.q ?? '',
    type: initial?.type ?? 'all',
    status: initial?.status ?? 'all',
    startDate: initial?.startDate ?? '',
    endDate: initial?.endDate ?? '',
    sort: initial?.sort ?? 'endingSoon'
  }))

  React.useEffect(() => {
    // Keep in sync with back/forward
    const onPop = () => setValues(readFromURL())
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])

  React.useEffect(() => {
    writeToURL(values)
    const detail = {
      // map search text from `q` to `search` for the data adapter
      search: values.q || '',
      type: values.type,
      status: values.status,
      startDate: values.startDate,
      endDate: values.endDate,
      sort: values.sort
    }
    window.dispatchEvent(new CustomEvent('auctions:query', { detail }))
  }, [values])

  return (
    <form className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-6" onSubmit={(e: React.FormEvent<HTMLFormElement>) => e.preventDefault()} noValidate>
      <label className="flex flex-col gap-1">
        <span className="text-sm text-muted-foreground">Search</span>
        <input className="input" value={values.q || ''} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setValues((v: FiltersValues) => ({ ...v, q: e.target.value }))} placeholder="Search auctions" aria-label="Search auctions" />
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-sm text-muted-foreground">Type</span>
        <select className="input" value={values.type} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setValues((v: FiltersValues) => ({ ...v, type: e.target.value as FiltersValues['type'] }))} aria-label="Auction type">
          <option value="all">All</option>
          <option value="english">English</option>
          <option value="dutch">Dutch</option>
        </select>
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-sm text-muted-foreground">Status</span>
        <select className="input" value={values.status} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setValues((v: FiltersValues) => ({ ...v, status: e.target.value as FiltersValues['status'] }))} aria-label="Auction status">
          <option value="all">All</option>
          <option value="draft">Draft</option>
          <option value="scheduled">Scheduled</option>
          <option value="live">Live</option>
          <option value="ended">Ended</option>
        </select>
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-sm text-muted-foreground">Start after</span>
        <input className="input" type="datetime-local" value={values.startDate || ''} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setValues((v: FiltersValues) => ({ ...v, startDate: e.target.value ? new Date(e.target.value).toISOString() : '' }))} aria-label="Start date" />
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-sm text-muted-foreground">End before</span>
        <input className="input" type="datetime-local" value={values.endDate || ''} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setValues((v: FiltersValues) => ({ ...v, endDate: e.target.value ? new Date(e.target.value).toISOString() : '' }))} aria-label="End date" />
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-sm text-muted-foreground">Sort</span>
        <select className="input" value={values.sort} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setValues((v: FiltersValues) => ({ ...v, sort: e.target.value as FiltersValues['sort'] }))} aria-label="Sort order">
          <option value="endingSoon">Ending soon</option>
          <option value="newest">Newest</option>
          <option value="priceHigh">Price: High to Low</option>
          <option value="priceLow">Price: Low to High</option>
        </select>
      </label>
    </form>
  )
}

