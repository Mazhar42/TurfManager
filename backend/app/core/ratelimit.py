"""Failed-login throttling.

In-process and in-memory on purpose: this is one venue's internal tool on one VPS, and the
goal is to make password guessing against a staff phone number impractical, not to be a
distributed rate limiter. Each uvicorn worker keeps its own counts, so the effective limit
is `login_max_failures × workers` — still far too few attempts to guess a password.
"""
import threading
import time
from collections import defaultdict, deque


class FailureLimiter:
    def __init__(self, max_failures: int, window_seconds: int):
        self.max_failures = max_failures
        self.window_seconds = window_seconds
        self._failures: dict[str, deque[float]] = defaultdict(deque)
        self._lock = threading.Lock()

    def _prune(self, key: str, now: float) -> deque[float]:
        q = self._failures[key]
        while q and q[0] <= now - self.window_seconds:
            q.popleft()
        if not q:
            self._failures.pop(key, None)
        return q

    def retry_after(self, *keys: str) -> int:
        """Seconds until the caller may try again, or 0 if not currently blocked."""
        now = time.monotonic()
        with self._lock:
            waits = []
            for key in keys:
                q = self._prune(key, now)
                if len(q) >= self.max_failures:
                    waits.append(int(q[0] + self.window_seconds - now) + 1)
            return max(waits, default=0)

    def record_failure(self, *keys: str) -> None:
        now = time.monotonic()
        with self._lock:
            for key in keys:
                self._failures[key].append(now)

    def reset(self, *keys: str) -> None:
        with self._lock:
            for key in keys:
                self._failures.pop(key, None)
