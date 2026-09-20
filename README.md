# 🛡️ Real-Time Fraud Detection in Financial Transactions

> \\\*\\\*Stack:\\\*\\\* React · FastAPI (Python) · PostgreSQL · TensorFlow  
> \\\*\\\*AI Models:\\\*\\\* CNN + LSTM · Behavioral Dense Network · Isolation Forest  
> \\\*\\\*Dataset:\\\*\\\* PaySim (preprocessed\\\_dataset.csv — 6.3M transactions)

\---

## 📁 Project Structure

```
fraud\\\_detection/
├── backend/
│   ├── app/
│   │   ├── main.py                  # FastAPI app entry point
│   │   ├── config.py                # Environment settings
│   │   ├── db/
│   │   │   └── database.py          # Async SQLAlchemy setup
│   │   ├── models/
│   │   │   ├── transaction.py       # Transaction ORM model
│   │   │   └── user.py              # User ORM model
│   │   ├── schemas/
│   │   │   ├── transaction.py       # Pydantic request/response schemas
│   │   │   └── user.py              # Auth schemas
│   │   ├── api/
│   │   │   ├── transactions.py      # REST + WebSocket endpoints
│   │   │   └── auth.py              # JWT auth endpoints
│   │   ├── services/
│   │   │   ├── transaction\\\_service.py
│   │   │   └── auth\\\_service.py
│   │   └── ml/
│   │       └── fraud\\\_model.py       # CNN+LSTM + Behavioral + Isolation Forest
│   ├── data/
│   │   └── preprocessed\\\_dataset.zip # PaySim dataset (place here)
│   ├── trained\\\_models/              # Auto-created after training
│   ├── seed.py                      # DB seed script
│   ├── requirements.txt
│   ├── Dockerfile
│   └── .env
├── frontend/
│   ├── src/
│   │   ├── App.js                   # React Router setup
│   │   ├── context/AuthContext.js   # JWT auth context
│   │   ├── hooks/useWebSocket.js    # Real-time WS alerts
│   │   ├── services/api.js          # Axios API client
│   │   └── pages/
│   │       ├── Login.js             # Login page
│   │       ├── Dashboard.js         # Analytics dashboard
│   │       ├── SubmitTransaction.js # Transaction submission + result
│   │       └── Transactions.js      # Paginated transaction history
│   ├── public/index.html
│   ├── package.json
│   └── Dockerfile
└── docker-compose.yml
```

\---

## 🧠 AI Architecture

```
Input Transaction
       │
       ▼
┌─────────────────────────────────────────┐
│          Feature Engineering             │
│  12 features: amount, balances,          │
│  velocity ratios, type encoding,         │
│  merchant flag, balance diffs            │
└──────────────┬──────────────────────────┘
               │
       ┌───────┴────────┐
       ▼                ▼
┌──────────────┐  ┌─────────────────────┐
│  BEHAVIORAL  │  │    CNN + LSTM        │
│  Dense Model │  │                      │
│              │  │  Conv1D(64) ──┐      │
│  Dense(256)  │  │  Conv1D(128)  │ CNN  │
│  Dense(128)  │  │  GAP()    ────┘      │
│  Dense(64)   │  │                      │
│  Dense(32)   │  │  LSTM(128) ──┐       │
│  Sigmoid     │  │  LSTM(64)  ──┘ LSTM  │
└──────┬───────┘  │  Concat(CNN, LSTM)   │
       │          │  Dense(128)          │
       │          │  Dense(64)           │
       │          │  Sigmoid             │
       │          └──────────┬───────────┘
       │                     │
       ▼                     ▼           ┌──────────────┐
  beh\\\_score (40%)   cnn\\\_lstm\\\_score(40%) │ Isolation    │
       │                     │           │ Forest (20%) │
       └──────────┬──────────┘           └──────┬───────┘
                  ▼                             ▼
         ┌────────────────────────────────────────┐
         │      Ensemble Risk Score (0–100)        │
         └────────────────────────────────────────┘
                  │
       ┌──────────┼──────────┐
       ▼          ▼          ▼
   APPROVED    FLAGGED    BLOCKED
   (< 50)     (50–75)    (≥ 75)
```

\---

## ⚙️ SYSTEM REQUIREMENTS

|Tool|Minimum Version|
|-|-|
|Python|3.10+|
|Node.js|18+|
|PostgreSQL|14+|
|pip|23+|
|npm|9+|
|RAM|8 GB (for TF)|
|Disk|5 GB free|

\---

## 🚀 SETUP — STEP BY STEP

### STEP 1 — PostgreSQL Setup

**Option A: Using Docker (recommended)**

```bash
docker run -d \\\\
  --name fraud\\\_pg \\\\
  -e POSTGRES\\\_USER=fraud\\\_user \\\\
  -e POSTGRES\\\_PASSWORD=fraud\\\_pass \\\\
  -e POSTGRES\\\_DB=fraud\\\_db \\\\
  -p 5432:5432 \\\\
  postgres:16-alpine
```

**Option B: Local PostgreSQL**

```sql
-- Run in psql as superuser:
CREATE USER fraud\\\_user WITH PASSWORD 'fraud\\\_pass';
CREATE DATABASE fraud\\\_db OWNER fraud\\\_user;
GRANT ALL PRIVILEGES ON DATABASE fraud\\\_db TO fraud\\\_user;
```

\---

### STEP 2 — Backend Setup

```bash
# Navigate to backend
cd fraud\\\_detection/backend

# Create virtual environment
python -m venv venv

# Activate (Linux/Mac)
source venv/bin/activate

# Activate (Windows)
venv\\\\Scripts\\\\activate

# Install all dependencies
pip install -r requirements.txt
```

> ⚠️ TensorFlow installation may take 3–5 minutes. If on Apple Silicon, use:
> `pip install tensorflow-macos tensorflow-metal`

\---

### STEP 3 — Dataset Placement

The dataset zip should already be inside `backend/data/`. Verify:

```bash
ls backend/data/
# Expected: preprocessed\\\_dataset.zip
```

\---

### STEP 4 — Train the ML Models

```bash
# From backend/ directory (with venv active)
cd fraud\\\_detection/backend

python -m app.ml.fraud\\\_model
```

This will:

* Extract and load the PaySim dataset
* Engineer 12 features per transaction
* Apply SMOTE oversampling to handle class imbalance
* Train the **Behavioral Dense model** (30 epochs)
* Build sequences and train the **CNN+LSTM model** (30 epochs)
* Train an **Isolation Forest** anomaly detector
* Save all models to `./trained\\\_models/`
* Print evaluation metrics (AUC-ROC, Precision, Recall, F1)

> ⏱️ Training time: \\\~10–20 min on CPU | \\\~3–5 min on GPU  
> 📊 Expected: AUC-ROC > 0.98, Precision > 0.90

\---

### STEP 5 — Start the Backend

```bash
# From backend/ directory (with venv active)
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

Verify backend is running:

```bash
curl http://localhost:8000/health
# Expected: {"status":"ok","models\\\_loaded":true}
```

API docs available at: **http://localhost:8000/docs**

\---

### STEP 6 — Seed the Database

In a new terminal (with venv active):

```bash
cd fraud\\\_detection/backend
python seed.py
```

This creates:

* Admin user: `admin` / `admin123`
* 25 sample transactions

\---

### STEP 7 — Frontend Setup

```bash
cd fraud\\\_detection/frontend

# Install Node dependencies
npm install

# Start React development server
npm start
```

The app opens at **http://localhost:3000**

\---

## 🌐 Application Pages

|Page|URL|Description|
|-|-|-|
|Login|`/login`|JWT authentication|
|Dashboard|`/dashboard`|Real-time analytics, charts, live alerts|
|Submit|`/submit`|Submit transaction for fraud analysis|
|Transactions|`/transactions`|Paginated history with filters|

**Demo credentials:** `admin` / `admin123`

\---

## 📡 API Endpoints

|Method|Endpoint|Description|
|-|-|-|
|POST|`/auth/register`|Register user|
|POST|`/auth/login`|Get JWT token|
|GET|`/auth/me`|Current user|
|POST|`/transactions/`|Submit transaction → get fraud score|
|GET|`/transactions/`|List transactions (with filters)|
|GET|`/transactions/dashboard/stats`|Dashboard statistics|
|GET|`/transactions/model/metrics`|ML model performance|
|WS|`/transactions/ws/alerts`|Real-time fraud alert stream|

\---

## 🐳 Docker (Full Stack)

```bash
# From project root
cd fraud\\\_detection

# Build and start everything
docker-compose up --build

# Then seed (in new terminal)
docker-compose exec backend python seed.py
```

\---

## 🧪 Test the Fraud Detection

### Using the UI (Submit Transaction page)

Click any quick-fill scenario button to pre-load test data.

### Using curl

**Normal transaction (should be APPROVED):**

```bash
curl -X POST http://localhost:8000/transactions/ \\\\
  -H "Content-Type: application/json" \\\\
  -d '{
    "step": 1, "type": "PAYMENT", "amount": 1500,
    "name\\\_orig": "C1231006815", "old\\\_balance\\\_orig": 50000, "new\\\_balance\\\_orig": 48500,
    "name\\\_dest": "M1979787155", "old\\\_balance\\\_dest": 0, "new\\\_balance\\\_dest": 0
  }'
```

**Suspicious transfer (should be FLAGGED/BLOCKED):**

```bash
curl -X POST http://localhost:8000/transactions/ \\\\
  -H "Content-Type: application/json" \\\\
  -d '{
    "step": 1, "type": "TRANSFER", "amount": 450000,
    "name\\\_orig": "C1305486145", "old\\\_balance\\\_orig": 450000, "new\\\_balance\\\_orig": 0,
    "name\\\_dest": "C553264065", "old\\\_balance\\\_dest": 0, "new\\\_balance\\\_dest": 0
  }'
```

\---

## 🗄️ Dataset Columns

|Column|Description|
|-|-|
|`step`|Hour of simulation (1–744)|
|`type`|PAYMENT, TRANSFER, CASH\_OUT, CASH\_IN, DEBIT|
|`amount`|Transaction amount|
|`nameOrig`|Origin account ID|
|`oldbalanceOrg`|Balance before transaction (origin)|
|`newbalanceOrig`|Balance after transaction (origin)|
|`nameDest`|Destination account ID|
|`oldbalanceDest`|Balance before (destination)|
|`newbalanceDest`|Balance after (destination)|
|`isFraud`|Ground truth fraud label (0/1)|
|`isFlaggedFraud`|System flag label|

\---

## 🔧 Troubleshooting

**TensorFlow import error on Windows:**

```bash
pip install tensorflow-cpu   # Use CPU-only version
```

**PostgreSQL connection refused:**

```bash
# Check if PostgreSQL is running
pg\\\_isready -h localhost -U fraud\\\_user
# Or restart docker container
docker start fraud\\\_pg
```

**Models not found (on backend start):**

```bash
# Run training first
python -m app.ml.fraud\\\_model
```

**Port 8000 already in use:**

```bash
# Use a different port
uvicorn app.main:app --port 8001 --reload
# Update frontend/src/services/api.js baseURL accordingly
```

**npm install fails:**

```bash
# Clear cache and retry
npm cache clean --force
rm -rf node\\\_modules
npm install
```

\---

## 📈 Expected Model Performance

|Model|Accuracy|Precision|Recall|AUC-ROC|
|-|-|-|-|-|
|CNN+LSTM|\~98.1%|\~92.3%|\~90.1%|\~0.991|
|Behavioral|\~97.3%|\~89.1%|\~87.6%|\~0.982|
|Ensemble|\~98.6%|\~93.5%|\~91.8%|\~0.993|

> Results may vary based on training sample fraction used.

