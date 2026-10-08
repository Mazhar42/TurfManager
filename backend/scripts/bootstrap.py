"""Set up a fresh production database: the real venue, its owner account and its fields.

No demo customers or bookings. Opening hours and fields come from the arguments; pricing
rules and staff accounts are added afterwards by the owner in Settings.

Run on the server:

    docker compose exec backend python -m scripts.bootstrap \\
        --venue-name "Green Field Turf" --owner-name "Rafiq" --owner-phone 01712345678 \\
        --fields "Field A" "Field B" --opens 06:00 --closes 23:00

The owner password is asked for interactively (or read from OWNER_PASSWORD), so it never
ends up in shell history.
"""
import argparse
import getpass
import os
import re
import sys
from datetime import time

from app.core.security import hash_password
from app.db.session import SessionLocal
from app.models.enums import UserRole
from app.models.field import Field
from app.models.user import User
from app.models.venue import Venue


def _parse_time(value: str) -> time:
    try:
        hours, minutes = value.split(":")
        return time(int(hours), int(minutes))
    except ValueError as exc:
        raise argparse.ArgumentTypeError(f"expected HH:MM, got {value!r}") from exc


def _slugify(name: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-") or "venue"


def _read_password() -> str:
    password = os.environ.get("OWNER_PASSWORD")
    if not password:
        password = getpass.getpass("Owner password (min 8 characters): ")
        if password != getpass.getpass("Repeat password: "):
            sys.exit("Passwords did not match.")
    if len(password) < 8:
        sys.exit("Password must be at least 8 characters.")
    return password


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--venue-name", required=True)
    parser.add_argument("--owner-name", required=True)
    parser.add_argument("--owner-phone", required=True)
    parser.add_argument("--fields", nargs="+", default=["Field A"], help="One or more field names")
    parser.add_argument("--opens", type=_parse_time, default=time(6, 0))
    parser.add_argument("--closes", type=_parse_time, default=time(23, 0))
    parser.add_argument("--slot-minutes", type=int, default=60)
    parser.add_argument("--timezone", default="Asia/Dhaka")
    parser.add_argument("--address", default=None)
    args = parser.parse_args()

    if args.opens >= args.closes:
        sys.exit("--opens must be earlier than --closes.")

    db = SessionLocal()
    try:
        if db.query(Venue).count():
            sys.exit("This database already has a venue — bootstrap only runs once, on an empty database.")

        password = _read_password()

        venue = Venue(
            name=args.venue_name,
            slug=_slugify(args.venue_name),
            timezone=args.timezone,
            address=args.address,
            phone=args.owner_phone,
            opens_at=args.opens,
            closes_at=args.closes,
            slot_minutes=args.slot_minutes,
        )
        db.add(venue)
        db.flush()

        for order, name in enumerate(args.fields):
            db.add(Field(venue_id=venue.id, name=name, sport="football", sort_order=order))

        db.add(
            User(
                venue_id=venue.id,
                name=args.owner_name,
                phone=args.owner_phone,
                password_hash=hash_password(password),
                role=UserRole.owner,
            )
        )
        db.commit()
    finally:
        db.close()

    print(f"Created venue '{args.venue_name}' with {len(args.fields)} field(s).")
    print(f"Owner can now log in with {args.owner_phone}. Next: add pricing rules and staff in Settings.")


if __name__ == "__main__":
    main()
