# Rentora Server — REST API

Backend API server for the Rentora Property Rental & Booking Platform. Handles authentication, property management, bookings, payments, and admin operations.

---

## 🌐 Live URL

**[https://rentora-client-yav5.vercel.app](https://rentora-client-yav5.vercel.app)**

---

## ✨ Key Features

- JWT authentication middleware for all protected routes
- Role-based route protection — Tenant, Owner, Admin
- Property CRUD with backend search, filter, sort and pagination
- Booking management with owner approval workflow
- Stripe payment intent creation and confirmation
- Transaction recording and monthly earnings breakdown
- Favorites and review system
- Admin user management with role change support

---

## 📦 NPM Packages Used

| Package | Purpose |
|---|---|
| `express` | Web server and routing |
| `mongodb` | MongoDB database driver |
| `jsonwebtoken` | JWT token generation and verification |
| `stripe` | Stripe payment processing |
| `dotenv` | Environment variable management |
| `cors` | Cross-origin resource sharing |
