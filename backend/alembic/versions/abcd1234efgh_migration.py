"""migration

Revision ID: abcd1234efgh
Revises: g5h6i7j8k9l0
Create Date: 2026-07-17 09:12:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'abcd1234efgh'
down_revision = 'g5h6i7j8k9l0'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # sales_order.category
    op.add_column('sales_order', sa.Column('category', sa.String(), nullable=True))
    
    # style_variant fields
    op.add_column('style_variant', sa.Column('fabric_item_id', sa.Integer(), nullable=True))
    op.add_column('style_variant', sa.Column('fabric_consumption', sa.Numeric(precision=12, scale=4), nullable=True))
    op.add_column('style_variant', sa.Column('cost_price', sa.Numeric(precision=12, scale=2), nullable=True))
    
    # create foreign key constraint
    op.create_foreign_key('fk_style_variant_fabric_item', 'style_variant', 'fabric_item', ['fabric_item_id'], ['id'])


def downgrade() -> None:
    op.drop_constraint('fk_style_variant_fabric_item', 'style_variant', type_='foreignkey')
    op.drop_column('style_variant', 'cost_price')
    op.drop_column('style_variant', 'fabric_consumption')
    op.drop_column('style_variant', 'fabric_item_id')
    op.drop_column('sales_order', 'category')
