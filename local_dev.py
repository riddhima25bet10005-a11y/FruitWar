import sys
import os
from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
import uvicorn

sys.path.append(os.path.join(os.path.dirname(__file__), 'netlify', 'functions'))
from api import app as api_app

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=['*'],
    allow_methods=['*'],
    allow_headers=['*'],
)

app.mount('/api', api_app)
app.mount('/', StaticFiles(directory='frontend', html=True), name='frontend')

if __name__ == '__main__':
    uvicorn.run('local_dev:app', host='127.0.0.1', port=8888, reload=True)
