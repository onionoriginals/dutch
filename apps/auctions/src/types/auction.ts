export enum AuctionType {
  English = "ENGLISH",
  Dutch = "DUTCH",
}

export enum AuctionStatus {
  Draft = "DRAFT",
  Scheduled = "SCHEDULED",
  Live = "LIVE",
  Ended = "ENDED",
}

export type Money = {
  amount: number;
  currency: string; // ISO 4217
};

export type Auction = {
  id: string;
  title: string;
  description?: string;
  imageUrl?: string;
  type: AuctionType;
  status: AuctionStatus;
  startTime: string; // ISO string
  endTime: string; // ISO string
  currentPrice?: Money; // For Dutch or live current
  highBid?: Money; // For English
  reservePrice?: Money;
  reserveMet?: boolean;
};

export type AuctionFilter = {
  search?: string;
  types?: AuctionType[];
  statuses?: AuctionStatus[];
  startDate?: string; // ISO date (00:00:00)
  endDate?: string; // ISO date (23:59:59)
  sort?:
    | "endTimeAsc"
    | "endTimeDesc"
    | "startTimeAsc"
    | "priceAsc"
    | "priceDesc";
  page?: number;
  pageSize?: number;
};

export type PagedResult<T> = {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
};

