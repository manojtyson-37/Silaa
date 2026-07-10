"""add customer_phone/customer_address to sales_order

Revision ID: a1b2c3d4e5f6
Revises: 206ef6fe6a0f
Create Date: 2026-07-10

"""
from alembic import op
import sqlalchemy as sa

revision = 'a1b2c3d4e5f6'
down_revision = '206ef6fe6a0f'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('sales_order', sa.Column('customer_phone', sa.String(), nullable=True))
    op.add_column('sales_order', sa.Column('customer_address', sa.String(), nullable=True))


def downgrade() -> None:
    op.drop_column('sales_order', 'customer_address')
    op.drop_column('sales_order', 'customer_phone')
