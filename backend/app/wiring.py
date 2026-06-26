"""Registers cross-module contracts: which model backs each polymorphic
reference_type, per app.core.ref_validator. Import this once at app/test
startup — keeps fabric_inventory etc. from importing production directly."""
from app.core.ref_validator import register_reference_type
from app.production.models import ProductionOrder


def configure() -> None:
    register_reference_type("production_order", ProductionOrder)
