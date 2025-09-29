import type { Auction, AuctionFilter, Money, PagedResult } from "../../types/auction";
import { AuctionStatus, AuctionType } from "../../types/auction";

function makeMoney(amount: number, currency: string = "USD"): Money {
  return { amount, currency };
}

function daysFromNow(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString();
}

const MOCK_AUCTIONS: Auction[] = [
  {
    id: "a1",
    title: "Vintage Camera",
    type: AuctionType.English,
    status: AuctionStatus.Live,
    startTime: daysFromNow(-1),
    endTime: daysFromNow(1),
    highBid: makeMoney(150),
    reservePrice: makeMoney(120),
    reserveMet: true,
    imageUrl: "https://picsum.photos/seed/camera/640/480",
  },
  {
    id: "a2",
    title: "Retro Console",
    type: AuctionType.Dutch,
    status: AuctionStatus.Scheduled,
    startTime: daysFromNow(2),
    endTime: daysFromNow(3),
    currentPrice: makeMoney(400),
    reservePrice: makeMoney(350),
    reserveMet: false,
    imageUrl: "https://picsum.photos/seed/console/640/480",
  },
  {
    id: "a3",
    title: "Art Print",
    type: AuctionType.English,
    status: AuctionStatus.Draft,
    startTime: daysFromNow(4),
    endTime: daysFromNow(5),
    highBid: undefined,
    reservePrice: makeMoney(200),
    reserveMet: false,
    imageUrl: "https://picsum.photos/seed/art/640/480",
  },
  {
    id: "a4",
    title: "Designer Chair",
    type: AuctionType.Dutch,
    status: AuctionStatus.Ended,
    startTime: daysFromNow(-5),
    endTime: daysFromNow(-3),
    currentPrice: makeMoney(220),
    reservePrice: makeMoney(200),
    reserveMet: true,
    imageUrl: "https://picsum.photos/seed/chair/640/480",
  },
];

function normalize(text: string): string {
  return text.trim().toLowerCase();
}

function compareMoney(a?: Money, b?: Money): number {
  if (!a && !b) return 0;
  if (!a) return -1;
  if (!b) return 1;
  return a.amount - b.amount;
}

export type MockAdapter = {
  list: (filter: AuctionFilter) => Promise<PagedResult<Auction>>;
};

export function createMockAdapter(): MockAdapter {
  async function list(filter: AuctionFilter): Promise<PagedResult<Auction>> {
    const {
      search,
      types,
      statuses,
      startDate,
      endDate,
      sort = "endTimeAsc",
      page = 1,
      pageSize = 12,
    } = filter;

    let items = [...MOCK_AUCTIONS];

    if (search && search.trim().length > 0) {
      const q = normalize(search);
      items = items.filter((a) => normalize(a.title).includes(q));
    }

    if (types && types.length > 0) {
      const set = new Set(types);
      items = items.filter((a) => set.has(a.type));
    }

    if (statuses && statuses.length > 0) {
      const set = new Set(statuses);
      items = items.filter((a) => set.has(a.status));
    }

    if (startDate) {
      const min = new Date(startDate).getTime();
      items = items.filter((a) => new Date(a.startTime).getTime() >= min);
    }

    if (endDate) {
      const max = new Date(endDate).getTime();
      items = items.filter((a) => new Date(a.endTime).getTime() <= max);
    }

    items.sort((a, b) => {
      switch (sort) {
        case "endTimeAsc":
          return new Date(a.endTime).getTime() - new Date(b.endTime).getTime();
        case "endTimeDesc":
          return new Date(b.endTime).getTime() - new Date(a.endTime).getTime();
        case "startTimeAsc":
          return new Date(a.startTime).getTime() - new Date(b.startTime).getTime();
        case "priceAsc":
          return compareMoney(a.highBid ?? a.currentPrice, b.highBid ?? b.currentPrice);
        case "priceDesc":
          return compareMoney(b.highBid ?? b.currentPrice, a.highBid ?? a.currentPrice);
        default:
          return 0;
      }
    });

    const total = items.length;
    const start = (page - 1) * pageSize;
    const end = start + pageSize;
    const paged = items.slice(start, end);

    // Simulate network latency
    await new Promise((r) => setTimeout(r, 200));

    return { items: paged, total, page, pageSize };
  }

  return { list };
}

