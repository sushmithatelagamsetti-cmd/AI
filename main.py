from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from app.db.database import create_tables
from app.ml.fraud_model import detector
from app.api import transactions, auth
import logging

logging.basicConfig(level=logging.INFO, format="%(asctime)s | %(levelname)s | %(message)s")
logger = logging.getLogger(__name__)

@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Starting up …")
    await create_tables()
    detector.load()          # load ML models at startup
    logger.info("Ready ✓")
    yield
    logger.info("Shutting down …")

app = FastAPI(
    title="Real-Time Fraud Detection API",
    description="CNN+LSTM + Behavioral Deep Learning fraud detection system",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(transactions.router)

@app.get("/")
async def root():
    return {"message": "Fraud Detection API", "status": "running",
            "models_loaded": detector.loaded}

@app.get("/health")
async def health():
    return {"status": "ok", "models_loaded": detector.loaded}
