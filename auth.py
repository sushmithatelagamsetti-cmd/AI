from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from sqlalchemy.ext.asyncio import AsyncSession
from jose import JWTError, jwt
from app.db.database import get_db
from app.schemas.user import UserCreate, UserResponse, Token
from app.services.auth_service import authenticate_user, create_user, create_access_token, get_user
from app.config import settings

router = APIRouter(prefix="/auth", tags=["Auth"])
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login")

@router.post("/register", response_model=UserResponse, status_code=201)
async def register(user: UserCreate, db: AsyncSession = Depends(get_db)):
    existing = await get_user(db, user.username)
    if existing:
        raise HTTPException(status_code=400, detail="Username already exists")
    return await create_user(db, user.username, user.email, user.password)

@router.post("/login", response_model=Token)
async def login(form: OAuth2PasswordRequestForm = Depends(), db: AsyncSession = Depends(get_db)):
    user = await authenticate_user(db, form.username, form.password)
    if not user:
        raise HTTPException(status_code=401, detail="Invalid credentials",
                            headers={"WWW-Authenticate": "Bearer"})
    token = create_access_token({"sub": user.username})
    return {"access_token": token, "token_type": "bearer"}

async def get_current_user(token: str = Depends(oauth2_scheme), db: AsyncSession = Depends(get_db)):
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        username: str = payload.get("sub")
        if not username:
            raise HTTPException(status_code=401, detail="Invalid token")
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid token")
    user = await get_user(db, username)
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return user

@router.get("/me", response_model=UserResponse)
async def me(current_user=Depends(get_current_user)):
    return current_user
