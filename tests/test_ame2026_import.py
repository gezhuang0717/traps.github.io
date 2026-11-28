"""Regression tests against verbatim AMDC 2026 fixed-width files, no synthetic substitute."""
import json
import sys
import unittest
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/"tools"))
import import_ame2026 as imp

OFFICIAL={
 "mass.mas26":"31b5d160f0680dc1df4eafa36f01bfcb7777d5144a7e37321244b42c330b2f39",
 "rct1.mas26":"90d8aef2ea23a16c3816212976b67c3492d83bcea79f9d8a074e6f5fb12a3461",
 "rct2.mas26":"2a03bb7795d98a1dc209a01ed0a0e79bccc67fa5e9fbeef3dc78d2748a4a49ac",
 "nubase.mas26":"799a9f44904ddb83ef0e44e4313d1058f514195707aca616ed7e6789f683bd9f"
}

class OfficialAME2026Tests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        for name, expected in OFFICIAL.items():
            p=imp.RAW_DIR/name
            if not p.is_file():raise RuntimeError("Missing official AMDC source: "+str(p))
            data=p.read_bytes()
            if imp.sha(data)!=expected:raise RuntimeError("Official source SHA256 mismatch: "+name)
            imp.validate_original(name,data)
        cls.result=imp.build(imp.RAW_DIR)

    def test_source_and_inventory(self):
        m=self.result["ame2026-source-manifest.json"]
        self.assertEqual(m["edition"],"AME2026+NUBASE2026")
        self.assertEqual(m["validation"]["status"],"PASS")
        self.assertGreaterEqual(m["counts"]["masses"],3300)
        self.assertGreaterEqual(m["counts"]["states"],5000)
        self.assertEqual(len(m["sources"]),4)

    def test_mass_groundstate_original_fixed_column_anchors(self):
        mass=self.result["ame2026.json"]
        me={(z,a-z):v for z,a,el,v,*extra in mass["rows"]}
        self.assertAlmostEqual(me[(0,1)],8071.31807,places=4)
        self.assertAlmostEqual(me[(1,0)],7288.97108,places=4)
        self.assertTrue(all(isinstance(v,(int,float)) for v in me.values()))

    def test_reactions_and_evaluated_uncertainty(self):
        result=self.result["ame2026-reactions.json"]
        self.assertEqual(result["unit"],"keV")
        self.assertEqual(len(result["quantities"]),16)
        tritium=result["records"]["1,2"]["values"]
        self.assertAlmostEqual(tritium["s2n"]["value"],8481.80,places=2)
        deuterium=result["records"]["1,1"]["values"]
        self.assertAlmostEqual(deuterium["sn"]["value"],2224.57,places=2)
        self.assertEqual(result["validation"]["status"],"PASS")
        self.assertGreater(sum(q["checked"] for q in result["validation"]["quantities"].values()),40000)

    def test_isomer_states_not_conflated_with_ground_mass(self):
        states=self.result["nuclear-states2026.json"]
        ids=[s["id"] for s in states["states"]]
        self.assertEqual(len(ids),len(set(ids)))
        self.assertGreater(states["counts"]["ground"],3300)
        self.assertGreater(states["counts"]["excited"],1500)
        self.assertGreater(states["counts"]["isomers"],0)
        self.assertEqual(states["source"]["name"],"NUBASE2026")

    def test_reproducible_output_manifest(self):
        outputs=self.result["ame2026-source-manifest.json"]["outputs"]
        for item in outputs:
            path=imp.DATA_DIR/item["filename"]
            self.assertEqual(imp.sha(path.read_bytes()),item["sha256"])
            self.assertEqual(path.stat().st_size,item["bytes"])

if __name__=="__main__":unittest.main()
