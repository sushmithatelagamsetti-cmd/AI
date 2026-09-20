"""
Run this ONCE after setting up the database to:
1. Create the admin user (admin / admin123)
2. Seed 100 sample transactions from the dataset
"""
import asyncio, sys, os, random
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from app.config import settings
from app.db.database import Base
from app.services.auth_service import create_user, get_user
from app.services.transaction_service import create_transaction
from app.schemas.transaction import TransactionCreate

engine = create_async_engine(settings.DATABASE_URL)
SessionLocal = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

SAMPLE_TXS = [
    {"step":1, "type":"PAYMENT",  "amount":9839.64, "name_orig":"C1231006815",
     "old_balance_orig":170136.0, "new_balance_orig":160296.36, "name_dest":"M1979787155",
     "old_balance_dest":0.0, "new_balance_dest":0.0},
    {"step":1, "type":"TRANSFER", "amount":181.0,   "name_orig":"C1305486145",
     "old_balance_orig":181.0,    "new_balance_orig":0.0,       "name_dest":"C553264065",
     "old_balance_dest":0.0,      "new_balance_dest":0.0},
    {"step":1, "type":"CASH_OUT","amount":181.0,   "name_orig":"C840083671",
     "old_balance_orig":181.0,    "new_balance_orig":0.0,       "name_dest":"C38997010",
     "old_balance_dest":21182.0,  "new_balance_dest":0.0},
    {"step":2, "type":"PAYMENT",  "amount":11668.14,"name_orig":"C2048537720",
     "old_balance_orig":41554.0,  "new_balance_orig":29885.86,  "name_dest":"M1230701703",
     "old_balance_dest":0.0,      "new_balance_dest":0.0},
    {"step":2, "type":"TRANSFER", "amount":215310.3,"name_orig":"C1670993182",
     "old_balance_orig":705.0,    "new_balance_orig":0.0,       "name_dest":"C1100439041",
     "old_balance_dest":22425.0,  "new_balance_dest":0.0},
]

async def seed():
    async with engine.begin() as conn:
        from app.models import transaction, user  # noqa
        await conn.run_sync(Base.metadata.create_all)

    async with SessionLocal() as db:
        # Admin user
        existing = await get_user(db, "admin")
        if not existing:
            await create_user(db, "admin", "admin@fraudguard.ai", "admin123", is_admin=True)
            print("✅ Admin user created: admin / admin123")
        else:
            print("ℹ️  Admin user already exists")

        # Sample transactions
        print("Seeding sample transactions…")
        tx_types = ["PAYMENT", "TRANSFER", "CASH_OUT", "CASH_IN", "DEBIT"]
        for i, sample in enumerate(SAMPLE_TXS):
            tx = TransactionCreate(**sample)
            await create_transaction(db, tx)
        # Add random ones
        for i in range(20):
            t = random.choice(tx_types)
            amt = round(random.uniform(100, 500000), 2)
            ob  = round(random.uniform(amt, amt * 5), 2)
            nb  = round(ob - amt, 2) if ob >= amt else 0.0
            tx  = TransactionCreate(
                step=random.randint(1, 100), type=t, amount=amt,
                name_orig=f"C{random.randint(1000000, 9999999)}",
                old_balance_orig=ob, new_balance_orig=max(nb, 0),
                name_dest=f"{'M' if t=='PAYMENT' else 'C'}{random.randint(1000000, 9999999)}",
                old_balance_dest=round(random.uniform(0, 100000), 2),
                new_balance_dest=round(random.uniform(0, 100000), 2),
            )
            await create_transaction(db, tx)
        print(f"✅ 25 sample transactions seeded")
    await engine.dispose()
    print("\nDone! You can now log in at http://localhost:3000")

if __name__ == "__main__":
    asyncio.run(seed())
