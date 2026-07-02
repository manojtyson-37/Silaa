"""add icon to expense_category

Revision ID: c1a2b3d4e5f6
Revises: afaa38bf4300
Create Date: 2026-07-02

"""
from alembic import op
import sqlalchemy as sa

revision = "c1a2b3d4e5f6"
down_revision = "afaa38bf4300"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("expense_category", sa.Column("icon", sa.String(), nullable=True))


def downgrade() -> None:
    op.drop_column("expense_category", "icon")
