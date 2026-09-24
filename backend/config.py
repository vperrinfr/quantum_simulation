"""Config — reads from environment / .env file."""
from pydantic_settings import BaseSettings, SettingsConfigDict
from typing import Optional


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # Legacy / convenience alias kept for backward compat
    DEMO_MODE: str = "local-ideal"  # local-ideal | local-noisy | cloud-qpu

    # New vars requested by operator
    QUANTUM_MODE: str = "local"          # local | cloud
    EXECUTION_TARGET: str = "local-ideal"  # local-ideal | local-noisy | cloud-qpu
    ALLOW_PAID_QPU: bool = False
    DEFAULT_SHOTS: int = 4096

    IBM_QUANTUM_API_KEY: Optional[str] = None
    IBM_QUANTUM_INSTANCE: Optional[str] = None
    IBM_QUANTUM_CHANNEL: str = "ibm_quantum_platform"

    CORS_ORIGINS: list[str] = [
        "http://localhost:3000",
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://127.0.0.1:3000",
    ]

    @property
    def effective_mode(self) -> str:
        """
        Resolve the effective VQE execution mode.
        EXECUTION_TARGET takes precedence over DEMO_MODE.
        If QUANTUM_MODE=local, cloud-qpu is blocked unless ALLOW_PAID_QPU=true.
        """
        target = self.EXECUTION_TARGET or self.DEMO_MODE
        if target == "cloud-qpu" and self.QUANTUM_MODE == "local" and not self.ALLOW_PAID_QPU:
            return "local-ideal"   # safe fallback — no surprise charges
        return target


settings = Settings()
