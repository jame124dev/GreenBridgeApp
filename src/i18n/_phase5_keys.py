# Phase 5 (M-5 + M-10): insert 7 keys into `mobile.detail` in all six locales.
#
# TEXT MODE ONLY. Do NOT round-trip these files through json.load/json.dump:
#   * each file carries a DUPLICATE "close" key inside `mobile.labCommon`
#     (en.json:4298 and :4313) that a dict round-trip silently deletes;
#   * every line ends CRLF, which json.dump would rewrite to LF.
# This script only INSERTS whole lines after a unique anchor line, in binary mode,
# then re-parses each file and re-checks the duplicate key to prove nothing broke.
#
# Idempotent: a file that already has the keys is skipped.
# Run from this directory:  python _phase5_keys.py
#
# REUSABLE (integration doc C11): Phase 3 and Phase 4 also add keys to
# `mobile.detail` in these same six files. Copy this script's SHAPE — binary read,
# split on b'\r\n', insert after a UNIQUE anchor line, assert the duplicate-key set
# and the CRLF count are unchanged, and only then write. Do not write a
# json.load/json.dump version; two earlier attempts corrupted these files exactly
# that way.

import json
import os

HERE = os.path.dirname(os.path.abspath(__file__))
LOCALES = os.path.join(HERE, 'locales')

# Unique, 6-space indented, inside `mobile.detail`, and comma-terminated in all six
# files (checked: en:3805 zh-Hans:3791 zh-Hant:3791 ja:3726 th:3710 vi:3807).
ANCHOR = b'"profitIntelligence":'

TEXT = {
    'en': {
        'profitAiEstimate': 'AI estimate — verify before publishing',
        'profitNoEstimate': 'No price estimate',
        'profitNoEstimateHint': 'The AI did not return a resale range for this item. Set your own price below.',
        '101lab': 'Lab & scientific equipment',
        '101machine': 'Industrial & production machinery',
        '101it': 'IT hardware & electronics',
        '101recycle': 'Scrap, surplus & recyclable materials',
    },
    'zh-Hans': {
        'profitAiEstimate': 'AI 估算 — 发布前请核实',
        'profitNoEstimate': '暂无价格估算',
        'profitNoEstimateHint': 'AI 未返回该物品的转售价格区间。请在下方自行设定价格。',
        '101lab': '实验室与科研设备',
        '101machine': '工业与生产机械',
        '101it': 'IT 硬件与电子设备',
        '101recycle': '废料、剩余物资与回收材料',
    },
    'zh-Hant': {
        'profitAiEstimate': 'AI 估算 — 發布前請核實',
        'profitNoEstimate': '暫無價格估算',
        'profitNoEstimateHint': 'AI 未回傳此物品的轉售價格區間。請在下方自行設定價格。',
        '101lab': '實驗室與科研設備',
        '101machine': '工業與生產機械',
        '101it': 'IT 硬體與電子設備',
        '101recycle': '廢料、剩餘物資與回收材料',
    },
    'ja': {
        'profitAiEstimate': 'AI推定 — 公開前にご確認ください',
        'profitNoEstimate': '価格の推定はありません',
        'profitNoEstimateHint': 'この商品の再販価格帯はAIから返されませんでした。下で価格を設定してください。',
        '101lab': '研究室・科学機器',
        '101machine': '産業・生産機械',
        '101it': 'IT機器・電子機器',
        '101recycle': 'スクラップ・余剰品・リサイクル材',
    },
    'th': {
        'profitAiEstimate': 'การประมาณโดย AI — ตรวจสอบก่อนเผยแพร่',
        'profitNoEstimate': 'ยังไม่มีการประมาณราคา',
        'profitNoEstimateHint': 'AI ไม่ได้ให้ช่วงราคาขายต่อของสินค้านี้ กรุณาตั้งราคาด้านล่าง',
        '101lab': 'อุปกรณ์ห้องปฏิบัติการและวิทยาศาสตร์',
        '101machine': 'เครื่องจักรอุตสาหกรรมและการผลิต',
        '101it': 'ฮาร์ดแวร์ไอทีและอิเลกทรอนิกส์',
        '101recycle': 'เศษวัสดุ ของเหลือใช้ และวัสดุรีไซเคิล',
    },
    'vi': {
        'profitAiEstimate': 'Ước tính bằng AI — hãy kiểm tra trước khi đăng',
        'profitNoEstimate': 'Chưa có ước tính giá',
        'profitNoEstimateHint': 'AI không trả về khoảng giá bán lại cho mặt hàng này. Hãy tự đặt giá bên dưới.',
        '101lab': 'Thiết bị phòng thí nghiệm và khoa học',
        '101machine': 'Máy móc công nghiệp và sản xuất',
        '101it': 'Thiết bị IT và điện tử',
        '101recycle': 'Phế liệu, vật tư dư và vật liệu tái chế',
    },
}

FILES = {
    'en': 'en.json',
    'zh-Hans': 'zh-Hans.json',
    'zh-Hant': 'zh-Hant.json',
    'ja': 'ja.json',
    'th': 'th.json',
    'vi': 'vi.json',
}


def esc(s):
    """JSON-escape a single string value (no dict round-trip)."""
    return json.dumps(s, ensure_ascii=False)


def block(v):
    """The exact lines to insert, 6-space indent, CRLF-terminated."""
    lines = [
        '      "profitAiEstimate": %s,' % esc(v['profitAiEstimate']),
        '      "profitNoEstimate": %s,' % esc(v['profitNoEstimate']),
        '      "profitNoEstimateHint": %s,' % esc(v['profitNoEstimateHint']),
        '      "marketplaceOption": {',
        '        "101lab": {',
        '          "description": %s' % esc(v['101lab']),
        '        },',
        '        "101machine": {',
        '          "description": %s' % esc(v['101machine']),
        '        },',
        '        "101it": {',
        '          "description": %s' % esc(v['101it']),
        '        },',
        '        "101recycle": {',
        '          "description": %s' % esc(v['101recycle']),
        '        }',
        '      },',
    ]
    return b''.join((ln.encode('utf-8') + b'\r\n') for ln in lines)


def dup_close_count(raw):
    """How many objects carry a duplicate key. Must be 1 before and after."""
    hits = []

    def hook(pairs):
        seen = {}
        for k, val in pairs:
            if k in seen:
                hits.append(k)
            seen[k] = val
        return seen

    json.loads(raw.decode('utf-8'), object_pairs_hook=hook)
    return hits


for locale, fname in FILES.items():
    path = os.path.join(LOCALES, fname)
    raw = open(path, 'rb').read()
    before_dups = dup_close_count(raw)
    before_crlf = raw.count(b'\r\n')
    if b'"profitAiEstimate":' in raw:
        print('%-12s already has the keys - skipped' % locale)
        continue
    lines = raw.split(b'\r\n')
    idx = [i for i, ln in enumerate(lines) if ANCHOR in ln]
    assert len(idx) == 1, '%s: expected exactly 1 anchor, found %d' % (fname, len(idx))
    at = idx[0]
    ins = block(TEXT[locale])
    out = b'\r\n'.join(lines[: at + 1]) + b'\r\n' + ins + b'\r\n'.join(lines[at + 1 :])
    # Prove it before writing.
    json.loads(out.decode('utf-8'))
    open(path, 'wb').write(out)
    after = open(path, 'rb').read()
    assert dup_close_count(after) == before_dups, '%s: duplicate-key set changed' % fname
    assert after.count(b'\r\n') == before_crlf + 17, '%s: unexpected line count' % fname
    assert after.count(b'\n') == after.count(b'\r\n'), '%s: a bare LF appeared' % fname
    print('%-12s +7 keys, still valid, CRLF intact' % locale)
