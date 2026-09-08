# Enterprise Intelligent Platform

An enterprise-grade AI-powered intelligence platform combining RAG, Multi-Agent AI, Knowledge Graph, Business Intelligence, and Explainable AI — built with **React + TypeScript + Vite** (frontend) and **Node.js + Express + TypeScript** (backend) backed by **MongoDB**.

## Architecture

```
React + TypeScript Frontend
        ↓
   Axios / REST API
        ↓
Node.js + Express + TypeScript Backend
        ↓
   AI Orchestration Layer
        ↓
MongoDB / MongoDB Vector Search
        ↓
Enterprise Data + AI Services
```

## Tech Stack

### Frontend
- React 18 + TypeScript
- Vite
- Tailwind CSS + shadcn/ui
- React Router v6
- TanStack Query
- Recharts
- Axios

### Backend
- Node.js + Express + TypeScript
- JWT Authentication + Refresh Tokens
- Role-Based Access Control (RBAC)
- WebSocket (ws)
- MongoDB + Mongoose
- OpenAI SDK (GPT-4o + text-embedding-3-large)
- MongoDB Atlas Vector Search

## Quick Start

### Prerequisites
- Node.js 18+
- MongoDB (local or Atlas)
- OpenAI API Key

### 1. Clone & Install
```bash
# Install backend dependencies
cd backend && npm install

# Install frontend dependencies
cd ../frontend && npm install
```

### 2. Configure Environment
```bash
# Copy env examples
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env

# Edit both .env files with your credentials
```

### 3. Run Development Servers
```bash
# Terminal 1 — Backend
cd backend && npm run dev

# Terminal 2 — Frontend
cd frontend && npm run dev
```

Backend runs on: http://localhost:5000  
Frontend runs on: http://localhost:5173

## Project Structure

```
pro-expo/
├── backend/          # Node.js + Express + TypeScript API
│   └── src/
│       ├── config/
│       ├── controllers/
│       ├── middleware/
│       ├── models/
│       ├── routes/
│       ├── services/
│       ├── agents/
│       ├── rag/
│       ├── ingestion/
│       ├── knowledge-graph/
│       ├── analytics/
│       ├── security/
│       ├── types/
│       └── utils/
└── frontend/         # React + TypeScript + Vite
    └── src/
        ├── api/
        ├── components/
        ├── pages/
        ├── layouts/
        ├── hooks/
        ├── types/
        └── utils/
```

## Features

- 🧠 **Multi-Agent AI** — 11 specialized agents orchestrated by a Master Intelligence Agent
- 🔍 **Advanced RAG** — Hybrid retrieval with vector search + keyword search + metadata filtering
- 📊 **Business Intelligence** — Analytics, dashboards, and executive reports
- 🕸️ **Knowledge Graph** — Relationship-based reasoning across entities
- 🔐 **Enterprise Security** — JWT, RBAC, organization isolation, audit logging
- 💡 **Explainable AI** — Every response includes evidence, citations, and confidence scores
- 📄 **Document Intelligence** — Ingest PDF, DOCX, Excel, CSV, emails, and more
- ⚡ **Real-time Updates** — WebSocket support for live agent execution updates
# pro-expo
