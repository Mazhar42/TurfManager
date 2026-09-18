"""baseline schema — venues, fields, users, customers, pricing, bookings, payments,
blocked slots, booking events. Includes the btree_gist extension and the GiST exclusion
constraints that make double-booking structurally impossible at the database level.

Revision ID: 0001_baseline
Revises:
Create Date: 2026-09-18
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0001_baseline"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("CREATE EXTENSION IF NOT EXISTS pgcrypto")  # gen_random_uuid()
    op.execute("CREATE EXTENSION IF NOT EXISTS btree_gist")  # scalar = with range && in EXCLUDE

    # Each ENUM is used as a column type in exactly one create_table call below, which
    # emits its own `CREATE TYPE` — so we only declare them here, we don't create them.
    user_role = postgresql.ENUM("owner", "staff", name="user_role", create_type=False)
    booking_status = postgresql.ENUM("pending", "confirmed", "completed", "cancelled", "no_show", name="booking_status", create_type=False)
    booking_source = postgresql.ENUM("staff", "online", name="booking_source", create_type=False)
    payment_method = postgresql.ENUM("cash", "bkash", "nagad", "card", "bank", name="payment_method", create_type=False)
    payment_direction = postgresql.ENUM("payment", "refund", name="payment_direction", create_type=False)
    for enum in (user_role, booking_status, booking_source, payment_method, payment_direction):
        enum.create(op.get_bind(), checkfirst=True)

    op.create_table(
        "venues",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("name", sa.String(120), nullable=False),
        sa.Column("slug", sa.String(120), nullable=False, unique=True),
        sa.Column("timezone", sa.String(64), nullable=False, server_default="Asia/Dhaka"),
        sa.Column("currency", sa.String(8), nullable=False, server_default="BDT"),
        sa.Column("address", sa.String(255)),
        sa.Column("maps_url", sa.String(500)),
        sa.Column("phone", sa.String(32)),
        sa.Column("opens_at", sa.Time, nullable=False, server_default="06:00:00"),
        sa.Column("closes_at", sa.Time, nullable=False, server_default="23:00:00"),
        sa.Column("slot_minutes", sa.Integer, nullable=False, server_default="60"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
    )

    op.create_table(
        "fields",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("venue_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("venues.id", ondelete="CASCADE"), nullable=False),
        sa.Column("name", sa.String(80), nullable=False),
        sa.Column("sport", sa.String(40), nullable=False, server_default="football"),
        sa.Column("is_active", sa.Boolean, nullable=False, server_default=sa.true()),
        sa.Column("sort_order", sa.Integer, nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
    )

    op.create_table(
        "users",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("venue_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("venues.id", ondelete="CASCADE"), nullable=False),
        sa.Column("name", sa.String(120), nullable=False),
        sa.Column("phone", sa.String(32), nullable=False, unique=True),
        sa.Column("password_hash", sa.String(255), nullable=False),
        sa.Column("role", user_role, nullable=False, server_default="staff"),
        sa.Column("is_active", sa.Boolean, nullable=False, server_default=sa.true()),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
    )

    op.create_table(
        "refresh_tokens",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("token_hash", sa.String(64), nullable=False, unique=True),
        sa.Column("device_label", sa.String(120)),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("revoked_at", sa.DateTime(timezone=True)),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
    )

    op.create_table(
        "customers",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("venue_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("venues.id", ondelete="CASCADE"), nullable=False),
        sa.Column("name", sa.String(120), nullable=False),
        sa.Column("phone", sa.String(32), nullable=False),
        sa.Column("team_name", sa.String(120)),
        sa.Column("notes", sa.Text),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
        sa.UniqueConstraint("venue_id", "phone", name="uq_customer_venue_phone"),
    )

    op.create_table(
        "pricing_rules",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("venue_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("venues.id", ondelete="CASCADE"), nullable=False),
        sa.Column("field_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("fields.id", ondelete="CASCADE")),
        sa.Column("label", sa.String(80), nullable=False),
        sa.Column("days", postgresql.ARRAY(sa.SmallInteger), nullable=False),
        sa.Column("start_time", sa.Time, nullable=False),
        sa.Column("end_time", sa.Time, nullable=False),
        sa.Column("price", sa.Numeric(12, 2), nullable=False),
        sa.Column("priority", sa.Integer, nullable=False, server_default="0"),
        sa.Column("is_active", sa.Boolean, nullable=False, server_default=sa.true()),
        sa.Column("valid_from", sa.Date),
        sa.Column("valid_to", sa.Date),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
    )

    op.create_table(
        "bookings",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("venue_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("venues.id", ondelete="CASCADE"), nullable=False),
        sa.Column("field_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("fields.id", ondelete="CASCADE"), nullable=False),
        sa.Column("customer_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("customers.id"), nullable=False),
        sa.Column("starts_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("ends_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("status", booking_status, nullable=False, server_default="confirmed"),
        sa.Column("source", booking_source, nullable=False, server_default="staff"),
        sa.Column("price_amount", sa.Numeric(12, 2), nullable=False),
        sa.Column("notes", sa.Text),
        sa.Column("created_by", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id")),
        sa.Column("idempotency_key", sa.String(64), unique=True),
        sa.Column("cancelled_at", sa.DateTime(timezone=True)),
        sa.Column("cancel_reason", sa.String(255)),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
    )
    # Generated range column + GiST exclusion constraint: the actual double-booking guard.
    op.execute(
        "ALTER TABLE bookings ADD COLUMN slot tstzrange "
        "GENERATED ALWAYS AS (tstzrange(starts_at, ends_at, '[)')) STORED"
    )
    op.execute(
        "ALTER TABLE bookings ADD CONSTRAINT bookings_no_overlap "
        "EXCLUDE USING gist (field_id WITH =, slot WITH &&) "
        "WHERE (status IN ('pending', 'confirmed', 'completed'))"
    )
    op.create_index("ix_bookings_venue_starts", "bookings", ["venue_id", "starts_at"])
    op.create_index("ix_bookings_field_starts", "bookings", ["field_id", "starts_at"])
    op.create_index("ix_bookings_customer", "bookings", ["customer_id"])

    op.create_table(
        "payments",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("booking_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("bookings.id", ondelete="CASCADE"), nullable=False),
        sa.Column("amount", sa.Numeric(12, 2), nullable=False),
        sa.Column("method", payment_method, nullable=False),
        sa.Column("direction", payment_direction, nullable=False, server_default="payment"),
        sa.Column("reference", sa.String(120)),
        sa.Column("received_by", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id")),
        sa.Column("received_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
        sa.Column("note", sa.String(255)),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
    )
    op.create_index("ix_payments_booking", "payments", ["booking_id"])

    op.create_table(
        "blocked_slots",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("venue_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("venues.id", ondelete="CASCADE"), nullable=False),
        sa.Column("field_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("fields.id", ondelete="CASCADE"), nullable=False),
        sa.Column("starts_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("ends_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("reason", sa.String(255)),
        sa.Column("created_by", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id")),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
    )
    op.execute(
        "ALTER TABLE blocked_slots ADD COLUMN slot tstzrange "
        "GENERATED ALWAYS AS (tstzrange(starts_at, ends_at, '[)')) STORED"
    )
    op.execute(
        "ALTER TABLE blocked_slots ADD CONSTRAINT blocked_slots_no_overlap "
        "EXCLUDE USING gist (field_id WITH =, slot WITH &&)"
    )

    op.create_table(
        "booking_events",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("booking_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("bookings.id", ondelete="CASCADE"), nullable=False),
        sa.Column("actor_user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id")),
        sa.Column("event_type", sa.String(40), nullable=False),
        sa.Column("from_status", sa.String(20)),
        sa.Column("to_status", sa.String(20)),
        sa.Column("payload", postgresql.JSONB, nullable=False, server_default="{}"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
    )
    op.create_index("ix_booking_events_booking", "booking_events", ["booking_id"])


def downgrade() -> None:
    op.drop_table("booking_events")
    op.drop_table("blocked_slots")
    op.drop_table("payments")
    op.drop_table("bookings")
    op.drop_table("pricing_rules")
    op.drop_table("customers")
    op.drop_table("refresh_tokens")
    op.drop_table("users")
    op.drop_table("fields")
    op.drop_table("venues")

    bind = op.get_bind()
    for name in ("payment_direction", "payment_method", "booking_source", "booking_status", "user_role"):
        postgresql.ENUM(name=name).drop(bind, checkfirst=True)
