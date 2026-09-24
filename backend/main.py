"""FastAPI application entry point."""
from contextlib import asynccontextmanager
import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from config import settings
from routers.health import router as health_router
from routers.quantum import router as quantum_router

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)-7s  %(name)s  %(message)s",
)
logger = logging.getLogger("main")


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("=== Quantum Molecular Simulator API starting ===")
    logger.info("Demo mode: %s", settings.DEMO_MODE)
    logger.info("IBM Quantum credentials configured: %s", bool(settings.IBM_QUANTUM_API_KEY))
    logger.info(
        "DISCLAIMER: All molecular Hamiltonians are ILLUSTRATIVE. "
        "Not suitable for real chemistry research."
    )
    yield
    logger.info("=== Quantum Molecular Simulator API stopped ===")


app = FastAPI(
    title="Quantum Molecular Simulator API",
    description=(
        "Demo backend for VQE molecular ground-state energy calculations. "
        "All Hamiltonians are illustrative. Built with IBM Qiskit."
    ),
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health_router)
app.include_router(quantum_router)
