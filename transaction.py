from sqlalchemy import Column, Integer, String, Float, Boolean, DateTime, Text, Enum as SAEnum
from sqlalchemy.sql import func
from app.db.database import Base
import enum

class TransactionType(str, enum.Enum):
    PAYMENT = "PAYMENT"
    TRANSFER = "TRANSFER"
    CASH_OUT = "CASH_OUT"
    CASH_IN = "CASH_IN"
    DEBIT = "DEBIT"

class TransactionStatus(str, enum.Enum):
    APPROVED = "APPROVED"
    FLAGGED = "FLAGGED"
    BLOCKED = "BLOCKED"

class Transaction(Base):
    __tablename__ = "transactions"

    id = Column(Integer, primary_key=True, index=True)
    step = Column(Integer, nullable=False)
    type = Column(SAEnum(TransactionType), nullable=False)
    amount = Column(Float, nullable=False)
    name_orig = Column(String(50), nullable=False)
    old_balance_orig = Column(Float, default=0.0)
    new_balance_orig = Column(Float, default=0.0)
    name_dest = Column(String(50), nullable=False)
    old_balance_dest = Column(Float, default=0.0)
    new_balance_dest = Column(Float, default=0.0)

    # Prediction outputs
    is_fraud_predicted = Column(Boolean, default=False)
    is_fraud_actual = Column(Boolean, nullable=True)
    risk_score = Column(Float, default=0.0)           # 0-100
    cnn_score = Column(Float, default=0.0)
    lstm_score = Column(Float, default=0.0)
    behavioral_score = Column(Float, default=0.0)
    status = Column(SAEnum(TransactionStatus), default=TransactionStatus.APPROVED)

    # Feature flags
    balance_diff_orig = Column(Float, default=0.0)
    balance_diff_dest = Column(Float, default=0.0)
    is_flagged_fraud = Column(Boolean, default=False)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
