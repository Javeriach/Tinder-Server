# 🚀 Backend Overview

The backend is built using **Node.js** and **Express.js**, providing a fast and scalable API. It uses **MongoDB** as the database, with authentication handled via **JWT & Cookies**. Real-time chat is powered by **Socket.io**, and additional services like **AWS SES** and **Razorpay** are integrated for email notifications and premium features.

---

## 🛠️ Tech Stack
- **Node.js** - Server-side JavaScript runtime
- **Express.js** - Web framework for API development
- **MongoDB** - NoSQL database for storing users, messages, and connections
- **JWT & Cookies** - Secure authentication & session management
- **Socket.io** - Real-time chat communication
- **AWS SES** - Email notifications for admin alerts
- **Razorpay** - Payment integration for premium features
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

### 💳 Payments & Subscription (Razorpay)
- **Gold Subscription** - 200 connection requests/day & chat access
- **Premium Subscription** - Unlimited requests, blue tick verification & chat access
- **Webhook Handling for Secure Payments**
- **Transaction Logs Stored in Database**

### 📧 Email Notifications (AWS SES)
- **Admin Alerts on User Connections**
- **Email Verification & Password Reset Links**

---

## 🚀 Deployment
The backend is deployed on **AWS EC2** and served using **Nginx** as a reverse proxy.  
- **Node.js & Express.js** run on the EC2 instance.
- **MongoDB Atlas** is used for a cloud database.
- **Nginx** is configured to manage requests and enable SSL.

---

📌 **This backend ensures secure, real-time communication with a scalable architecture.** 🚀
