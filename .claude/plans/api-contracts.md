# API Contracts — Naeman Barber

> All data traced directly from Prisma selects and service return values.
> Generated: 2026-04-23

---

## Global Response Envelope

Every response is wrapped by `TransformResponseInterceptor`.
Services that already return an object with a `message` key pass through unchanged (auth, AppSuccess).
Services that return raw data get wrapped:

```ts
{
  data: T
  message: string   // from @ResponseMessage() decorator or "Success"
  statusCode: number // always 200 unless service sets otherwise
}
```

**Auth responses** bypass the wrapper and include a `token` field:
```ts
{
  data: UserWithoutPassword
  token?: string    // only on signup(USER) and login
  message: string
  statusCode: 201
}
```

**Common error shapes** (HTTP status matches the code):
```ts
{ statusCode: 400, message: string, error: "Bad Request" }
{ statusCode: 401, message: string, error: "Unauthorized" }
{ statusCode: 403, message: string, error: "Forbidden" }
{ statusCode: 404, message: string, error: "Not Found" }
{ statusCode: 409, message: string, error: "Conflict" }
{ statusCode: 503, message: string, error: "Service Unavailable" }
```

---

## Auth — `/auth`

---

### POST /auth/signup

**Guard:** Public  
**Consumes:** `multipart/form-data`

**Request body:**
```ts
{
  firstName: string
  lastName: string
  phone: string          // 10–16 chars
  password: string
  avatar?: string        // usually sent as file, not field
  referralCode?: string
  role?: "USER" | "BARBER" | "CASHIER" | "ADMIN"  // default: USER
  // required when role is BARBER or CASHIER:
  branchId?: string      // UUID
  start?: number         // 0–23, working hours start
  end?: number           // 0–23, working hours end
  vacations?: Array<{ id?: string, dates: string[], month: string }>
  // required when role is BARBER:
  type?: "GENERAL" | "MASSAGE"
}
file: image/jpeg | image/png | image/jpg  // max 5 MB, optional
```

**Response (bypasses envelope):**
```ts
{
  data: {
    id: string
    firstName: string
    lastName: string
    avatar: string | null
    phone: string
    role: "USER" | "BARBER" | "CASHIER" | "ADMIN"
    fcmToken: string | null
    createdAt: string   // ISO datetime
    updatedAt: string
    deleted: boolean
    // all other User fields except password
  }
  token?: string        // only present when role === "USER"
  message: "User registered successfully"
  statusCode: 201
}
```

**Status codes:** 200 | 400 | 409 | 500

---

### POST /auth/login

**Guard:** Public

**Request body:**
```ts
{
  phone: string
  password: string
}
```

**Response (bypasses envelope):**
```ts
{
  data: {
    id: string
    firstName: string
    lastName: string
    avatar: string | null
    phone: string
    role: "USER" | "BARBER" | "CASHIER" | "ADMIN"
    fcmToken: string | null
    createdAt: string
    updatedAt: string
    // all User fields except password (via omit: { password: true })
  }
  token: string         // JWT, always present on login
  message: "login successfully"
  statusCode: 201
}
```

**Status codes:** 200 | 404 (wrong phone/password)

---

### POST /auth/logout

**Guard:** `AuthGuard()` (JWT required)

**Request:** None (token read from `Authorization: Bearer <token>` header)

**Response:**
```ts
{
  data: null
  message: "logout successfully"
  statusCode: 200
}
```

**Status codes:** 200 | 401 | 409 (already logged out)

---

### POST /auth/referral-code

**Guard:** Public

**Request body:**
```ts
{
  referralCode: string
}
```

**Response:**
```ts
{
  data: {
    status: true
    user: {
      referralCode: string
      ban: boolean
      id: string
    }
  }
  message: "Referral Code is Applying"
  statusCode: 200
}
```

**Status codes:** 200 | 400 (invalid/empty code)

---

### PATCH /auth/change-password/:id

**Guard:** `AuthGuard()`  
**Param:** `id` — UUID

**Request body:**
```ts
{
  password: string   // min 6 chars
}
```

**Response:**
```ts
{
  data: null
  message: "Password changed successfully"
  statusCode: 200
}
```

**Notes:** Invalidates ALL tokens for the user after change.

**Status codes:** 200 | 400 | 401 | 404

---

### PATCH /auth/reset-password

**Guard:** `AuthGuard() + RolesGuard`  
**Roles:** ADMIN, CASHIER

**Request body:**
```ts
{
  phone: string
}
```

**Response:**
```ts
{
  data: null
  message: "Password reset successfully"
  statusCode: 200
}
```

**Notes:** Resets to `DEFAULT_PASSWORD = "123456"`. Cannot reset ADMIN accounts.

**Status codes:** 200 | 400 | 401 | 403 | 404

---

## User — `/user`

All user endpoints require `AuthGuard()`.

---

### PUT /user/unban

**Guard:** `AuthGuard()`

**Request body:**
```ts
{
  number: string    // phone number of user to unban
}
```

**Response:**
```ts
{
  data: User        // full Prisma User object (with password hash — note: not filtered)
  message: "User unbanned successfully"
  statusCode: 200
}
```

**Status codes:** 200 | 401 | 404

---

### GET /user

**Guard:** `AuthGuard()`

**Query params:**
```ts
{
  role?: "USER" | "BARBER" | "CASHIER" | "ADMIN"
  page?: number     // default 1
  pageSize?: number // default 10
}
```

**Response:**
```ts
{
  data: {
    users: Array<{
      id: string
      firstName: string
      lastName: string
      avatar: string | null
      phone: string
      role: "USER" | "BARBER" | "CASHIER" | "ADMIN"
      fcmToken: string | null
      createdAt: string
      updatedAt: string
      // role-specific nested object (key varies by role):
      barber?: {
        branch: Branch
        rate: number
        type: "GENERAL" | "MASSAGE"
        vacations: Vacation[]
        schedule: {
          workingHours: { start: number, end: number }
          currentSlots: string[]
          newSlots?: string[]
          effectiveDate?: string       // "YYYY-MM-DD"
          isNewSlotActive?: boolean
        }
      }
      cashier?: {
        branch: Branch
        vacations: Vacation[]
        schedule: {
          workingHours: { start: number, end: number }
          currentSlots: string[]
          newSlots?: string[]
          effectiveDate?: string
          isNewSlotActive?: boolean
        }
      }
      // no client data returned in findAllUser
    }>
  }
  message: "Users fetched successfully"
  statusCode: 200
}
```

**Notes:** When `role` is not provided, filters to non-USER roles (BARBER, CASHIER, ADMIN). No `total` or pagination metadata returned.

**Status codes:** 200 | 401 | 404 (invalid role enum)

---

### GET /user/clients

**Guard:** `AuthGuard()`

**Query params:**
```ts
{
  page?: number     // default 1
  pageSize?: number // default 10
  phone?: string    // exact match filter
}
```

**Response:**
```ts
{
  data: {
    users: Array<{
      id: string
      firstName: string
      lastName: string
      avatar: string | null
      phone: string
      role: "USER"
      fcmToken: string | null
      createdAt: string
      updatedAt: string
      client: {
        referralCode: string
        points: number
        ban: boolean
        canceledOrders: number
      }
    }>
  }
  message: "Clients fetched successfully"
  statusCode: 200
}
```

**Status codes:** 200 | 401

---

### GET /user/current/profile

**Guard:** `AuthGuard()`

**Request:** None (user from JWT)

**Response:**
```ts
{
  data: {
    id: string
    firstName: string
    lastName: string
    avatar: string | null
    phone: string
    role: "USER" | "BARBER" | "CASHIER" | "ADMIN"
    fcmToken: string | null
    createdAt: string
    updatedAt: string
    // role-specific key:
    client?: {
      referralCode: string
      points: number
      ban: boolean
      canceledOrders: number
      BanMessage?: string    // only present when ban === true
    }
    barber?: {
      branch: Branch
      rate: number
      type: "GENERAL" | "MASSAGE"
      vacations: Vacation[]
      schedule: {
        workingHours: { start: number, end: number }
        currentSlots: string[]
        newSlots?: string[]
        effectiveDate?: string
        isNewSlotActive?: boolean
      }
    }
    cashier?: {
      branch: Branch
      vacations: Vacation[]
      schedule: { workingHours, currentSlots, newSlots?, effectiveDate?, isNewSlotActive? }
    }
    // admin role: no nested object returned (excluded)
  }
  message: "User fetched successfully"
  statusCode: 200
}
```

**Status codes:** 200 | 401 | 404

---

### GET /user/:id

**Guard:** `AuthGuard()`  
**Param:** `id` — UUID

**Response:**
```ts
{
  data: {
    id: string
    firstName: string
    lastName: string
    avatar: string | null
    phone: string
    role: string
    fcmToken: string | null
    createdAt: string
    updatedAt: string
    // dynamic key = role name ("client" | "barber" | "cashier" | "admin"):
    [roleName]: {
      // for client: { referralCode, points, ban, canceledOrders }
      // for barber: { branch, rate, type, vacations, schedule: { workingHours, currentSlots, ...} }
      // for cashier: { branch, vacations, schedule: { workingHours, currentSlots, ... } }
      // for admin: { id: true } — only id
    }
  }
  message: "User fetched successfully"
  statusCode: 200
}
```

**Status codes:** 200 | 401 | 404

---

### PUT /user/:id

**Guard:** `AuthGuard()`  
**Param:** `id` — UUID  
**Consumes:** `multipart/form-data`

**Request body:** `UserUpdateDto` (all fields optional, extends `RegisterDto`):
```ts
{
  firstName?: string
  lastName?: string
  phone?: string
  password?: string
  avatar?: string
  referralCode?: string
  role?: string
  branchId?: string
  start?: number
  end?: number
  type?: "GENERAL" | "MASSAGE"
  vacations?: Array<{ id?: string, dates: string[], month: string }>
  vacationsToDelete?: string[]   // IDs of vacations to remove
}
file?: image   // optional avatar upload
```

**Response:**
```ts
{
  data: {
    id: string
    firstName: string
    lastName: string
    avatar: string | null
    phone: string
    // role-specific include:
    barber?: { vacations: Vacation[], Slot: Slot }
    cashier?: { vacations: Vacation[], Slot: Slot }
    client?: { referralCode, points, ban, canceledOrders }
    admin?: AdminRecord
  }
  message: "User updated successfully"
  statusCode: 200
}
```

**Notes:** For BARBERs with existing orders, slot changes are deferred to `effectiveSlotDate` (day after last upcoming order).

**Status codes:** 200 | 401 | 404

---

### PATCH /user/barber-availability/:id

**Guard:** `AuthGuard()`  
**Param:** `id` — Barber UUID (not User UUID)

**Response:**
```ts
{
  data: {
    id: string
    isAvailable: boolean   // toggled value
    // full Barber Prisma record
  }
  message: "Success"
  statusCode: 200
}
```

**Status codes:** 200 | 401 | 404

---

### DELETE /user/deleteAccount

**Guard:** `AuthGuard()`

**Request:** None (user from JWT)

**Response:**
```ts
{
  data: User   // soft-deleted user (deleted: true, all upcoming orders cancelled)
  message: "User deleted successfully"
  statusCode: 200
}
```

**Notes:** Soft delete only (`deleted: true`). Cancels all UPCOMING/IN_PROGRESS/PENDING orders.

**Status codes:** 200 | 401 | 404

---

### DELETE /user/deleteEmployeeAccount/:id

**Guard:** `AuthGuard()`  
**Param:** `id` — UUID

**Response:**
```ts
{
  data: null
  message: "Employee deleted successfully"
  statusCode: 200
}
```

**Notes:** Hard delete. Nullifies `barberId`/`cashierId` on existing orders. Deletes Barber/Cashier records before User.

**Status codes:** 200 | 401 | 404

---

### POST /user/rate-barber

**Guard:** `AuthGuard()`

**Request body:**
```ts
{
  barberId: string   // UUID
  orderId: string    // UUID
  rating: number     // 1–5 integer
}
```

**Response:**
```ts
{
  data: {
    barber: {
      id: string
      name: string       // "firstName lastName"
      avatar: string | null
      rate: number       // new average, rounded to 1 decimal
    }
    yourRate: number     // the rating you just submitted
  }
  message: "Barber rated successfully"
  statusCode: 200
}
```

**Notes:** One rating per (barber, client, order) triple. Order must be COMPLETED or PAID.

**Status codes:** 200 | 401 | 404 | 409 (already rated)

---

## Order — `/order`

---

### GET /order

**Guard:** `AuthGuard() + RolesGuard` (any role)  
**Header:** `accept-language: EN | AR`

**Response:**
```ts
{
  data: {
    upcoming: Array<OrderListItem>
    completed: Array<OrderListItem>
    cancelled: Array<OrderListItem>
  }
  message: "Orders fetched successfully"
  statusCode: 200
}

// OrderListItem shape:
{
  id: string
  slot: string           // "HH:MM AM/PM"
  date: string           // "YYYY-MM-DD"
  status: OrderStatus
  booking: BookingStatus
  promoCode: string | null
  barberId: string | null
  barberName: string | null
  branchId: string
  userId: string
  total: string          // Decimal as string
  subTotal: string       // Decimal as string
  discount: string       // Decimal as string (= total - subTotal)
  points: string         // Decimal as string
  note: string | null
  duration: string       // e.g. "45 Minutes" | "٤٥ دقيقة"
  usedPackage: PackageRecord[]  // full package objects
  barber: BarberRecord | null   // barber relation
  service: Array<{
    id: string
    price: number
    duration: number
    serviceImg: string | null
    categoryId: string
    available: boolean
    nameEN: string | null
    nameAR: string | null
    name: string | null    // resolved for requested lang
  }>
  branch: {
    id: string
    location: string
    latitude: string
    longitude: string
    branchImg: string | null
    phone: string
    // ...other Branch fields
    name: string           // resolved for requested lang
  }
}
```

**Status codes:** 200 | 401

---

### GET /order/getAllOrders

**Guard:** `AuthGuard() + RolesGuard`  
**Roles:** ADMIN, CASHIER  
**Header:** `accept-language: EN | AR`

**Query params:**
```ts
{
  fromDate?: string   // defaults to 1 month ago
  toDate?: string     // defaults to today
}
```

**Response:**
```ts
{
  data: Array<{
    id: string
    nameEN: string | undefined
    nameAR: string | undefined
    name: string | undefined       // branch name for requested lang
    orderCount: number
    orders: Array<{
      id: string
      date: string                 // "YYYY-MM-DD"
      barberId?: string
      barberName?: string          // "firstName lastName"
      clientId?: string
      clientName?: string          // "firstName lastName"
      promoCode: string | null
      subTotal: Decimal
      discount: Decimal
      discountType: "AMOUNT" | "PERCENTAGE"
      total: Decimal
      slot: string
      booking: BookingStatus
      status: OrderStatus
    }>
  }>
  message: "Orders fetched successfully"
  statusCode: 200
}
```

**Notes:** CASHIER sees only their branch. ADMIN sees all branches.

**Status codes:** 200 | 401 | 403

---

### GET /order/barber-orders

**Guard:** `AuthGuard() + RolesGuard`  
**Roles:** BARBER  
**Header:** `accept-language: EN | AR`

**Query params:**
```ts
{
  fromDate?: string   // defaults to today
  toDate?: string     // defaults to today
}
```

**Response:**
```ts
{
  data: {
    orders: Array<{
      id: string
      slot: string
      date: string              // "YYYY-MM-DD"
      status: OrderStatus
      booking: BookingStatus
      promoCode: string | null
      barberId: string | null
      barberName: string | null
      branchId: string
      userId: string
      total: string
      subTotal: string
      discount: string
      points: string
      duration: string          // "45 Minutes" | "٤٥ دقيقة"
      usedPackage: PackageRecord[]
      barber: BarberRecord | null
      services: Array<{         // note: "services" not "service"
        id: string
        price: number
        duration: number
        serviceImg: string | null
        nameEN: string | undefined
        nameAR: string | undefined
        name: string | undefined
      }>
      branch: {
        id: string
        nameEN: string | undefined
        nameAR: string | undefined
        name: string | undefined
        // other branch fields
      }
      userName: string          // "firstNamelastName" (no space — bug)
      userPhone: string | null
    }>
  }
  message: "Orders fetched successfully"
  statusCode: 200
}
```

**Status codes:** 200 | 401 | 403

---

### GET /order/categories/:id

**Guard:** `AuthGuard() + RolesGuard` (any role)  
**Param:** `id` — Order UUID  
**Header:** `accept-language: EN | AR`

**Response:**
```ts
{
  data: {
    category: Array<{
      id: string
      available: boolean
      type: "GENERAL" | "MASSAGE"
      nameEN: string | undefined
      nameAR: string | undefined
      name: string | undefined
      services: Array<{
        id: string
        price: number
        duration: number
        serviceImg: string | null
        available: boolean
        categoryId: string
        nameEN: string | undefined
        nameAR: string | undefined
        name: string | undefined
      }>
    }>
  }
  message: "Services found successfully"
  statusCode: 200
}
```

**Notes:** Returns only services NOT already in the order.

**Status codes:** 200 | 401 | 409 (order not found)

---

### GET /order/cashier

**Guard:** `AuthGuard() + RolesGuard`  
**Roles:** CASHIER  
**Header:** `accept-language: EN | AR`

**Query params:**
```ts
{
  fromDate?: string   // defaults to today
  toDate?: string     // defaults to today
}
```

**Response:**
```ts
{
  data: {
    orders: Array<{
      id: string
      promoCode: string | null
      slot: string
      date: string              // "YYYY-MM-DD"
      status: OrderStatus
      clientPoints: number
      branchId: string
      duration: string          // "45 Minutes" | "٤٥ دقيقة"
      barberUserName: string    // "firstName lastName" or barberName fallback
      barberAvatar: string | null
      userName: string          // "firstNamelastName" (no space — bug)
      userPhone: string | null
      total: string
      subTotal: string
      discount: string          // = (total - subTotal).toString()
      points: string
      usedPackage: PackageRecord[]
      service: Array<{
        id: string
        price: number
        duration: number
        serviceImg: string | null
        nameEN: string | null
        nameAR: string | null
        name: string | null
      }>
      limit: number             // pointLimit from settings
    }>
    TotalSales: Decimal | 0     // sum of PAID orders in range
  }
  message: "Orders fetched successfully"
  statusCode: 200
}
```

**Status codes:** 200 | 401 | 403 | 404 (cashier not found | settings not found)

---

### GET /order/paid-orders

**Guard:** `AuthGuard() + RolesGuard`  
**Roles:** ADMIN, CASHIER

**Query params:**
```ts
{
  date?: string   // defaults to today
}
```

**Response:**
```ts
{
  data: {
    orders: Array<{
      id: string
      points: number
      barberName: string        // "firstName lastName" or stored barberName
      cashierName: string       // "firstName lastName" or "N/A"
      clientName: string        // "firstName lastName"
      day: string               // e.g. "Monday"
      time: string              // slot string "HH:MM AM/PM"
      total: string             // Decimal as string
      subTotal: string
      discount: string          // e.g. "10 EGP" or "10%"
      branch: string            // branch name (EN)
      service: Array<{
        name: string            // EN name
        price: string           // "0" if freeService, else Decimal as string
      }>
    }>
  }
  message: "Orders fetched successfully"
  statusCode: 200
}
```

**Status codes:** 200 | 401 | 403

---

### PUT /order/delete-order-services/:id

**Guard:** `AuthGuard() + RolesGuard`  
**Roles:** ADMIN  
**Param:** `id` — Order UUID

**Request body:**
```ts
{
  password: string    // admin password (bcrypt-compared to settings.password)
}
```

**Response:**
```ts
{
  data: Order         // updated Prisma Order record (services disconnected, prices recalculated)
  message: "Order services deleted successfully"
  statusCode: 200
}
```

**Notes:** Deletes services in `servicesToDelete` list. Recalculates `subTotal` and `total`. If all services deleted, cancels the order instead.

**Status codes:** 200 | 400 (wrong password | no services to delete) | 401 | 403

---

### PUT /order/cancel-deleted-services/:id

**Guard:** `AuthGuard() + RolesGuard`  
**Roles:** ADMIN  
**Param:** `id` — Order UUID

**Request body:**
```ts
{
  password: string
}
```

**Response:**
```ts
{
  data: null
  message: "Deleted services cancelled successfully"
  statusCode: 200
}
```

**Notes:** Clears `servicesToDelete` and `shouldBeReviewedByAdmin` flags.

**Status codes:** 200 | 400 | 401 | 403 | 500

---

### PUT /order/update-order-services/:id

**Guard:** `AuthGuard() + RolesGuard`  
**Roles:** ADMIN, CASHIER  
**Param:** `id` — Order UUID

**Request body:**
```ts
{
  serviceToDelete: string[]   // service UUIDs to flag for deletion
}
```

**Response:**
```ts
{
  data: {
    id: string
    // full order with service array and client info:
    service: Service[]
    clientName: string
    clientPhone: string
    // ...rest of order fields
  }
  message: "Order services updated successfully"
  statusCode: 200
}
```

**Notes:** Only flags `servicesToDelete` and `shouldBeReviewedByAdmin = true`. Does NOT delete yet. Admin must call `PUT /order/delete-order-services/:id` to confirm.

**Status codes:** 200 | 401 | 403 | 409

---

### GET /order/evaluate-order/:id

**Guard:** `AuthGuard() + RolesGuard`  
**Roles:** ADMIN, CASHIER  
**Param:** `id` — Order UUID

**Query params:**
```ts
{
  discount?: number   // percentage 0–100
  points?: number     // client points to apply (min: pointLimit setting)
}
```

**Response:**
```ts
{
  data: {
    subTotal: Decimal           // original subtotal
    pointsDiscount: number      // EGP discount from points (floor(points/1000) * 50)
    discountAmount: number      // EGP discount from percentage
    total: number               // max(subTotal - pointsDiscount - discountAmount, 0)
  }
  message: "Order evaluated successfully"
  statusCode: 200
}
```

**Notes:** Dry-run only, does not modify the order.

**Status codes:** 200 | 400 | 401 | 403 | 409 (paid or cancelled)

---

### PUT /order/paid-order/:id

**Guard:** `AuthGuard() + RolesGuard`  
**Roles:** ADMIN, CASHIER  
**Param:** `id` — Order UUID

**Request body:**
```ts
{
  discount?: number   // percentage 0–100; creates a temp promo code
  points?: number     // client points to deduct (min: pointLimit setting)
}
```

**Response:**
```ts
{
  data: Order & {
    service: Service[]
    barber: { firstName: string, lastName: string } | null
    branch: Branch
  }
  message: "Order marked as paid"
  statusCode: 200
}
```

**Notes:** Sets status to PAID, booking to PAST. Deducts points from client. If CASHIER, assigns `cashierId`.

**Status codes:** 200 | 400 | 401 | 403 | 404 | 409 (already paid/cancelled)

---

### PUT /order/cancel-order/:id

**Guard:** `AuthGuard() + RolesGuard` (any role)  
**Param:** `id` — Order UUID

**Response:**
```ts
{
  data: Order & {
    service: Array<Service & { PackagesServices: { id: string }[] }>
  }
  message: "Order cancelled successfully"
  statusCode: 200
}
```

**Notes:** Sets status by role: ADMIN→ADMIN_CANCELLED, USER→CLIENT_CANCELLED, BARBER→BARBER_CANCELLED, CASHIER→CASHIER_CANCELLED. Restores package services. Increments client `canceledOrders`; bans if threshold reached. Refunds deducted points.

**Status codes:** 200 | 401 | 409 (already started/completed/paid)

---

### PUT /order/start-order/:id

**Guard:** `AuthGuard() + RolesGuard`  
**Roles:** ADMIN, BARBER  
**Param:** `id` — Order UUID

**Response:**
```ts
{
  data: Order   // status: IN_PROGRESS, booking: UPCOMING
  message: "Order started successfully"
  statusCode: 200
}
```

**Status codes:** 200 | 401 | 403 | 409

---

### PUT /order/complete-order/:id

**Guard:** `AuthGuard() + RolesGuard`  
**Roles:** ADMIN, BARBER  
**Param:** `id` — Order UUID

**Response:**
```ts
{
  data: Order & {
    service: Array<Service & { PackagesServices: { id: string }[] }>
    client: { fcmToken: string }
    barber: { id: string, avatar: string, firstName: string, lastName: string }
  }   // status: COMPLETED, booking: PAST
  message: "Order completed successfully"
  statusCode: 200
}
```

**Notes:** Sends FCM push notification to client. Deletes exhausted package services.

**Status codes:** 200 | 401 | 403 | 409

---

### POST /order/OrderDetails

**Guard:** `AuthGuard(false)` (optional auth)  
**Header:** `accept-language: EN | AR`

**Request body:** Same as `CreateOrderDto`:
```ts
{
  date: string          // "YYYY-MM-DD"
  slot: string          // "HH:MM AM/PM"
  service: string[]     // service UUIDs
  packages?: string[]
  barberId?: string
  branchId?: string
  promoCode?: string
  points?: number
  usedPackage?: string[]
  phone?: string        // book on behalf of another user (by phone)
  userId?: string
  note?: string
}
```

**Response:**
```ts
{
  data: {
    date: string           // "YYYY-MM-DD"
    slot: string
    barberId?: string
    branchId: string
    canUsePoints: boolean
    points: string | undefined
    clientName: string     // "firstName lastName"
    clientPhone: string | null
    createdAt: string      // current timestamp
    updatedAt: null
    phone?: string
    duration: string       // "45 Minutes" | "٤٥ دقيقة"
    promoCode: string | null
    subTotal: string
    discount: string       // e.g. "10%" | "50EGP" | "10% + 50EGP" | "0"
    pointsDiscount: string
    total: string
    limit: string          // pointLimit from settings
  }
  message: "Order details fetched successfully"
  statusCode: 200
}
```

**Notes:** Dry-run preview. Does NOT create an order. Validates slot availability, promo code, points.

**Status codes:** 200 | 400 | 401 | 404 | 409 (slot taken) | 503 (slot unavailable)

---

### GET /order/slots

**Guard:** `AuthGuard(false)` (optional auth)

**Query params:**
```ts
{
  date: string            // "YYYY-MM-DD"
  barberId?: string       // UUID; required for non-empty result
  totalDuration?: number  // minutes; filters slots with enough consecutive availability
}
```

**Response:**
```ts
{
  data: {
    slots: string[]   // available time slots, e.g. ["09:00 AM", "09:30 AM", ...]
  }
  message: "Slots fetched successfully"
  statusCode: 200
}
```

**Notes:** Returns `{ slots: [] }` if no barberId, barber is on vacation, or no slots available. Filters past slots when date is today (Egypt timezone).

**Status codes:** 200 | 409 (no slots in DB)

---

### PUT /order/:id

**Guard:** `AuthGuard() + RolesGuard`  
**Roles:** ADMIN, CASHIER, BARBER  
**Param:** `id` — Order UUID

**Request body:** `UpdateOrderDto` (extends `CreateOrderDto`, all optional):
```ts
{
  // From CreateOrderDto (all optional):
  date?: string
  slot?: string
  barberId?: string
  note?: string
  status?: OrderStatus
  booking?: BookingStatus
  // Added:
  add?: string[]          // service UUIDs to add
  remove?: string[]       // service UUIDs to remove
  addPackage?: string[]   // client-package IDs to add
  removePackage?: string[] // client-package IDs to remove
}
```

**Response:**
```ts
{
  data: Order & {
    service: Service[]
  }
  message: "Order updated successfully"
  statusCode: 200
}
```

**Notes:** Recalculates `subTotal` and `total`. If changing `barberId`, validates slot availability for new barber. Package usage is restored/deducted accordingly.

**Status codes:** 200 | 400 | 401 | 403 | 409

---

### GET /order/:id

**Guard:** `AuthGuard() + RolesGuard` (any role)  
**Param:** `id` — Order UUID

**Response:**
```ts
{
  data: {
    id: string
    slot: string
    date: Date            // NOTE: raw Date object, NOT formatted string
    status: OrderStatus
    booking: BookingStatus
    barberId: string | null
    branchId: string
    userId: string
    promoCode: string | null
    total: Decimal
    subTotal: Decimal
    discount: Decimal
    type: "AMOUNT" | "PERCENTAGE"
    points: Decimal
    note: string | null
    freeService: string[]
    servicesToDelete: string[]
    shouldBeReviewedByAdmin: boolean
    usedPackage: string[]
    deleted: boolean
    barberName: string | null
    createdAt: Date
    updatedAt: Date
    service: Service[]
    barber: User & { barber: Barber } | null
    clientName: string    // "firstName lastName"
    clientPhone: string
  }
  message: "Order fetched successfully"
  statusCode: 200
}
```

**Status codes:** 200 | 401 | 409 (not found)

---

### POST /order

**Guard:** `AuthGuard() + RolesGuard` (any role)  
**Header:** `accept-language: EN | AR`

**Request body:** `CreateOrderDto` (same as OrderDetails body)

**Response:**
```ts
{
  data: {
    date: string           // "YYYY-MM-DD"
    slot: string
    barberId?: string
    branchId: string
    barberName: string | null
    points: string
    createdAt: string      // ISO datetime
    updatedAt: null
    duration: string       // "45 minutes" | "٤٥ دقيقة"   (note: lowercase "minutes" on create vs "Minutes" on preview)
    promoCode: string | null
    subTotal: string
    discount: string       // same display format as OrderDetails
    total: string
  }
  message: "Order created successfully"
  statusCode: 200
}
```

**Notes:** Creates the order and persists all side effects (package deductions, points deduction, barber slot blocked).

**Status codes:** 200 | 400 | 401 | 403 (banned user) | 404 | 409 | 503

---

### POST /order/generate-slot

**Guard:** `AuthGuard() + RolesGuard`  
**Roles:** ADMIN

**Request body:**
```ts
{
  start: number   // 0–23
  end: number     // 0–23
}
```

**Response:**
```ts
{
  data: {
    id: string
    start: number
    end: number
    slot: string[]    // generated time strings, e.g. ["08:00 AM", "08:30 AM", ...]
  }
  message: "Slots generated successfully"
  statusCode: 200
}
```

**Notes:** Updates or creates the global Slot record. Different algorithm from `generateSlots` utility (does NOT handle midnight wraparound).

**Status codes:** 200 | 401 | 403

---

## Admin — `/admin`

All require `AuthGuard() + RolesGuard`.

---

### POST /admin

**Roles:** ADMIN

**Request body:**
```ts
{
  PointsPercentage: number
  referralPoints: number
  pointLimit: number
  canceledOrder: number
  slotDuration: number
  maxDaysBooking: number
  maxBookingsPerDay: number
  password: string
}
```

**Response:**
```ts
{
  data: Settings   // full Prisma Settings record (created)
  message: "Success"
  statusCode: 200
}
```

**Notes:** No-op if settings already exist (does not update, just returns undefined).

**Status codes:** 200 | 401 | 403

---

### GET /admin

**Roles:** ADMIN

**Response:**
```ts
{
  data: {
    id: string
    PointsPercentage: number
    referralPoints: number
    pointLimit: number
    canceledOrder: number
    slotDuration: number
    maxDaysBooking: number
    maxBookingsPerDay: number
    password: string    // hashed — NOTE: password hash exposed
    createdAt: string
    updatedAt: string
  }
  message: "Settings fetched successfully"
  statusCode: 200
}
```

**Status codes:** 200 | 401 | 403

---

### GET /admin/analytics

**Roles:** ADMIN, CASHIER

**Query params:**
```ts
{
  fromDate?: string   // defaults to 1 month ago (ADMIN) or today (CASHIER)
  toDate?: string     // defaults to today
}
```

**Response (CASHIER):**
```ts
{
  data: {
    TotalOrdersPerDay: {
      TotalOrderCount: number
      TotalSales: Decimal | 0
    }
  }
  message: "Cashier orders with counts fetched successfully"
  statusCode: 200
}
```

**Response (ADMIN):**
```ts
{
  data: {
    TotalOrderCount: number
    TotalSales: Decimal | 0
    TotalSalesPerBranch: Array<{
      id: string
      name: string | null    // EN name via TranslateName
      barbers: Array<{
        id: string
        barber: string       // "firstName lastName"
        orderCount: number
        sales: number        // sum of PAID order totals
        services: Array<{
          id: string
          name: string
          price: number
          count: number
          totalRevenue: number
        }>
      }>
    }>
    ServiceUsageSummary: Array<{
      branchId: string
      name: string | null
      services: Array<{
        serviceId: string
        name: string | null
        usageCount: number
      }>
    }>
  }
  message: "Admin orders with counts fetched successfully"
  statusCode: 200
}
```

**Status codes:** 200 | 401 | 403

---

### PUT /admin

**Roles:** ADMIN

**Request body:** `UpdateAdminDto` (all optional, extends `CreateAdminDto`):
```ts
{
  PointsPercentage?: number
  referralPoints?: number
  pointLimit?: number
  canceledOrder?: number
  slotDuration?: number    // if changed, regenerates ALL barber/cashier slots
  maxDaysBooking?: number
  maxBookingsPerDay?: number
  password?: string
}
```

**Response:**
```ts
{
  data: Settings   // updated Prisma Settings record
  message: "Settings updated successfully"
  statusCode: 200
}
```

**Status codes:** 200 | 401 | 403

---

### POST /admin/check-password

**Roles:** ADMIN, CASHIER

**Request body:**
```ts
{
  password: string
}
```

**Response:**
```ts
{
  data: {
    data: boolean    // true if password matches, false otherwise
  }
  message: "Success"
  statusCode: 200
}
```

**Notes:** Double-nested `data.data` — the outer wrap from interceptor, inner from service returning `{ data: boolean }`.

**Status codes:** 200 | 401 | 403

---

## Branch — `/branch`

---

### POST /branch

**Guard:** `AuthGuard() + RolesGuard`  
**Roles:** ADMIN  
**Consumes:** `multipart/form-data`

**Request body:**
```ts
{
  location: string
  phone: string         // 10–16 chars
  latitude: string
  longitude: string
  rate?: number         // 0–10
  Translation: Array<{ name: string, language: "EN" | "AR", description?: string }>
}
file?: image
```

**Response:**
```ts
{
  data: {
    id: string
    location: string
    phone: string
    latitude: string
    longitude: string
    rate: number | null
    branchImg: string | null
    createdAt: string
    updatedAt: string
    name: string          // first translation name
  }
  message: "Branch created successfully"
  statusCode: 200
}
```

**Status codes:** 200 | 401 | 403

---

### GET /branch

**Guard:** `AuthGuard(false)` (optional auth)  
**Header:** `accept-language: EN | AR`

**Response:**
```ts
{
  data: {
    branches: Array<{
      id: string
      location: string
      phone: string
      latitude: string
      longitude: string
      rate: number | null
      branchImg: string | null
      createdAt: string
      updatedAt: string
      nameEN: string | null
      nameAR: string | null
      name: string | null    // resolved for requested lang
      maxDaysBooking: number // from settings
      barber: BarberRecord[]
    }>
  }
  message: "Branches found successfully"
  statusCode: 200
}
```

**Status codes:** 200

---

### GET /branch/:id

**Guard:** `AuthGuard(false)` (optional auth)  
**Param:** `id` — UUID  
**Header:** `accept-language: EN | AR`

**Query params:**
```ts
{
  type?: "GENERAL" | "MASSAGE"   // filters barbers by type
}
```

**Response:**
```ts
{
  data: {
    id: string
    location: string
    phone: string
    latitude: string
    longitude: string
    rate: number | null
    branchImg: string | null
    createdAt: string
    updatedAt: string
    name: string          // single translation for requested lang
    maxDaysBooking: number
    barber: Array<{
      id: string
      rate: number
      type: "GENERAL" | "MASSAGE"
      user: { firstName: string, lastName: string, phone: string, avatar: string | null }
    }>
    Cashier: Array<{
      id: string
      user: { firstName: string, lastName: string, phone: string, avatar: string | null }
    }>
  }
  message: "Branch found successfully"
  statusCode: 200
}
```

**Status codes:** 200 | 404

---

### PUT /branch/:id

**Guard:** `AuthGuard() + RolesGuard`  
**Roles:** ADMIN  
**Param:** `id` — UUID  
**Consumes:** `multipart/form-data`

**Request body:** Same as `CreateBranchDto`, all optional.

**Response:**
```ts
{
  data: Branch    // full Prisma Branch record (no translation resolved)
  message: "Branch updated successfully"
  statusCode: 200
}
```

**Status codes:** 200 | 401 | 403 | 404

---

### DELETE /branch/:id

**Guard:** `AuthGuard() + RolesGuard`  
**Roles:** ADMIN  
**Param:** `id` — UUID

**Response:**
```ts
{
  data: "This action removes a #<id> branch"   // stub — not implemented
  message: "Success"
  statusCode: 200
}
```

**Status codes:** 200 | 401 | 403

---

## Category — `/category`

---

### GET /category

**Guard:** `AuthGuard(false)` (optional auth)  
**Header:** `accept-language: EN | AR`

**Query params:**
```ts
{
  type?: "GENERAL" | "MASSAGE"
}
```

**Response:**
```ts
{
  data: {
    categories: Array<{
      id: string
      available: boolean
      type: "GENERAL" | "MASSAGE"
      createdAt: string
      updatedAt: string
      nameEN: string | null
      nameAR: string | null
      name: string | null
      services: Array<{
        id: string
        price: number
        duration: number
        serviceImg: string | null
        available: boolean
        categoryId: string
        createdAt: string
        updatedAt: string
        nameEN: string | null
        nameAR: string | null
        name: string | null
      }>
    }>
    package?: Array<{    // only present for authenticated USER role
      id: string
      createdAt: string
      updatedAt: string
      type: "SINGLE" | "MULTIPLE"
      name: string
      description: string | null
      services: Service[]
    }>
  }
  message: "Success"
  statusCode: 200
}
```

**Status codes:** 200

---

### GET /category/:id

**Guard:** `AuthGuard(false)`  
**Param:** `id` — UUID  
**Header:** `accept-language: EN | AR`

**Response:**
```ts
{
  data: {
    id: string
    available: boolean
    type: "GENERAL" | "MASSAGE"
    createdAt: string
    updatedAt: string
    name: string          // single translation for requested lang
    services: Array<{
      id: string
      price: number
      duration: number
      serviceImg: string | null
      available: boolean
      categoryId: string
      name: string        // single translation
    }>
  }
  message: "Success"
  statusCode: 200
}
```

**Status codes:** 200 | 404

---

### POST /category

**Guard:** `AuthGuard() + RolesGuard`  
**Roles:** ADMIN  
**Header:** `accept-language: EN | AR`

**Request body:**
```ts
{
  available?: boolean
  type?: "GENERAL" | "MASSAGE"
  Translation: Array<{ name: string, language: "EN" | "AR" }>
}
```

**Response:**
```ts
{
  data: {
    id: string
    available: boolean
    type: "GENERAL" | "MASSAGE"
    createdAt: string
    updatedAt: string
    name: string    // from first translation entry
  }
  message: "Success"
  statusCode: 200
}
```

**Status codes:** 200 | 401 | 403

---

### PUT /category/:id

**Guard:** `AuthGuard() + RolesGuard`  
**Roles:** ADMIN  
**Header:** `accept-language: EN | AR`

**Request body:** `UpdateCategoryDto` (all fields optional)

**Response:**
```ts
{
  data: {
    id: string
    available: boolean
    type: "GENERAL" | "MASSAGE"
    createdAt: string
    updatedAt: string
    name: string    // translation for requested lang
  }
  message: "Success"
  statusCode: 200
}
```

**Status codes:** 200 | 401 | 403 | 404

---

### DELETE /category/:id

**Guard:** `AuthGuard() + RolesGuard`  
**Roles:** ADMIN

**Response:**
```ts
{
  data: Category   // deleted Prisma Category record
  message: "Success"
  statusCode: 200
}
```

**Notes:** Throws 409 if any services in the category have been used in orders.

**Status codes:** 200 | 401 | 403 | 404 | 409

---

## Service — `/service`

---

### GET /service

**Guard:** `AuthGuard(false)`  
**Header:** `accept-language: EN | AR`

**Response:**
```ts
{
  data: {
    services: Array<{
      id: string
      price: number
      duration: number
      serviceImg: string | null
      available: boolean
      categoryId: string
      createdAt: string
      updatedAt: string
      nameEN: string | null
      nameAR: string | null
      name: string | null
    }>
  }
  message: "Services found successfully"
  statusCode: 200
}
```

**Notes:** Only returns `available: true` services.

**Status codes:** 200

---

### GET /service/:id

**Guard:** `AuthGuard(false)`  
**Param:** `id` — UUID  
**Header:** `accept-language: EN | AR`

**Response:**
```ts
{
  data: {
    id: string
    price: number
    duration: number
    serviceImg: string | null
    available: boolean
    categoryId: string
    createdAt: string
    updatedAt: string
    nameEN: string | null
    nameAR: string | null
    name: string | null
  }
  message: "Service found successfully"
  statusCode: 200
}
```

**Status codes:** 200 | 404

---

### POST /service

**Guard:** `AuthGuard() + RolesGuard`  
**Roles:** ADMIN  
**Consumes:** `multipart/form-data`  
**Header:** `accept-language: EN | AR`

**Request body:**
```ts
{
  price: number
  duration: number
  categoryId: string   // UUID
  available?: boolean
  Translation: Array<{ name: string, language: "EN" | "AR" }>
}
file?: image
```

**Response:**
```ts
{
  data: {
    id: string
    price: number
    duration: number
    serviceImg: string | null
    available: boolean
    categoryId: string
    createdAt: string
    updatedAt: string
    nameEN: string | null
    nameAR: string | null
    name: string | null
  }
  message: "Service created successfully"
  statusCode: 200
}
```

**Status codes:** 200 | 401 | 403

---

### PUT /service/:id

**Guard:** `AuthGuard() + RolesGuard`  
**Roles:** ADMIN  
**Param:** `id` — UUID  
**Consumes:** `multipart/form-data`

**Request body:** `UpdateServiceDto` (all optional)

**Response:** Same shape as POST /service response.

**Status codes:** 200 | 401 | 403 | 404

---

### PUT /service/:id/status

**Guard:** `AuthGuard() + RolesGuard`  
**Roles:** ADMIN  
**Param:** `id` — UUID

**Request body:**
```ts
{
  available: boolean
}
```

**Response:**
```ts
{
  data: Service   // full Prisma Service record with updated available
  message: "Service deleted successfully"   // misleading message — it's a soft toggle
  statusCode: 200
}
```

**Status codes:** 200 | 401 | 403 | 404

---

## Product — `/product`

**⚠️ NO AUTH GUARDS on any endpoint.**

---

### POST /product

**Consumes:** `multipart/form-data`

**Request body:**
```ts
{
  productImg: string      // usually handled by file upload
  price: number
  available: boolean
  Translation: Array<{ name: string, language: "EN" | "AR" }>
}
file?: image
```

**Response:**
```ts
{
  data: Product           // Prisma Product record (no Translation resolved)
  message: "Product created successfully"
  statusCode: 200         // body says 201
}
```

**Status codes:** 200

---

### GET /product

**Response:**
```ts
{
  data: {
    products: Product[]   // all Prisma Product records (no Translation resolved)
  }
  message: "Products fetched successfully"
  statusCode: 200
}
```

**Status codes:** 200

---

### GET /product/:id

**Param:** `id` — string

**Response:**
```ts
{
  data: Product           // Prisma Product record
  message: "Product fetched successfully"
  statusCode: 200
}
```

**Status codes:** 200 | 404

---

### PUT /product/:id

**Param:** `id` — string

**Request body:** `UpdateProductDto` (optional fields from `CreateProductDto`)

**Response:**
```ts
{
  data: Product
  message: "Product updated successfully"
  statusCode: 200
}
```

**Status codes:** 200

---

### DELETE /product/:id

**Param:** `id` — string

**Response:**
```ts
{
  data: Product    // deleted record
  message: "Product deleted successfully"
  statusCode: 200
}
```

**Status codes:** 200

---

## Package — `/package`

All require `AuthGuard() + RolesGuard`.

---

### POST /package

**Consumes:** `multipart/form-data`

**Request body:**
```ts
{
  serviceIds: string[]       // service UUIDs (comma-separated string or array)
  price: number
  count?: number
  type?: "SINGLE" | "MULTIPLE"
  expiresAt: Date
  Translation: Array<{ name: string, language: "EN" | "AR", description?: string }>
}
file?: image
```

**Response:** Created package record (shape from `package-mutation.service.ts` which I haven't fully read — returns Prisma `Packages` record).

**Status codes:** 200 | 401 | 403

---

### GET /package

**Header:** `accept-language: EN | AR`

**Response:**
```ts
{
  data: {
    packages: Array<{
      id: string
      price: Decimal
      count: number | null
      nameEN: string | undefined
      nameAR: string | undefined
      name: string | undefined
      description: string | undefined
      createdAt: string
      updatedAt: string
      services: Array<{
        id: string
        price: number
        duration: number
        serviceImg: string | null
        available: boolean
        categoryId: string
        nameEN: string | undefined
        nameAR: string | undefined
        name: string | undefined
      }>
    }>
  }
  message: "packages fetched successfully"
  statusCode: 200
}
```

**Status codes:** 200 | 401

---

### GET /package/:id

**Param:** `id` — string  
**Header:** `accept-language: EN | AR`

**Response:**
```ts
{
  data: {
    id: string
    price: Decimal
    count: number | null
    type: "SINGLE" | "MULTIPLE"
    expiresAt: string
    createdAt: string
    updatedAt: string
    name: string           // single translation
    services: Array<{
      id: string
      serviceImg: string | null
      name: string
    }>
  }
  message: "Package fetched successfully"
  statusCode: 200
}
```

**Status codes:** 200 | 401

---

### PUT /package/:id

**Roles:** ADMIN  
**Param:** `id` — string

**Response:** String `"This action updates a #<id> package"` — **stub, not implemented.**

---

### DELETE /package/delete-many

**Response:** **Stub — not implemented.** `@Param('id')` is unused `_id`.

---

## Promo Code — `/promo-code`

All require `AuthGuard() + RolesGuard`.

---

### POST /promo-code

**Request body:**
```ts
{
  code?: string         // auto-generated Random(6) if not provided
  discount: number
  type: "PERCENTAGE" | "AMOUNT"
  expiredAt: Date
}
```

**Response:**
```ts
{
  data: {
    id: string
    code: string
    discount: number
    type: "PERCENTAGE" | "AMOUNT"
    expiredAt: string
    createdAt: string
    updatedAt: string
  }
  message: "Promo code created successfully"
  statusCode: 200
}
```

**Status codes:** 200 | 401 | 403

---

### GET /promo-code

**Response:**
```ts
{
  data: {
    promoCode: Array<{
      id: string
      code: string
      discount: number
      type: "PERCENTAGE" | "AMOUNT"
      expiredAt: string
      createdAt: string
      updatedAt: string
    }>
  }
  message: "Promo code list"
  statusCode: 200
}
```

**Status codes:** 200 | 401

---

### POST /promo-code/valid-promo-code

**Request body:**
```ts
{
  code: string
}
```

**Response:**
```ts
{
  data: {
    id: string
    code: string
    discount: number
    type: "PERCENTAGE" | "AMOUNT"
    expiredAt: string
    createdAt: string
    updatedAt: string
  }
  message: "Promo code is valid"
  statusCode: 200
}
```

**Status codes:** 200 | 401 | 409 (invalid or expired)

---

### DELETE /promo-code/:id

**Param:** `id` — string

**Response:**
```ts
{
  data: PromoCode    // deleted record
  message: "Promo code deleted successfully"
  statusCode: 200
}
```

**Status codes:** 200 | 401

---

## Client Packages — `/client-packages`

All require `AuthGuard()`.

---

### POST /client-packages

**Request body:**
```ts
{
  phone: string    // user phone (in body)
}
```

**Query params:**
```ts
{
  packageId: string
}
```

**Header:** `accept-language: EN | AR`

**Response:**
```ts
{
  data: {
    // Prisma Client record with nested ClientPackages:
    ClientPackages: Array<{
      id: string
      packageService: Array<{
        // PackagesService record + nested Service
        service: {
          id: string
          price: number
          duration: number
          serviceImg: string | null
          available: boolean
          categoryId: string
          Translation: Array<{ name: string, language: string }>  // for requested lang
        }
      }>
    }>
    // ...other Client fields
  }
  message: "Client package created successfully"
  statusCode: 201
}
```

**Status codes:** 200 | 401 | 404

---

### GET /client-packages

**Header:** `accept-language: EN | AR`

**Response:**
```ts
{
  data: {
    clientPackages: Array<{
      id: string
      createdAt: string
      updatedAt: string
      nameEN: string | undefined
      nameAR: string | undefined
      name: string | undefined
      description: string | undefined    // may throw if no translation for lang
      services: Array<{
        id: string
        price: number
        duration: number
        categoryId: string
        available: boolean
        nameEN: string | undefined
        nameAR: string | undefined
        name: string | undefined
        serviceImg: string | null
      }>
    }>
  }
  message: "Client packages fetched successfully"
  statusCode: 200
}
```

**Status codes:** 200 | 401

---

### GET /client-packages/:id

**Param:** `id` — string  
**Header:** `accept-language: EN | AR`

**Response:**
```ts
{
  data: {
    clientPackage: {
      id: string
      createdAt: string
      updatedAt: string
      name: string
      description: string | null
      Translation: Array<{ name: string, language: string, description: string | null }>
      services: Array<{
        id: string
        name: string
        serviceImg: string | null
      }>
    }
  }
  message: "Client package fetched successfully"
  statusCode: 200
}
```

**Status codes:** 200 | 401 | 404

---

### PATCH /client-packages/:id

**Stub** — returns string `"This action updates a #<NaN> clientPackage"` (converts id to number, always NaN for UUID).

---

### DELETE /client-packages/:id

**Response:**
```ts
{
  data: undefined    // transaction returns 'deleted' string internally but nothing returned
  message: "Success"
  statusCode: 200
}
```

**Status codes:** 200 | 401

---

## Complain — `/complain`

All require `AuthGuard() + RolesGuard`.

---

### POST /complain

**Roles:** USER, ADMIN

**Request body:**
```ts
{
  message: string
}
```

**Response:**
```ts
{
  data: {
    id: string
    message: string
    done: boolean
    clientId: string
    createdAt: string
    updatedAt: string
  }
  message: "Complain created successfully"
  statusCode: 200
}
```

**Status codes:** 200 | 401 | 403

---

### GET /complain

**Roles:** ADMIN

**Response:**
```ts
{
  data: {
    complains: Array<{
      id: string
      message: string
      done: boolean
      clientId: string
      createdAt: string
      updatedAt: string
      client: {
        user: {
          firstName: string
          lastName: string
          avatar: string | null
          phone: string
        }
      }
    }>
  }
  message: "Complains found successfully"
  statusCode: 200
}
```

**Status codes:** 200 | 401 | 403

---

### GET /complain/:id

**Roles:** ADMIN  
**Param:** `id` — string

**Response:**
```ts
{
  data: {
    id: string
    message: string
    done: boolean
    clientId: string
    createdAt: string
    updatedAt: string
    client: {
      user: { firstName: string, lastName: string, avatar: string | null, phone: string }
    }
  }
  message: "Complain found successfully"
  statusCode: 200
}
```

**Status codes:** 200 | 401 | 403 | 404

---

### PUT /complain/:id

**Roles:** ADMIN  
**Param:** `id` — string

**Response:**
```ts
{
  data: Complain   // updated record with done: true
  message: "Complain updated successfully"
  statusCode: 200
}
```

**Status codes:** 200 | 401 | 403

---

### DELETE /complain/:id

**Roles:** ADMIN  
**Param:** `id` — string

**Response:**
```ts
{
  data: Complain   // deleted record
  message: "Complain deleted successfully"
  statusCode: 200
}
```

**Status codes:** 200 | 401 | 403 | 404

---

## Notification — `/notification`

---

### GET /notification/reminder

**Guard:** None (header secret check only)  
**Header:** `x-cron-secret: string`

**Response:**
```ts
{
  data: { success: true }
  message: "Success"
  statusCode: 200
}
```

**Notes:** Triggers `notifyUpcomingAppointments()` scheduler manually. Throws 401 if secret doesn't match `CRON_SECRET` env var.

**Status codes:** 200 | 401

---

### PUT /notification/set-fcm

**Guard:** `AuthGuard()`

**Request body:**
```ts
{
  fcmToken: string
}
```

**Response:**
```ts
{
  data: User   // updated user with new fcmToken
  message: "Success"
  statusCode: 200
}
```

**Status codes:** 200 | 401

---

### POST /notification/send-notification

**Guard:** `AuthGuard()`

**Request body:**
```ts
{
  fcmTokens: string[]
  title: string
  message: string
  imageUrl?: string
  data?: Record<string, string>
}
```

**Response:**
```ts
{
  data: FirebaseMessagingResponse   // FCM batch response
  message: "Success"
  statusCode: 200
}
```

**Status codes:** 200 | 401

---

### GET /notification/get-history

**Guard:** `AuthGuard()`

**Response:**
```ts
{
  data: {
    notifications: Array<{
      id: string
      title: string
      message: string
      // all Prisma Notification fields
    }>
  }
  message: "Notifications retrieved successfully"
  statusCode: 200
}
```

**Status codes:** 200 | 401

---

## Points — `/points`

All require `AuthGuard()`.

---

### POST /points

**Consumes:** `multipart/form-data`

**Request body:**
```ts
{
  price: number
  points: number
  Translation: Array<{ name: string, language: "EN" | "AR" }>
}
file?: image
```

**Response:**
```ts
{
  data: {
    id: string
    offerType: "POINTS"
    expiresAt: string
    createdAt: string
    updatedAt: string
    name: string | undefined    // first translation name
    // points sub-object merged into offer
  }
  message: "Point created successfully"
  statusCode: 200
}
```

**Status codes:** 200 | 401

---

### GET /points

**Header:** `accept-language: EN | AR`

**Response:**
```ts
{
  data: {
    points: Array<{
      id: string
      price: number
      points: number
      image: string | null
      expiresAt: string
      createdAt: string
      updatedAt: string
      Translation: Array<{ name: string, language: string, description: string | null }>
      name: string | undefined    // first translation name
    }>
  }
  message: "Points fetched successfully"
  statusCode: 200
}
```

**Status codes:** 200 | 401

---

### POST /points/purchase/:pointId

**Param:** `pointId` — string

**Response:**
```ts
{
  data: Client    // updated Prisma Client record (points incremented)
  message: "Point purchased successfully"
  statusCode: 200
}
```

**Notes:** Adds `point.points` to client's total. No payment processing.

**Status codes:** 200 | 401

---

### GET /points/:id

**Param:** `id` — string  
**Header:** `accept-language: EN | AR`

**Response:**
```ts
{
  data: {
    id: string
    price: number
    points: number
    image: string | null
    expiresAt: string
    createdAt: string
    updatedAt: string
    name: string | undefined
  }
  message: "Point fetched successfully"
  statusCode: 200
}
```

**Status codes:** 200 | 401

---

### PATCH /points/:id

**Stub** — returns string `"This action updates a #<id> point"`.

---

### DELETE /points/:id

**Stub** — returns string `"This action removes a #<NaN> point"` (converts UUID to number → NaN).

---

## Static — `/static`

**⚠️ NO AUTH GUARDS on any endpoint.**

---

### POST /static/about

**Request body:**
```ts
{
  content: string
  location: string
  time: string
}
```

**Response:**
```ts
{
  data: {
    // If no static exists (creates static + about):
    id: string
    createdAt: string
    updatedAt: string
    about: {
      id: string
      content: string
      location: string
      time: string
      staticId: string
    }
  }
  // OR if updating existing about:
  // data: About record only
  message: "Static data created successfully"
  statusCode: 200
}
```

**Status codes:** 200

---

### POST /static/questions

**Request body:**
```ts
{
  question: string
  answer: string
}
```

**Response:**
```ts
{
  data: {
    questions: Array<{
      id: string
      question: string
      answer: string
    }>
  }
  message: "Static data created successfully"
  statusCode: 200
}
```

**Status codes:** 200

---

### GET /static

**Response:**
```ts
{
  data: {
    id: string
    createdAt: string
    updatedAt: string
    about: {
      id: string
      content: string
      location: string
      time: string
      staticId: string
    } | null
    questions: Array<{
      id: string
      question: string
      answer: string
      staticId: string
    }>
  } | null
  message: "Static data retrieved successfully"
  statusCode: 200
}
```

**Status codes:** 200

---

### PUT /static/about

**Request body:** `UpdateStaticDto`
```ts
{
  about?: {
    content?: string
    location?: string
    time?: string
  }
}
```

**Response:**
```ts
{
  data: About    // updated Prisma About record
  message: "Static data updated successfully"
  statusCode: 200
}
```

**Status codes:** 200

---

### PUT /static/question/:id

**Param:** `id` — string

**Request body:**
```ts
{
  question: string
  answer: string
}
```

**Response:**
```ts
{
  data: {
    id: string
    question: string
    answer: string
    staticId: string
  }
  message: "Question updated successfully"
  statusCode: 200
}
```

**Status codes:** 200 | 404

---

### DELETE /static/question/:id

**Param:** `id` — string

**Response:**
```ts
{
  data: {
    id: string
    question: string
    answer: string
    staticId: string
  }
  message: "Question deleted successfully"
  statusCode: 200
}
```

**Status codes:** 200 | 404

---

## Known Bugs & Anomalies

| Endpoint | Bug |
|----------|-----|
| `GET /order/barber-orders` | `userName` is `"firstNamelastName"` — missing space (same in cashier orders) |
| `GET /order/:id` | Returns raw `Date` objects, not formatted strings (unlike other order endpoints) |
| `POST /admin/check-password` | Returns `{ data: { data: boolean } }` — double-wrapped |
| `DELETE /branch/:id` | Returns string, not deleted record — not implemented |
| `PUT /package/:id` | Stub — no update logic |
| `DELETE /package/delete-many` | Route is `delete-many` but `@Param('id')` is unused `_id` |
| `PATCH /client-packages/:id` | Converts UUID to number → always `NaN` in response string |
| `DELETE /points/:id` | Same `NaN` issue |
| `GET /admin` | Exposes hashed `password` field in settings response |
| `/product` & `/static` | All endpoints are fully public — no auth guards |
| `PUT /user/unban` | Returns full User including password hash |
