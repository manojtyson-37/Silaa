"""add style_variant_combo and style_variant_combo_item tables

Revision ID: a2b3c4d5e6f7
Revises: 0455c870be67
Create Date: 2026-08-19
"""
from alembic import op
import sqlalchemy as sa

revision = 'a2b3c4d5e6f7'
down_revision = '0455c870be67'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        'style_variant_combo',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('name', sa.String(), nullable=False),
        sa.Column('description', sa.String(), nullable=True),
        sa.Column('selling_price', sa.Numeric(12, 2), nullable=False),
        sa.Column('image_url', sa.String(), nullable=True),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default='true'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_table(
        'style_variant_combo_item',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('combo_id', sa.Integer(), nullable=False),
        sa.Column('variant_id', sa.Integer(), nullable=False),
        sa.Column('qty', sa.Integer(), nullable=False, server_default='1'),
        sa.ForeignKeyConstraint(['combo_id'], ['style_variant_combo.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['variant_id'], ['style_variant.id']),
        sa.PrimaryKeyConstraint('id'),
    )


def downgrade() -> None:
    op.drop_table('style_variant_combo_item')
    op.drop_table('style_variant_combo')
