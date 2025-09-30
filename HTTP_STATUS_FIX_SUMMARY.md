# HTTP Status Code Fix Summary

## Issue
The clearing auction endpoints and some other endpoints were returning standardized error responses (`{ ok: false, error, code }`) without setting the appropriate HTTP status codes. This meant all errors were being returned with HTTP 200 status, which breaks proper HTTP semantics and can cause issues for clients that rely on HTTP status codes.

## Root Cause
When we normalized the API responses, we added `set` parameter to set HTTP status codes but forgot to actually call `set.status` before returning errors in several endpoints.

## Fixes Applied

### Clearing Auction Endpoints Fixed

1. **POST `/clearing/create-auction`**
   - Added `set.status = 400` for validation errors
   - Added `set.status = 500` for internal errors

2. **POST `/clearing/place-bid`**
   - Added `set.status = 400` for validation errors
   - Added `set.status = 500` for internal errors

3. **GET `/clearing/status/:auctionId`**
   - Added `set.status = 404` for not found errors

4. **GET `/clearing/bids/:auctionId`**
   - Added `set.status = 404` for not found errors

5. **GET `/clearing/settlement/:auctionId`**
   - Added `set.status = 404` for not found errors

6. **POST `/clearing/mark-settled`**
   - Added `set.status = 400` for validation errors
   - Added `set.status = 500` for internal errors

7. **POST `/clearing/create-bid-payment`**
   - Added `set.status = 400` for validation errors
   - Added `set.status = 500` for internal errors

8. **POST `/clearing/confirm-bid-payment`**
   - Added `set.status = 400` for validation errors
   - Added `set.status = 500` for internal errors

9. **POST `/clearing/process-settlement`**
   - Added `set.status = 400` for validation errors
   - Added `set.status = 500` for internal errors

10. **GET `/clearing/bid-payment-status/:bidId`**
    - Added `set.status = 404` for not found errors

11. **GET `/clearing/auction-payments/:auctionId`**
    - Added `set.status = 404` for not found errors

### Other Endpoints Fixed

12. **POST `/demo/create-clearing-auction`**
    - Added `set.status = 500` for internal errors

13. **GET `/auction/:auctionId`**
    - Added `set.status = 404` for not found errors (clearing auction fallback)

14. **GET `/price/:auctionId`**
    - Added `set.status = 404` for not found errors

15. **GET `/price/:auctionId/stepped`**
    - Added `set.status = 404` for not found errors

16. **POST `/auction/:auctionId/status`**
    - Added `set.status = 400` for invalid status errors
    - Added `set.status = 404` for not found errors

## HTTP Status Codes Used

| Status Code | Meaning | Usage |
|-------------|---------|-------|
| 200 | OK | Successful requests (default, no `set.status` needed) |
| 400 | Bad Request | Validation errors, missing required fields |
| 403 | Forbidden | Authorization/ownership errors |
| 404 | Not Found | Resource not found |
| 500 | Internal Server Error | Server errors, unexpected exceptions |

## Pattern Established

For all error responses, we now follow this pattern:

```typescript
// Validation errors
if (!requiredField) {
  set.status = 400
  return error('Field required', 'VALIDATION_ERROR')
}

// Not found errors
if (!resource) {
  set.status = 404
  return error('Resource not found', 'NOT_FOUND')
}

// Internal errors
try {
  // ... operation
} catch (err: any) {
  set.status = 500
  return error(err?.message || 'internal_error', 'INTERNAL_ERROR')
}
```

## Testing

All affected endpoints should be tested to verify:
1. Success responses return HTTP 200
2. Validation errors return HTTP 400
3. Not found errors return HTTP 404
4. Internal errors return HTTP 500
5. The response body still contains the standardized `{ ok, error, code }` format

## Files Modified

- `/workspace/apps/api/src/index.ts` - All clearing auction endpoints and related endpoints

## Impact

- **Before**: All errors returned HTTP 200, clients couldn't distinguish between success and failure based on status codes
- **After**: Proper HTTP status codes are returned, clients can use standard HTTP error handling

This fix ensures HTTP semantics are respected while maintaining the standardized JSON response format.