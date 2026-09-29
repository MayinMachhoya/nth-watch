# Nth Watch

Nth Watch is a personalized movie recommendation system built on a modern MERN-like stack (PostgreSQL instead of MongoDB) with an integrated Machine Learning microservice. The application provides users with highly tailored film suggestions based on their onboarding preferences and a continuous feedback loop.

## Architecture Overview

The system is decoupled into three distinct services to ensure scalability and separation of concerns:

1. **Frontend (Client)**: A static Single Page Application (SPA).
2. **Backend (API)**: A stateless Node.js REST API.
3. **ML Microservice**: A Python-based inference engine.

All services are designed to be deployed independently in serverless or ephemeral containerized environments.

### Frontend Specifications

- **Tech Stack**: React 19, Vite 8, Tailwind CSS 4, React Router 7.
- **Client-Side Routing**: Fully handles navigation and state management locally without server-side rendering.
- **Third-Party Integrations**: 
  - **TMDB API**: Communicates directly from the browser to fetch rich movie metadata, posters, and backdrops, significantly reducing backend bandwidth.
  - **Cloudinary**: Handles direct, unsigned avatar uploads from the client.
- **State Management**: Utilizes React Context to persist user preferences, watchlists, and authentication state via JSON Web Tokens (JWT).

### Backend Specifications

- **Tech Stack**: Node.js, Express 4, PostgreSQL (via the `pg` pool library).
- **Stateless Design**: Completely serverless-ready. In-memory sessions and server-side background cron jobs have been intentionally avoided.
- **Authentication**: Stateless JWT-based authentication. Implements a secure Google OAuth 2.0 flow.
- **Data Integrity**: Implements immediate hard-deletion of user accounts and cascades associated data using secure PostgreSQL transactions.
- **Proxy Layer**: Securely proxies all algorithmic requests to the ML microservice using a shared internal secret, ensuring the Flask service is never exposed to the public web.

### Machine Learning Specifications

The recommendation engine is a Python 3.13 Flask microservice utilizing Scikit-learn, Pandas, and Numpy. It operates in memory (loading approximately 111 MB of static `.joblib` model artifacts on startup) and employs a robust hybrid recommendation approach.

- **Collaborative Filtering**: Utilizes **Truncated SVD (Singular Value Decomposition)**. The model extracts latent factors representing user preferences and movie characteristics from the MovieLens dataset.
- **Content-Based Filtering**: Employs **TF-IDF (Term Frequency-Inverse Document Frequency)** vectorization over movie genres and semantic tags to find mathematically similar titles.
- **Reinforcement Learning Re-ranker**: Implements **Thompson Sampling** (a Multi-Armed Bandit algorithm). As users interact with recommendations (thumbs up or down), the bandit dynamically updates its probability distributions to balance exploitation (showing known favorites) and exploration (surfacing novel recommendations). 
- **State Persistence**: Because the ML container is designed to be ephemeral, the Thompson Sampling bandit state is actively synced and persisted to the PostgreSQL database, ensuring continuous learning across server restarts.

## Local Development

### Prerequisites
- Node.js 20 or higher
- Python 3.13
- PostgreSQL Database (e.g., Neon)
- TMDB API Key
- Cloudinary Account
- Google Cloud Console OAuth Credentials

### Database Setup
Execute the initialization script to generate the required schema for users, preferences, and the bandit state:
```bash
cd backend
npm run migrate
```

### Running the Services

**1. ML Microservice**
```bash
cd flask
pip install -r requirements.txt
python app.py
```
*Runs on port 5000 by default.*

**2. Backend API**
```bash
cd backend
npm install
npm run dev
```
*Runs on port 4000 by default.*

**3. Frontend**
```bash
cd frontend
npm install
npm run dev
```
*Runs on port 5173 by default.*

## Deployment

The architecture is explicitly designed for modern PaaS providers:
- **Frontend**: Optimized for static edge hosting (e.g., Vercel, Netlify).
- **Backend API**: Optimized for short-lived serverless functions (e.g., Vercel Functions, AWS Lambda) using pooled database connections.
- **ML Microservice**: Optimized for lightweight, ephemeral web services (e.g., Render, Railway) with fast cold-start model loading.
