import uharfbuzz as hb
from fontTools.ttLib import TTFont
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.recordingPen import RecordingPen, DecomposingRecordingPen
from fontTools.pens.transformPen import TransformPen
from fontTools.pens.boundsPen import BoundsPen

class Face:
    def __init__(self, path):
        self.tt = TTFont(path); self.gs = self.tt.getGlyphSet(); self.upm = self.tt['head'].unitsPerEm
        blob = hb.Blob.from_file_path(path); self.hbf = hb.Font(hb.Face(blob))
        self.order = self.tt.getGlyphOrder()
    def shape(self, text, features=None):
        buf = hb.Buffer(); buf.add_str(text); buf.guess_segment_properties()
        hb.shape(self.hbf, buf, features or {'kern': True, 'liga': True})
        return [(self.order[i.codepoint], p.x_advance, p.x_offset, p.y_offset) for i, p in zip(buf.glyph_infos, buf.glyph_positions)]
    def run(self, text, size, x=0, y=0, track=0.0, features=None):
        """returns list of (glyphname, contours-recording, transform) and total width, in px"""
        s = size / self.upm; out = []; cx = 0
        for g, adv, xo, yo in self.shape(text, features):
            out.append((g, (s, 0, 0, -s, x + (cx + xo) * s, y - yo * s)))
            cx += adv + track * self.upm
        return out, (cx - track * self.upm) * s
    def d(self, glyph, tr):
        pen = SVGPathPen(self.gs, ntos=lambda v: ('%.2f' % v).rstrip('0').rstrip('.'))
        self.gs[glyph].draw(TransformPen(pen, tr)); return pen.getCommands()
    def contours(self, glyph, tr):
        """split a glyph into its contours, each as (d, bounds)"""
        rec = DecomposingRecordingPen(self.gs); self.gs[glyph].draw(TransformPen(rec, tr))
        parts, cur = [], []
        for op, args in rec.value:
            cur.append((op, args))
            if op in ('closePath', 'endPath'): parts.append(cur); cur = []
        res = []
        for part in parts:
            r = RecordingPen(); r.value = part
            pen = SVGPathPen(None, ntos=lambda v: ('%.2f' % v).rstrip('0').rstrip('.')); r.replay(pen)
            b = BoundsPen(None); r.replay(b); res.append((pen.getCommands(), b.bounds))
        return res
    def text_d(self, text, size, x=0, y=0, track=0.0, features=None):
        glyphs, w = self.run(text, size, x, y, track, features)
        return ''.join(self.d(g, t) for g, t in glyphs), w
