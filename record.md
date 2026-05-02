ngo API Documentation

## Base URL

```
https://backend-ledger-0ra6.onrender.com
```

---

## 1. Place a Bet

**Endpoint:** `POST /api/wingo/bet`

**Authentication:** Required (Bearer token)

### Request Body

| Field        | Type   | Required | Description                                      |
|--------------|--------|----------|--------------------------------------------------|
| issueNumber  | string | Yes      | The issue/round number (e.g., "20260502302413")  |
| betamount    | number | Yes      | Amount to bet (minimum 1)                        |
| selectType   | string | Yes      | Selection: red, green, violet, big, small, 0-9   |

### Valid selectType Values
- **Colors:** `red`, `green`, `violet`
- **Size:** `big`, `small`
- **Numbers:** `0`, `1`, `2`, `3`, `4`, `5`, `6`, `7`, `8`, `9`

### Request Example
```json
{
  "issueNumber": "20260502302413",
  "betamount": 1.00,
  "selectType": "red"
}
```

### Response Example (201 Created)
```json
{
  "status": "success"
}
```

### Error Responses

**400 - Invalid Input**
```json
{
  "status": "failed",
  "msg": "issueNumber, betamount, and selectType are required"
}
```

**400 - Insufficient Balance**
```json
{
  "status": "failed",
  "msg": "Insufficient balance"
}
```

**401 - Unauthorized**
```json
{
  "msg": "Authentication token is missing",
  "status": "failed"
}
```

---

## 2. Get User Bets

**Endpoint:** `GET /api/wingo/bets`

**Authentication:** Required (Bearer token)

### Query Parameters

| Parameter     | Type   | Required | Description                          |
|---------------|--------|----------|--------------------------------------|
| page          | number | No       | Page number (default: 1)             |
| limit         | number | No       | Items per page (default: 25, max: 100) |
| status        | string | No       | Filter by status: pending, won, lost |
| issueNumber   | string | No       | Filter by specific issue number      |

### Request Example
```
GET /api/wingo/bets?page=1&limit=25&status=pending
```

### Response Example (200 OK)
```json
{
  "status": "success",
  "page": 1,
  "limit": 25,
  "total": 10,
  "items": [
    {
      "issueNumber": "20260502302413",
      "orderNumber": "WG2026050220061393502417",
      "betamount": 1.00,
      "fee": 0.02,
      "selectType": "red",
      "result": {
        "number": "0",
        "selectType": "red",
        "colour": "red,violet",
        "premium": "51250",
        "profitAmount": 1.47,
        "timestamp": "2026-05-02 20:06:13"
      },
      "realAmount": 0.98,
      "status": "won",
      "timestamp": "2026-05-02 20:06:13"
    }
  ]
}
```

---

## 3. Settle Bets (Webhook)

**Endpoint:** `POST /api/wingo/settle`

**Authentication:** Required (x-api-key header)

### Headers

| Header      | Value              | Required | Description           |
|-------------|--------------------|----------|-----------------------|
| x-api-key   | wingo_secret_key   | Yes      | API secret key        |

### Request Body

| Field          | Type   | Required | Description                    |
|----------------|--------|----------|--------------------------------|
| issueNumber    | string | Yes      | The issue/round number         |
| result.number  | number | Yes      | Winning number (0-9)           |

### Request Example
```json
{
  "issueNumber": "202604280045",
  "result": {
    "number": 3
  }
}
```

### Response Example (200 OK)
```json
{
  "status": "success",
  "msg": "Bets settled successfully",
  "settled": 5,
  "totalPayout": 490.00,
  "result": {
    "number": "3",
    "colour": "green",
    "timestamp": "2026-05-02 20:06:13"
  }
}
```

### Error Responses

**401 - Missing API Key**
```json
{
  "status": "failed",
  "msg": "API key is required"
}
```

**403 - Invalid API Key**
```json
{
  "status": "failed",
  "msg": "Invalid API key"
}
```

**400 - Invalid Input**
```json
{
  "status": "failed",
  "msg": "issueNumber and result.number are required"
}
```

---

## Betting Logic & Payout Rules

### 1. Fee Deduction
Every bet incurs a **2% service fee**.

```
realAmount = betAmount - (betAmount * 0.02)
```

**Example:** Bet 100 → realAmount = 98

---

### 2. Winning Multipliers

| Bet Type       | Condition                  | Multiplier | Example (Bet 100) |
|----------------|----------------------------|------------|-------------------|
| Number (0-9)   | Exact match                | 9x         | Win 882           |
| Big            | Result 5, 6, 7, 8, 9       | 2x         | Win 196           |
| Small          | Result 0, 1, 2, 3, 4       | 2x         | Win 196           |
| Violet         | Result 0 or 5              | 4.5x       | Win 441           |

---

### 3. Color Rules (Special Cases)

#### Green
| Result Number | Multiplier | Example (Bet 100) |
|---------------|------------|-------------------|
| 1, 3, 7, 9    | 2x         | Win 196           |
| 5             | 1.5x       | Win 147           |

#### Red
| Result Number | Multiplier | Example (Bet 100) |
|---------------|------------|-------------------|
| 2, 4, 6, 8    | 2x         | Win 196           |
| 0             | 1.5x       | Win 147           |

---

### 4. Number to Colour Mapping

| Number | Colour      |
|--------|-------------|
| 0      | red,violet  |
| 1      | green       |
| 2      | red         |
| 3      | green       |
| 4      | red         |
| 5      | red,violet  |
| 6      | red         |
| 7      | green       |
| 8      | red         |
| 9      | green       |

---

## Environment Variables

Add to `.env`:

```env
WINGO_API_KEY=wingo_secret_key
```

> Change `wingo_secret_key` to a strong secret in production.

---

## Bet Status Flow

```
pending → won (if selection matches result)
pending → lost (if selection doesn't match)
```

- Bets start as `pending`
- Result field is `null` until settlement
- Settlement happens via webhook POST `/api/wingo/settle`
- Winnings are automatically credited to user balance
WINGO_API_KEY=admingm123456