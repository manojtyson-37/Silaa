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
    with op.batch_alter_table('style_variant') as batch_op:
        batch_op.create_foreign_key('fk_style_variant_fabric_item', 'fabric_item', ['fabric_item_id'], ['id'])

def downgrade() -> None:
    with op.batch_alter_table('style_variant') as batch_op:
        batch_op.drop_constraint('fk_style_variant_fabric_item', type_='foreignkey')
        batch_op.drop_column('cost_price')
        batch_op.drop_column('fabric_consumption')
        batch_op.drop_column('fabric_item_id')
    with op.batch_alter_table('sales_order') as batch_op:
        batch_op.drop_column('category')
