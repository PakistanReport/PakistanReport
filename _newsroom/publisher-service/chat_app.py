"""Serve the existing upload service alongside the regular Chat publishing action."""
from chat_action import router
from server import app

app.include_router(router)
