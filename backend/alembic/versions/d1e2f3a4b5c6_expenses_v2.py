"""expenses v2: receipt_url, is_recurring, category budgets, company settings

Revision ID: d1e2f3a4b5c6
Revises: c1a2b3d4e5f6
Create Date: 2026-07-03

"""
from alembic import op
import sqlalchemy as sa

revision = "d1e2f3a4b5c6"
down_revision = "c1a2b3d4e5f6"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("expense", sa.Column("receipt_url", sa.String(), nullable=True))
    op.add_column("expense", sa.Column("is_recurring", sa.Boolean(), nullable=False, server_default=sa.text("0")))

    op.create_table(
        "expense_category_budget",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("category_id", sa.Integer(), sa.ForeignKey("expense_category.id"), unique=True, nullable=False),
        sa.Column("monthly_limit", sa.Numeric(12, 2), nullable=False),
    )

    op.create_table(
        "company_setting",
        sa.Column("key", sa.String(), primary_key=True),
        sa.Column("value", sa.String(), nullable=False),
    )


def downgrade() -> None:
    op.drop_column("expense", "receipt_url")
    op.drop_column("expense", "is_recurring")
    op.drop_table("expense_category_budget")
    op.drop_table("company_setting")
