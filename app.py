import os
import sqlite3
from contextlib import asynccontextmanager
from fastapi import FastAPI, HTTPException
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from supabase import create_client, Client
from pydantic import BaseModel
import bcrypt
import uvicorn

# Supabase configuration (optional — falls back to SQLite if not set)
URL = os.environ.get("SUPABASE_URL")
KEY = os.environ.get("SUPABASE_KEY")

if not URL or not KEY:
    supabase = None
else:
    supabase = create_client(URL, KEY)

def get_db():
    conn = sqlite3.connect("fruitwar.db")
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    """Create tables if they don't exist (SQLite only)."""
    conn = sqlite3.connect("fruitwar.db")
    conn.execute("""
        CREATE TABLE IF NOT EXISTS users (
            username TEXT PRIMARY KEY,
            hashed_password TEXT NOT NULL,
            coins INTEGER DEFAULT 0,
            stars INTEGER DEFAULT 0,
            classic_level INTEGER DEFAULT 1,
            zen_level INTEGER DEFAULT 1,
            arcade_level INTEGER DEFAULT 1,
            unlocked_themes TEXT DEFAULT 'default'
        )
    """)
    conn.commit()
    conn.close()

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: initialize SQLite tables if not using Supabase
    if not supabase:
        init_db()
    yield

app = FastAPI(lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- Pydantic Models ---

class UserCreate(BaseModel):
    username: str
    password: str

class UserResponse(BaseModel):
    username: str
    coins: int
    stars: int
    classic_level: int
    zen_level: int
    arcade_level: int
    unlocked_themes: str

class ProgressUpdate(BaseModel):
    username: str
    coins_gained: int
    stars_gained: int

class LevelUp(BaseModel):
    username: str
    mode: str
    score: int

class UnlockTheme(BaseModel):
    username: str
    theme_name: str
    currency: str

class ResetProgress(BaseModel):
    username: str

THEME_COSTS = {
    "default": {"type": "coins", "amount": 0},
    "neon": {"type": "coins", "amount": 100},
    "sunset": {"type": "coins", "amount": 150},
    "ocean": {"type": "coins", "amount": 200},
    "sakura": {"type": "coins", "amount": 250},
    "cyberpunk": {"type": "coins", "amount": 300},
    "lava": {"type": "coins", "amount": 350},
    "galaxy": {"type": "coins", "amount": 400},
    "toxic": {"type": "coins", "amount": 450},
    "ice": {"type": "coins", "amount": 500},
    "inferno": {"type": "stars", "amount": 1},
    "jungle": {"type": "stars", "amount": 1},
    "storm": {"type": "stars", "amount": 1},
    "gold": {"type": "stars", "amount": 1},
    "midnight": {"type": "stars", "amount": 1},
    "candy": {"type": "stars", "amount": 1},
    "deepsea": {"type": "stars", "amount": 1},
    "desert": {"type": "stars", "amount": 2},
    "matrix": {"type": "stars", "amount": 2},
    "zen": {"type": "stars", "amount": 2},
    "steampunk": {"type": "stars", "amount": 2},
    "rainbow": {"type": "stars", "amount": 2},
    "void": {"type": "stars", "amount": 2},
    "emerald": {"type": "stars", "amount": 2},
    "solar": {"type": "stars", "amount": 2},
}

# --- API Routes (mounted under /api) ---

api = FastAPI()

@api.post("/register")
async def register(user: UserCreate):
    hashed = bcrypt.hashpw(user.password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
    data = {
        "username": user.username,
        "hashed_password": hashed,
        "coins": 0,
        "stars": 0,
        "classic_level": 1,
        "zen_level": 1,
        "arcade_level": 1,
        "unlocked_themes": "default"
    }

    if supabase:
        existing = supabase.table("users").select("*").eq("username", user.username).execute()
        if existing.data:
            raise HTTPException(status_code=400, detail="Username already registered")
        supabase.table("users").insert(data).execute()
    else:
        with get_db() as db:
            existing = db.execute("SELECT * FROM users WHERE username = ?", (user.username,)).fetchone()
            if existing:
                raise HTTPException(status_code=400, detail="Username already registered")
            db.execute("""INSERT INTO users (username, hashed_password, coins, stars, classic_level, zen_level, arcade_level, unlocked_themes) 
                          VALUES (?, ?, ?, ?, ?, ?, ?, ?)""", 
                       (user.username, hashed, 0, 0, 1, 1, 1, "default"))
            db.commit()
    return {"message": "User created successfully"}

@api.post("/login", response_model=UserResponse)
async def login(user: UserCreate):
    if supabase:
        res = supabase.table("users").select("*").eq("username", user.username).execute()
        db_user = res.data[0] if res.data else None
    else:
        with get_db() as db:
            row = db.execute("SELECT * FROM users WHERE username = ?", (user.username,)).fetchone()
            db_user = dict(row) if row else None

    if not db_user:
        raise HTTPException(status_code=400, detail="Incorrect username or password")
    
    if not bcrypt.checkpw(user.password.encode('utf-8'), db_user['hashed_password'].encode('utf-8')):
        raise HTTPException(status_code=400, detail="Incorrect username or password")
    
    return db_user

@api.post("/update_progress", response_model=UserResponse)
async def update_progress(progress: ProgressUpdate):
    if supabase:
        res = supabase.table("users").select("*").eq("username", progress.username).execute()
        if not res.data: raise HTTPException(status_code=404, detail="User not found")
        user = res.data[0]
        new_coins = user['coins'] + progress.coins_gained
        new_stars = user['stars'] + progress.stars_gained
        updated = supabase.table("users").update({"coins": new_coins, "stars": new_stars}).eq("username", progress.username).execute()
        return updated.data[0]
    else:
        with get_db() as db:
            row = db.execute("SELECT * FROM users WHERE username = ?", (progress.username,)).fetchone()
            if not row: raise HTTPException(status_code=404, detail="User not found")
            user = dict(row)
            new_coins = user['coins'] + progress.coins_gained
            new_stars = user['stars'] + progress.stars_gained
            db.execute("UPDATE users SET coins = ?, stars = ? WHERE username = ?", (new_coins, new_stars, progress.username))
            db.commit()
            return dict(db.execute("SELECT * FROM users WHERE username = ?", (progress.username,)).fetchone())

@api.post("/level_up", response_model=UserResponse)
async def level_up(data: LevelUp):
    level_field = f"{data.mode}_level"
    
    if supabase:
        res = supabase.table("users").select("*").eq("username", data.username).execute()
        if not res.data: raise HTTPException(status_code=404, detail="User not found")
        user = res.data[0]
        current_level = user.get(level_field, 1)
        threshold = current_level * 50
        if data.score >= threshold:
            updated = supabase.table("users").update({level_field: current_level + 1}).eq("username", data.username).execute()
            return updated.data[0]
        return user
    else:
        with get_db() as db:
            row = db.execute("SELECT * FROM users WHERE username = ?", (data.username,)).fetchone()
            if not row: raise HTTPException(status_code=404, detail="User not found")
            user = dict(row)
            current_level = user.get(level_field, 1)
            threshold = current_level * 50
            if data.score >= threshold:
                db.execute(f"UPDATE users SET {level_field} = ? WHERE username = ?", (current_level + 1, data.username))
                db.commit()
                return dict(db.execute("SELECT * FROM users WHERE username = ?", (data.username,)).fetchone())
            return user

@api.post("/unlock_theme", response_model=UserResponse)
async def unlock_theme(data: UnlockTheme):
    if supabase:
        res = supabase.table("users").select("*").eq("username", data.username).execute()
        if not res.data: raise HTTPException(status_code=404, detail="User not found")
        user = res.data[0]
    else:
        with get_db() as db:
            row = db.execute("SELECT * FROM users WHERE username = ?", (data.username,)).fetchone()
            if not row: raise HTTPException(status_code=404, detail="User not found")
            user = dict(row)

    owned = user['unlocked_themes'].split(",")
    if data.theme_name in owned: return user
    
    cost_info = THEME_COSTS.get(data.theme_name, {"type": "coins", "amount": 0})
    currency_type = cost_info["type"]
    cost_amount = cost_info["amount"]
    current_balance = user.get(currency_type, 0)
    
    if current_balance < cost_amount:
        raise HTTPException(status_code=400, detail=f"Not enough {currency_type}. Need {cost_amount}, have {current_balance}")
    
    new_balance = current_balance - cost_amount
    new_themes = user['unlocked_themes'] + "," + data.theme_name
    
    if supabase:
        updated = supabase.table("users").update({
            currency_type: new_balance,
            "unlocked_themes": new_themes
        }).eq("username", data.username).execute()
        return updated.data[0]
    else:
        with get_db() as db:
            db.execute(f"UPDATE users SET {currency_type} = ?, unlocked_themes = ? WHERE username = ?", 
                       (new_balance, new_themes, data.username))
            db.commit()
            return dict(db.execute("SELECT * FROM users WHERE username = ?", (data.username,)).fetchone())

@api.post("/reset_progress", response_model=UserResponse)
async def reset_progress(data: ResetProgress):
    if supabase:
        updated = supabase.table("users").update({
            "coins": 0, "stars": 0, "classic_level": 1,
            "zen_level": 1, "arcade_level": 1, "unlocked_themes": "default"
        }).eq("username", data.username).execute()
        return updated.data[0]
    else:
        with get_db() as db:
            db.execute("""UPDATE users SET coins=0, stars=0, classic_level=1, 
                          zen_level=1, arcade_level=1, unlocked_themes='default' 
                          WHERE username = ?""", (data.username,))
            db.commit()
            return dict(db.execute("SELECT * FROM users WHERE username = ?", (data.username,)).fetchone())

# Mount the API sub-application and static files
app.mount("/api", api)
app.mount("/", StaticFiles(directory="frontend", html=True), name="frontend")

if __name__ == "__main__":
    uvicorn.run("app:app", host="0.0.0.0", port=int(os.environ.get("PORT", 8888)))
