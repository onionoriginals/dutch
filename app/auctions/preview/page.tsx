import Link from 'next/link';
import { Card } from '@/components/ui/Card';
import { Sparkline } from '@/components/Sparkline';
import { auctionSchema, parseAuctionFromQuery, computeWarnings, type Auction } from '@/lib/auctionSchema';
import { ShareLink } from './ShareLink';

type SearchParams = { [key: string]: string | string[] | undefined };

function formatCurrency(value: number, currency: string) {
  try {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(value);
  } catch {
    return `${currency} ${value.toFixed(2)}`;
  }
}

function ScheduleSpark({ auction }: { auction: Auction }) {
  const values = auction.schedule?.points.map((p) => p.price) ?? [];
  if (values.length < 2) return <div className="text-sm text-gray-500">No schedule</div>;
  return (
    <div className="flex items-center gap-3">
      <Sparkline values={values} />
      <div className="text-xs text-gray-500">
        {formatCurrency(values[0], auction.currency)} → {formatCurrency(values[values.length - 1], auction.currency)}
      </div>
    </div>
  );
}

export const dynamic = 'force-dynamic';

export default function PreviewPage({ searchParams }: { searchParams: SearchParams }) {
  const auction = parseAuctionFromQuery(searchParams);

  if (!auction) {
    return (
      <main className="mx-auto max-w-6xl p-6">
        <h1 className="text-2xl font-semibold">Auction Preview</h1>
        <p className="mt-2 text-gray-600">Missing or invalid state. Provide a base64url encoded `state` query param.</p>
      </main>
    );
  }

  const warnings = computeWarnings(auction);

  return (
    <main className="mx-auto max-w-6xl p-4 md:p-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 print:hidden">
        <div>
          <h1 className="text-2xl font-semibold">Review auction config</h1>
          <p className="text-gray-600">Confirm details before publishing.</p>
        </div>
        <div className="flex items-center gap-2">
          <Link href={{ pathname: '/auctions/wizard/overview', query: { from: 'preview' } }} className="rounded-md border border-gray-300 px-3 py-2 text-sm hover:bg-gray-50">Edit overview</Link>
          <Link href={{ pathname: '/auctions/wizard/pricing', query: { from: 'preview' } }} className="rounded-md border border-gray-300 px-3 py-2 text-sm hover:bg-gray-50">Edit pricing</Link>
          <Link href={{ pathname: '/auctions/wizard/schedule', query: { from: 'preview' } }} className="rounded-md border border-gray-300 px-3 py-2 text-sm hover:bg-gray-50">Edit schedule</Link>
          <Link href={{ pathname: '/auctions/wizard/timing', query: { from: 'preview' } }} className="rounded-md border border-gray-300 px-3 py-2 text-sm hover:bg-gray-50">Edit timing</Link>
          <Link href={{ pathname: '/auctions/wizard/fees', query: { from: 'preview' } }} className="rounded-md border border-gray-300 px-3 py-2 text-sm hover:bg-gray-50">Edit fees</Link>
        </div>
      </div>

      <div className="mb-4 flex items-center justify-end print:hidden">
        <ShareLink auction={auction} />
      </div>

      {warnings.length > 0 && (
        <div className="mb-4 rounded-md border border-amber-300 bg-amber-50 p-3 text-amber-900 print:hidden">
          <ul className="list-inside list-disc text-sm">
            {warnings.map((w, i) => (
              <li key={i}>{w}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Card title="Overview">
          <dl className="grid grid-cols-2 gap-2 text-sm">
            <div>
              <dt className="text-gray-500">Title</dt>
              <dd className="font-medium">{auction.title}</dd>
            </div>
            <div>
              <dt className="text-gray-500">Lots</dt>
              <dd className="font-medium">{auction.lots}</dd>
            </div>
            <div>
              <dt className="text-gray-500">Currency</dt>
              <dd className="font-medium">{auction.currency}</dd>
            </div>
            <div>
              <dt className="text-gray-500">Type</dt>
              <dd className="font-medium capitalize">{auction.pricing.type}</dd>
            </div>
          </dl>
        </Card>

        <Card title="Pricing rules">
          <dl className="grid grid-cols-2 gap-2 text-sm">
            <div>
              <dt className="text-gray-500">Start price</dt>
              <dd className="font-medium">{formatCurrency(auction.pricing.startPrice, auction.currency)}</dd>
            </div>
            {auction.pricing.floorPrice !== undefined && (
              <div>
                <dt className="text-gray-500">Floor price</dt>
                <dd className="font-medium">{formatCurrency(auction.pricing.floorPrice, auction.currency)}</dd>
              </div>
            )}
            {auction.pricing.bidIncrement !== undefined && (
              <div>
                <dt className="text-gray-500">Bid increment</dt>
                <dd className="font-medium">{formatCurrency(auction.pricing.bidIncrement, auction.currency)}</dd>
              </div>
            )}
          </dl>
        </Card>

        <Card title="Schedule">
          <ScheduleSpark auction={auction} />
        </Card>

        <Card title="Timing">
          <dl className="grid grid-cols-2 gap-2 text-sm">
            <div>
              <dt className="text-gray-500">Starts</dt>
              <dd className="font-medium">{new Date(auction.timing.startAt).toLocaleString()}</dd>
            </div>
            <div>
              <dt className="text-gray-500">Ends</dt>
              <dd className="font-medium">{new Date(auction.timing.endAt).toLocaleString()}</dd>
            </div>
            {auction.timing.extensionWindowSeconds !== undefined && (
              <div>
                <dt className="text-gray-500">Extension window</dt>
                <dd className="font-medium">{auction.timing.extensionWindowSeconds}s</dd>
              </div>
            )}
          </dl>
        </Card>

        <Card title="Fees" className="lg:col-span-2">
          {auction.fees.length === 0 ? (
            <div className="text-sm text-gray-500">No fees</div>
          ) : (
            <ul className="divide-y divide-gray-100 text-sm">
              {auction.fees.map((f, i) => (
                <li key={i} className="flex items-center justify-between py-2">
                  <div className="text-gray-700">{f.name}</div>
                  <div className="font-medium">
                    {f.type === 'percent' ? `${f.amount}%` : formatCurrency(f.amount, auction.currency)}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </main>
  );
}
