import { z } from 'zod'

const isoDateString = z.string().refine((v) => !Number.isNaN(Date.parse(v)), {
  message: 'Invalid date'
})

export const EnglishAuctionSchema = z.object({
  title: z.string().min(3, 'Title is too short'),
  description: z.string().max(500).optional().or(z.literal('')),
  startingPrice: z.number({ invalid_type_error: 'Starting price is required' }).nonnegative('Must be >= 0'),
  reservePrice: z.number().nonnegative('Must be >= 0').optional(),
  bidIncrement: z.number({ invalid_type_error: 'Bid increment is required' }).positive('Must be > 0'),
  startTime: isoDateString,
  endTime: isoDateString
}).refine((data) => new Date(data.endTime).getTime() > new Date(data.startTime).getTime(), {
  message: 'End time must be after start time',
  path: ['endTime']
})

export const DutchAuctionSchema = z.object({
  title: z.string().min(3, 'Title is too short'),
  description: z.string().max(500).optional().or(z.literal('')),
  startPrice: z.number({ invalid_type_error: 'Start price is required' }).positive('Must be > 0'),
  endPrice: z.number({ invalid_type_error: 'End price is required' }).nonnegative('Must be >= 0'),
  decrementAmount: z.number({ invalid_type_error: 'Decrement amount is required' }).positive('Must be > 0'),
  decrementIntervalSeconds: z.number({ invalid_type_error: 'Decrement interval is required' }).int().positive('Must be > 0'),
  buyNowPrice: z.number().positive('Must be > 0').optional(),
  startTime: isoDateString,
  endTime: isoDateString
}).refine((data) => data.endPrice < data.startPrice, {
  message: 'End price must be less than start price',
  path: ['endPrice']
}).refine((data) => new Date(data.endTime).getTime() > new Date(data.startTime).getTime(), {
  message: 'End time must be after start time',
  path: ['endTime']
})

export type EnglishAuction = z.infer<typeof EnglishAuctionSchema>
export type DutchAuction = z.infer<typeof DutchAuctionSchema>

export const englishAuctionStepFields: string[][] = [
  ['title', 'description'],
  ['startingPrice', 'reservePrice', 'bidIncrement'],
  ['startTime', 'endTime']
]

export const dutchAuctionStepFields: string[][] = [
  ['title', 'description'],
  ['startPrice', 'endPrice', 'buyNowPrice'],
  ['decrementAmount', 'decrementIntervalSeconds'],
  ['startTime', 'endTime']
]

