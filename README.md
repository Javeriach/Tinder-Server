# 🚀 Backend Overview

The backend is built using **Node.js** and **Express.js**, providing a fast and scalable API. It uses **MongoDB** as the database, with authentication handled via **JWT & Cookies**. Real-time chat is powered by **Socket.io**, and additional services like **Resend** and **Stripe** are integrated for email notifications and premium features.

---

## 🛠️ Tech Stack
- **Node.js** - Server-side JavaScript runtime
- **Express.js** - Web framework for API development
- **MongoDB** - NoSQL database for storing users, messages, and connections
- **JWT & Cookies** - Secure authentication & session management
- **Socket.io** - Real-time chat communication
- **Resend** - Email notifications for admin alerts
- **Stripe** - Payment integration for premium features
- **Nginx** - Reverse proxy for handling requests and SSL termination
- **AWS EC2** - Deployment environment for backend services

---

## 🔥 Features

### 🛡️ Authentication & Security
- **User Registration & Login** using **JWT & Cookies**
- **Password Hashing** with **bcrypt**

### 💬 Real-Time Chat
- **WebSockets (Socket.io) for instant messaging**
- **Message History Stored in MongoDB**
- **Online/Offline Status**
- **Image Uploads via Cloudinary & URL stored in DB**

### 🤝 User Connections
- **Swipe Right → Send Connection Request**
- **Swipe Left → Ignore**
- **Friend Requests - Accept or Decline**
- **Friends List & Block User Feature**

### 💳 Payments & Subscription (Stripe)
- **Gold Subscription** - 200 connection requests/day & chat access
- **Premium Subscription** - Unlimited requests, blue tick verification & chat access
- **Stripe Checkout** (hosted payment page) + **signed webhook** to confirm payment and upgrade the user
- **Transaction Logs Stored in Database**

Flow: `POST /payment/create` → returns a Stripe Checkout `url` → frontend redirects the
browser there → Stripe redirects back to `FRONTEND_URL/premium?payment=success` →
`POST /payment/webhook` verifies the `checkout.session.completed` event and sets `isPremium`.

| Variable | Required | Description |
| --- | --- | --- |
| `STRIPE_SECRET_KEY` | Yes | Secret key from the [Stripe dashboard](https://dashboard.stripe.com/apikeys). Payments return `503` if unset. |
| `STRIPE_WEBHOOK_SECRET` | Yes | Webhook signing secret (`whsec_…`). From the dashboard, or `stripe listen` for local testing. |
| `PAYMENT_CURRENCY` | No | Lowercase ISO code. Defaults to `pkr`; set to `usd` if PKR is not enabled on your account. |
| `FRONTEND_URL` | No | Base URL Stripe redirects back to. Defaults to `http://localhost:5173`. |

**Testing payments:**

```bash
npm test              # unit + integration tests for the payment routes (offline)
npm run payment:test  # creates a real test-mode Checkout Session and prints its URL

# Local webhook forwarding (separate terminal, requires the Stripe CLI):
stripe listen --forward-to localhost:7777/payment/webhook
stripe trigger checkout.session.completed
```

### 📧 Email Notifications (Resend)
- **Admin Alerts on User Connections**
- **Email Verification & Password Reset Links**

Set the following environment variables to enable email:

| Variable | Required | Description |
| --- | --- | --- |
| `RESEND_API_KEY` | Yes | API key from the [Resend dashboard](https://resend.com/api-keys). If unset, email sending is silently disabled. |
| `EMAIL_FROM` | No | Sender address. Must be on a domain verified in Resend. Defaults to `onboarding@resend.dev` (Resend's shared test sender — can only deliver to the account owner's email). |
| `EMAIL_TO` | No | Recipient for admin alert emails. Defaults to `javeriakanwal383@gmail.com`. |

**Testing email:**

```bash
npm test            # unit tests for the email helper (node:test, no network)
npm run email:test  # sends one real email using the .env config
```

---

## 🚀 Deployment
The backend is deployed on **AWS EC2** and served using **Nginx** as a reverse proxy.  
- **Node.js & Express.js** run on the EC2 instance.
- **MongoDB Atlas** is used for a cloud database.
- **Nginx** is configured to manage requests and enable SSL.

---

📌 **This backend ensures secure, real-time communication with a scalable architecture.** 🚀
