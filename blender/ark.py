"""
The Ark of the Covenant, Exodus 25:10–22 / 37:1–9, step by step.

    npm run build:models -- ark

Step ids match ARK_STEPS in `src/data/builds/ark.ts`. The last step (the
glory between the cherubim) is light, and stays in the app.
"""

import os
import sys

sys.path.insert(0, os.path.dirname(__file__))

import furniture as fu  # noqa: E402
from vb import Step, export, out_path, reset  # noqa: E402

reset()
O = (0.0, 0.0, 0.0)

s = Step("chest")
p = s.part("chest", hero=True, tally="acacia")
fu.ark_chest(p, O)
p.done()

s = Step("overlay")
p = s.part("overlay", anim="grow", tally="gold")
fu.ark_overlay(p, O)
p.done()

s = Step("crown")
p = s.part("crown", tally="gold")
fu.ark_crown(p, O)
p.done()

s = Step("rings")
for sx in (-1, 1):
    for sz in (-1, 1):
        p = s.part("ring", anim="pop", tally="gold")
        fu.ark_ring(p, O, sx, sz)
        p.done()

s = Step("staves")
for sz in (-1, 1):
    p = s.part("stave", anim=f"slide:{sz * 3.5},0,0", tally="gold")
    fu.ark_stave(p, O, sz)
    p.done()

s = Step("testimony")
for x, lean in ((-0.2, 0.04), (0.2, -0.04)):
    p = s.part("tablet", anim="drop:1.6", tally="stone")
    fu.tablet(p, O, x, lean)
    p.done()

s = Step("mercy-seat")
p = s.part("kapporet", anim="drop:1.2", tally="gold")
fu.mercy_seat(p, O)
p.done()

for sid, d in (("cherub-a", 1), ("cherub-b", -1)):
    s = Step(sid)
    p = s.part("cherub", anim="pop", tally="gold")
    fu.ark_cherub(p, O, d)
    p.done()

export(out_path())
