# EmbedAI

**Turn your documents into intelligent, embeddable AI chatbots in under two minutes.**

[![Next.js](https://img.shields.io/badge/Next.js-15-black?style=flat-square&logo=next.js)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue?style=flat-square&logo=typescript)](https://www.typescriptlang.org/)
[![Supabase](https://img.shields.io/badge/Supabase-pgvector-emerald?style=flat-square&logo=supabase)](https://supabase.com/)
[![TailwindCSS](https://img.shields.io/badge/TailwindCSS-v3-38bdf8?style=flat-square&logo=tailwind-css)](https://tailwindcss.com/)


EmbedAI is a full-stack, production-ready AI SaaS platform that ingests business documents (PDF, DOCX, TXT), generates vector embeddings using semantic chunking, and powers a customizable floating chat widget that can be embedded into any website with a single line of JavaScript.

**Live Demo:** [embedai-bot.vercel.app](https://embedai-bot.vercel.app)

---

## Table of Contents

- [Features](#features)
- [Tech Stack](#tech-stack)
- [Getting Started](#getting-started)
- [Embedding the Widget](#embedding-the-widget)
- [Author](#author)

---

## Features

- **Multi-Format Ingestion:** Upload PDF, Word (`.docx`), and plain text (`.txt`) files, with serverless text extraction via `unpdf` and `mammoth`.
- **RAG Pipeline:** Splits text into semantic chunks and generates 768-dimensional vector embeddings using Google's Gemini embedding model.
- **Grounded Answers:** Uses cosine similarity search (`pgvector`) to retrieve relevant context, reducing hallucinations and keeping responses grounded in your uploaded documents.
- **Real-Time Streaming:** Low-latency token streaming powered by Groq (Llama / Qwen), with Gemini as a fallback.
- **Customizable Widget:** Configure brand colors, bot name, avatar, and welcome message.
- **One-Line Embed:** Lightweight, dependency-free JavaScript widget (`widget.js`) with markdown rendering and a mobile-responsive drawer.
- **Conversation Tracking:** Per-session chat history with analytics on user interactions.
- **Authentication and Security:** User authentication, row-level security (RLS), and API rate limiting via Supabase.

---

## Tech Stack

| Layer | Technology |
|---|---|
| **Framework** | Next.js 15 (App Router, Server Actions, API Route Handlers) |
| **Language** | TypeScript |
| **Styling** | Tailwind CSS, shadcn/ui, Lucide Icons |
| **Database and Vector Store** | Supabase (PostgreSQL with `pgvector`) |
| **Embeddings** | Google Gemini (`text-embedding-004`) |
| **LLM Inference** | Groq API (`qwen/qwen3.8-27b`, `llama-3.3-70b-versatile`) |
| **File Parsing** | `unpdf` (headless PDF), `mammoth` (DOCX) |
| **Hosting** | Vercel (Edge and Serverless Node.js functions) |

---

## Getting Started

### Prerequisites

- Node.js 18 or later
- A [Supabase](https://supabase.com/) project
- A [Google Gemini](https://ai.google.dev/) API key
- A [Groq](https://groq.com/) API key

### 1. Clone the repository

```bash
git clone https://github.com/shivraj-yadav/embedai.git
cd embedai
```

### 2. Install dependencies

```bash
npm install
```

### 3. Configure environment variables

Create a `.env.local` file in the project root:

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-role-key

# AI Providers
GEMINI_API_KEY=your-gemini-api-key
GROQ_API_KEY=your-groq-api-key
GROQ_MODEL=qwen/qwen3.8-27b

# Application URL
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### 4. Set up the database

Run the migrations in [`supabase/migrations`](./supabase/migrations) using the Supabase SQL editor. They enable the `vector` extension and create the following:

- Tables: `chatbots`, `documents`, `document_chunks`, `conversations`, `messages`
- RPC function: `match_chunks` (similarity search)

### 5. Start the development server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## Embedding the Widget

After creating a chatbot and uploading documents, add the following snippet before the closing `</body>` tag of any website (HTML, WordPress, Shopify, Webflow, React, etc.):

```html
<script
  src="https://embedai-bot.vercel.app/widget.js"
  data-chatbot-id="YOUR_CHATBOT_ID"
  async>
</script>
```

Replace `YOUR_CHATBOT_ID` with the ID shown in your dashboard.


---

## Author

**Shivraj Yadav**

- GitHub: [github.com/shivraj-yadav](https://github.com/shivraj-yadav)
- LinkedIn: [linkedin.com/in/shivraj-yadav](https://linkedin.com/in/shivraj-yadav)
- Portfolio: [shivraj-yadav.vercel.app](https://shivraj-yadav.vercel.app/)