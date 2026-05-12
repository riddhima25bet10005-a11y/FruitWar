import os
from fastapi import FastAPI, HTTPException, Depends
from mangum import Mangum
from supabase import create_client, Client
from pydantic import BaseModel
import bcrypt
from typing import List

app = FastAPI()

# Supabase configuration
URL = os.environ.get("SUPABASE_URL")
KEY = os.environ.get("SUPABASE_KEY")

if not URL or not KEY:
    # Fallback for local testing or initial setup
    supabase = None
else:
    supabase = create_client(URL, KEY)

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

@app.post("/register")
async def register(user: UserCreate):
    if not supabase: return {"message": "Supabase not configured"}
    
    # Check if user exists
    existing = supabase.table("users").select("*").eq("username", user.username).execute()
    if existing.data:
        raise HTTPException(status_code=400, detail="Username already registered")
    
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
    
    supabase.table("users").insert(data).execute()
    return {"message": "User created successfully"}

@app.post("/login", response_model=UserResponse)
async def login(user: UserCreate):
    if not supabase: raise HTTPException(status_code=500, detail="Database not configured")
    
    res = supabase.table("users").select("*").eq("username", user.username).execute()
    if not res.data:
        raise HTTPException(status_code=400, detail="Incorrect username or password")
    
    db_user = res.data[0]
    if not bcrypt.checkpw(user.password.encode('utf-8'), db_user['hashed_password'].encode('utf-8')):
        raise HTTPException(status_code=400, detail="Incorrect username or password")
    
    return db_user

@app.post("/update_progress", response_model=UserResponse)
async def update_progress(progress: ProgressUpdate):
    res = supabase.table("users").select("*").eq("username", progress.username).execute()
    if not res.data: raise HTTPException(status_code=404, detail="User not found")
    
    user = res.data[0]
    new_coins = user['coins'] + progress.coins_gained
    new_stars = user['stars'] + progress.stars_gained
    
    updated = supabase.table("users").update({
        "coins": new_coins,
        "stars": new_stars
    }).eq("username", progress.username).execute()
    
    return updated.data[0]

@app.post("/level_up", response_model=UserResponse)
async def level_up(data: LevelUp):
    res = supabase.table("users").select("*").eq("username", data.username).execute()
    if not res.data: raise HTTPException(status_code=404, detail="User not found")
    
    user = res.data[0]
    level_field = f"{data.mode}_level"
    current_level = user.get(level_field, 1)
    threshold = current_level * 50
    
    if data.score >= threshold:
        updated = supabase.table("users").update({
            level_field: current_level + 1
        }).eq("username", data.username).execute()
        return updated.data[0]
    
    return user

@app.post("/unlock_theme", response_model=UserResponse)
async def unlock_theme(data: UnlockTheme):
    res = supabase.table("users").select("*").eq("username", data.username).execute()
    if not res.data: raise HTTPException(status_code=404, detail="User not found")
    
    user = res.data[0]
    owned = user['unlocked_themes'].split(",")
    if data.theme_name in owned: return user
    
    # Costs are validated server-side
    cost_info = THEME_COSTS.get(data.theme_name, {"type": "coins", "amount": 0})
    currency_type = cost_info["type"]
    cost_amount = cost_info["amount"]
    
    current_balance = user.get(currency_type, 0)
    
    if current_balance < cost_amount:
        raise HTTPException(
            status_code=400, 
            detail=f"Not enough {currency_type}. Need {cost_amount}, have {current_balance}"
        )
    
    # Deduct currency and add theme
    new_balance = current_balance - cost_amount
    new_themes = user['unlocked_themes'] + "," + data.theme_name
    
    updated = supabase.table("users").update({
        currency_type: new_balance,
        "unlocked_themes": new_themes
    }).eq("username", data.username).execute()
    
    return updated.data[0]

@app.post("/reset_progress", response_model=UserResponse)
async def reset_progress(data: ResetProgress):
    updated = supabase.table("users").update({
        "coins": 0,
        "stars": 0,
        "classic_level": 1,
        "zen_level": 1,
        "arcade_level": 1,
        "unlocked_themes": "default"
    }).eq("username", data.username).execute()
    
    return updated.data[0]

handler = Mangum(app)
