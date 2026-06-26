"""Generic existence check for the polymorphic reference_type/reference_id
pattern used across ledgers (PHASE1_ARCHITECTURE_REVISION_1.md Change 8).

No DB-level FK across ref types since the target table varies — this is the
documented mitigation: validate at write time, plus an orphan-detector query
as a periodic safety net.
"""
from sqlalchemy.orm import Session

_REF_REGISTRY: dict[str, type] = {}


def register_reference_type(ref_type: str, model: type) -> None:
    _REF_REGISTRY[ref_type] = model


class UnknownReferenceError(Exception):
    pass


def validate_reference(session: Session, reference_type: str, reference_id: int) -> None:
    if reference_type is None:
        return
    model = _REF_REGISTRY.get(reference_type)
    if model is None:
        raise UnknownReferenceError(f"No model registered for reference_type={reference_type!r}")
    if session.get(model, reference_id) is None:
        raise UnknownReferenceError(f"{reference_type} id={reference_id} does not exist")


def find_orphaned_references(session: Session, ledger_model: type) -> list:
    """Periodic safety-net report: ledger rows whose reference_id no longer
    resolves. Should never find anything if validate_reference is called on
    every write — exists to catch drift (e.g. a row inserted by a future bug
    that bypasses the validator)."""
    orphans = []
    for row in session.query(ledger_model).filter(ledger_model.reference_type.isnot(None)).all():
        model = _REF_REGISTRY.get(row.reference_type)
        if model is None or session.get(model, row.reference_id) is None:
            orphans.append(row)
    return orphans
