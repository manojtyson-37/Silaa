"""add qty to style_variant

Revision ID: e2f3a4b5c6d7
Revises: d1e2f3a4b5c6
Create Date: 2026-07-03

"""
from alembic import op
import sqlalchemy as sa

revision = 'e2f3a4b5c6d7'
down_revision = 'd1e2f3a4b5c6'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('style_variant', sa.Column('qty', sa.Integer(), nullable=False, server_default='0'))


def downgrade() -> None:
    op.drop_column('style_variant', 'qty')
