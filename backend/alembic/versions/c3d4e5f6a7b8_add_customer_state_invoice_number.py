"""add customer_state, invoice_number to sales_order

Revision ID: c3d4e5f6a7b8
Revises: b2c3d4e5f6a7
Create Date: 2026-07-11

"""
from alembic import op
import sqlalchemy as sa

revision = 'c3d4e5f6a7b8'
down_revision = 'b2c3d4e5f6a7'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('sales_order', sa.Column('customer_state', sa.String(), nullable=True))
    op.add_column('sales_order', sa.Column('invoice_number', sa.String(), nullable=True))
    with op.batch_alter_table('sales_order') as batch_op:
        batch_op.create_unique_constraint('uq_sales_order_invoice_number', ['invoice_number'])


def downgrade() -> None:
    with op.batch_alter_table('sales_order') as batch_op:
        batch_op.drop_constraint('uq_sales_order_invoice_number', type_='unique')
    op.drop_column('sales_order', 'invoice_number')
    op.drop_column('sales_order', 'customer_state')
