"""
Stampy rules service: SNAP benefit from PolicyEngine-US (open source), run locally.

POST /snap  {"state":"CA","householdSize":3,"month":"2026-11","earnedIncomeMonthly":2666,"rentMonthly":950}
         -> {"snap":233.0,"eligible":true,"netIncome":1916.0,"grossIncome":2666.0,"maxAllotment":808.0,"version":"2.124.5","ms":180}
GET  /health -> {"ok":true,"version":"2.124.5"}

Only the income the application reports is counted: take-up of TANF (cash aid) is switched off so the
model does not impute benefits nobody applied for. Ages are not on the form; the first member is an adult
of 30 and the rest are children of 10, which does not change SNAP rules for this household (no one over 60).
Stdlib HTTP server, no extra dependencies. Port: POLICYENGINE_PORT (default 8790).
"""
from __future__ import annotations

import importlib.metadata
import json
import os
import sys
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from threading import Lock

from policyengine_us import Simulation

VERSION = importlib.metadata.version("policyengine-us")
LOCK = Lock()  # Simulation is not thread-safe; requests are tiny, so serialize them.


def situation(state: str, size: int, year: int, earned_monthly: float, rent_monthly: float) -> dict:
    people = {"head": {"age": {year: 30}, "employment_income": {year: earned_monthly * 12}, "rent": {year: rent_monthly * 12}}}
    for i in range(1, max(1, size)):
        people[f"member{i}"] = {"age": {year: 10}}
    members = list(people)
    return {
        "people": people,
        "families": {"family": {"members": members}},
        "marital_units": {"marital_unit": {"members": ["head"]}},
        "tax_units": {"tax_unit": {"members": members}},
        "spm_units": {"spm_unit": {"members": members, "takes_up_tanf_if_eligible": {year: False}}},
        "households": {"household": {"members": members, "state_name": {year: state}}},
    }


def snap(body: dict) -> dict:
    state = str(body.get("state", "CA"))[:2].upper()
    size = int(body.get("householdSize", 1))
    month = str(body.get("month", time.strftime("%Y-%m")))
    year = int(month[:4])
    t = time.time()
    with LOCK:
        sim = Simulation(situation=situation(state, size, year, float(body.get("earnedIncomeMonthly", 0)), float(body.get("rentMonthly", 0))))
        calc = lambda v: float(sim.calculate(v, month).sum())  # noqa: E731
        out = {
            "snap": calc("snap"),
            "eligible": bool(calc("is_snap_eligible")),
            "netIncome": calc("snap_net_income"),
            "grossIncome": calc("snap_gross_income"),
            "maxAllotment": calc("snap_max_allotment"),
        }
    out.update({"version": VERSION, "ms": int((time.time() - t) * 1000)})
    return out


class Handler(BaseHTTPRequestHandler):
    def _send(self, code: int, payload: dict) -> None:
        data = json.dumps(payload).encode()
        self.send_response(code)
        self.send_header("content-type", "application/json")
        self.send_header("content-length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def do_GET(self) -> None:  # noqa: N802
        if self.path == "/health":
            return self._send(200, {"ok": True, "version": VERSION})
        self._send(404, {"error": "not found"})

    def do_POST(self) -> None:  # noqa: N802
        if self.path != "/snap":
            return self._send(404, {"error": "not found"})
        try:
            body = json.loads(self.rfile.read(int(self.headers.get("content-length", 0))) or b"{}")
            self._send(200, snap(body))
        except Exception as e:  # report, never crash the server
            self._send(400, {"error": str(e)[:300]})

    def log_message(self, fmt: str, *args) -> None:
        sys.stderr.write("[policyengine] " + (fmt % args) + "\n")


if __name__ == "__main__":
    port = int(os.environ.get("POLICYENGINE_PORT", "8790"))
    t = time.time()
    snap({"state": "CA", "householdSize": 1, "month": "2026-11", "earnedIncomeMonthly": 1000, "rentMonthly": 500})  # warm up
    print(f"[policyengine] policyengine-us {VERSION} ready in {time.time() - t:.1f}s on http://127.0.0.1:{port}", flush=True)
    ThreadingHTTPServer(("127.0.0.1", port), Handler).serve_forever()
