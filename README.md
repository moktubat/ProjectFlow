# ProjectFlow

ProjectFlow is a project management application built with Node.js, MongoDB, Cloudinary, Resend, Google Gemini, and Vercel.

## Prerequisites

Before running the project, make sure you have:

- Node.js (v18 or later recommended)
- npm or yarn
- MongoDB Atlas database
- Cloudinary account
- Resend account
- Google Gemini API key

---

## Installation

Clone the repository:

```bash
git clone https://github.com/your-username/projectflow.git
cd projectflow
```

Install dependencies:

```bash
npm install
```

---

## Environment Variables

Create a `.env` file in the project root and add the following variables.

```env
# ──────────────────────────────────────────────────────────────
# Server
# ──────────────────────────────────────────────────────────────

PORT=3000

# Public URL of the deployed application
APP_URL=https://projects-flow.vercel.app

# Allowed CORS origins
ALLOWED_ORIGINS=https://projects-flow.vercel.app,http://localhost:3000

# One-time setup token
SETUP_TOKEN=your_setup_token

# ──────────────────────────────────────────────────────────────
# MongoDB
# ──────────────────────────────────────────────────────────────

MONGODB_URI=your_mongodb_connection_string

# ──────────────────────────────────────────────────────────────
# Cloudinary
# ──────────────────────────────────────────────────────────────

CLOUDINARY_URL=your_cloudinary_url
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret

# ──────────────────────────────────────────────────────────────
# Resend
# ──────────────────────────────────────────────────────────────

RESEND_API_KEY=your_resend_api_key

# Verified sender email
RESEND_FROM_EMAIL=ProjectFlow <your_verified_email>

# ──────────────────────────────────────────────────────────────
# Google Gemini
# ──────────────────────────────────────────────────────────────

GEMINI_API_KEY=your_gemini_api_key

# ──────────────────────────────────────────────────────────────
# Environment
# ──────────────────────────────────────────────────────────────

NODE_ENV=development
```

> **Important:** Never commit your `.env` file or API keys to GitHub.

---

## Running the Application

Start the development server:

```bash
npm run dev
```

Build the application:

```bash
npm run build
```

Start the production server:

```bash
npm start
```

---

## Environment Variables Explained

| Variable | Description |
|-----------|-------------|
| `PORT` | Server port |
| `APP_URL` | Public URL of the deployed application |
| `ALLOWED_ORIGINS` | Comma-separated list of CORS origins |
| `SETUP_TOKEN` | One-time initialization token |
| `MONGODB_URI` | MongoDB Atlas connection string |
| `CLOUDINARY_URL` | Cloudinary connection URL |
| `CLOUDINARY_CLOUD_NAME` | Cloudinary cloud name |
| `CLOUDINARY_API_KEY` | Cloudinary API key |
| `CLOUDINARY_API_SECRET` | Cloudinary API secret |
| `RESEND_API_KEY` | API key for sending transactional emails |
| `RESEND_FROM_EMAIL` | Verified sender email address |
| `GEMINI_API_KEY` | Google Gemini API key |
| `NODE_ENV` | Application environment (`development` or `production`) |

---

## Deployment

The application is configured to be deployed on **Vercel**.

Production URL:

```
https://projects-flow.vercel.app
```

Make sure all environment variables are configured in your deployment platform before deploying.

---

## Security

- Do **not** commit API keys or secrets.
- Add `.env` to `.gitignore`.
- Rotate any exposed credentials immediately if they have been shared publicly.
- Use separate credentials for development and production.

---

## Tech Stack

- Node.js
- Express.js
- MongoDB Atlas
- Cloudinary
- Resend
- Google Gemini API
- Vercel

---

## License

This project is licensed under the MIT License.