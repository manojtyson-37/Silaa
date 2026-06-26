from fastapi import FastAPI

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

app = FastAPI(title="Apparel ERP — Phase 1", version="0.1.0")


@app.get("/health")
def health():
    return {"status": "ok"}
