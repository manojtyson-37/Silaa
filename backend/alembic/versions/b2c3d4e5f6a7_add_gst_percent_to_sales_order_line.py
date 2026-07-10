"""add gst_percent to sales_order_line

Revision ID: b2c3d4e5f6a7
Revises: a1b2c3d4e5f6
Create Date: 2026-07-10

"""
from alembic import op
import sqlalchemy as sa

revision = 'b2c3d4e5f6a7'
down_revision = 'a1b2c3d4e5f6'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        'sales_order_line',
        sa.Column('gst_percent', sa.Numeric(5, 2), nullable=False, server_default='5'),
    )


def downgrade() -> None:
    op.drop_column('sales_order_line', 'gst_percent')
