import os

from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.auth.deps import get_current_user
from app.auth.router import router as auth_router

# Import every model module so Base.metadata is fully populated before any
# create_all() / Alembic autogenerate runs.
from app.core import warehouse  # noqa: F401
from app.procurement import models as procurement_models  # noqa: F401
from app.uom import models as uom_models  # noqa: F401
from app.fabric_inventory import models as fabric_models  # noqa: F401
from app.accessory_inventory import models as accessory_models  # noqa: F401
from app.style_variant import models as style_models  # noqa: F401
from app.bom import models as bom_models  # noqa: F401
from app.production import models as production_models  # noqa: F401
from app.finished_goods import models as fg_models  # noqa: F401
from app.orders import models as orders_models  # noqa: F401

from app import wiring
from app.procurement.router import router as procurement_router
from app.uom.router import router as uom_router
from app.fabric_inventory.router import router as fabric_router
from app.accessory_inventory.router import router as accessory_router
from app.style_variant.router import router as style_router
from app.bom.router import router as bom_router
from app.production.router import router as production_router
from app.finished_goods.router import router as finished_goods_router
from app.orders.router import router as orders_router
from app.dashboard.router import router as dashboard_router

app = FastAPI(title="Apparel ERP — Phase 1", version="0.1.0")

_default_origins = "http://localhost:3000,http://localhost:3001"
_origins = os.environ.get("FRONTEND_ORIGINS", _default_origins).split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=_origins,
    allow_methods=["*"],
    allow_headers=["*"],
)

wiring.configure()

app.include_router(auth_router)

_protected = [Depends(get_current_user)]
app.include_router(procurement_router, dependencies=_protected)
app.include_router(uom_router, dependencies=_protected)
app.include_router(fabric_router, dependencies=_protected)
app.include_router(accessory_router, dependencies=_protected)
app.include_router(style_router, dependencies=_protected)
app.include_router(bom_router, dependencies=_protected)
app.include_router(production_router, dependencies=_protected)
app.include_router(finished_goods_router, dependencies=_protected)
app.include_router(orders_router, dependencies=_protected)
app.include_router(dashboard_router, dependencies=_protected)


@app.get("/health")
def health():
    return {"status": "ok"}
