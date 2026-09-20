from fastapi import APIRouter, Depends, HTTPException, Query, WebSocket, WebSocketDisconnect
from sqlalchemy.ext.asyncio import AsyncSession
from app.db.database import get_db
from app.schemas.transaction import TransactionCreate, TransactionResponse, DashboardStats
from app.services import transaction_service
from typing import List, Optional
import asyncio, json, random, logging

router = APIRouter(prefix="/transactions", tags=["Transactions"])
logger = logging.getLogger(__name__)

# WebSocket connection manager
class ConnectionManager:
    def __init__(self):
        self.active: List[WebSocket] = []

    async def connect(self, ws: WebSocket):
        await ws.accept()
        self.active.append(ws)

    def disconnect(self, ws: WebSocket):
        if ws in self.active:
            self.active.remove(ws)

    async def broadcast(self, data: dict):
        dead = []
        for ws in self.active:
            try:
                await ws.send_json(data)
            except Exception:
                dead.append(ws)
        for ws in dead:
            self.disconnect(ws)

manager = ConnectionManager()

@router.post("/", response_model=TransactionResponse)
async def submit_transaction(tx: TransactionCreate, db: AsyncSession = Depends(get_db)):
    """Submit a transaction for real-time fraud analysis."""
    db_tx, prediction = await transaction_service.create_transaction(db, tx)
    # Broadcast alert to all WS clients if flagged
    if prediction["status"] in ("FLAGGED", "BLOCKED"):
        await manager.broadcast({
            "type": "ALERT",
            "id": db_tx.id,
            "amount": tx.amount,
            "risk_score": prediction["risk_score"],
            "status": prediction["status"],
            "tx_type": tx.type,
            "name_orig": tx.name_orig,
        })
    return db_tx

@router.get("/", response_model=List[TransactionResponse])
async def list_transactions(
    skip: int = 0,
    limit: int = Query(50, le=200),
    status: Optional[str] = None,
    db: AsyncSession = Depends(get_db)
):
    return await transaction_service.get_transactions(db, skip=skip, limit=limit, status_filter=status)

@router.get("/dashboard/stats", response_model=DashboardStats)
async def dashboard_stats(db: AsyncSession = Depends(get_db)):
    return await transaction_service.get_dashboard_stats(db)

@router.get("/model/metrics")
async def model_metrics():
    return await transaction_service.get_model_metrics()

@router.websocket("/ws/alerts")
async def websocket_alerts(websocket: WebSocket):
    """WebSocket endpoint — pushes real-time fraud alerts to the React dashboard."""
    await manager.connect(websocket)
    try:
        while True:
            await websocket.receive_text()   # keep-alive ping
    except WebSocketDisconnect:
        manager.disconnect(websocket)
