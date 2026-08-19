# Phase 4 (M-3): insert 18 keys into `mobile.detail.routing` and 2 into
# `mobile.reviewHub`, in all six locales.
#
# TEXT MODE ONLY. Do NOT round-trip these files through json.load/json.dump:
#   * each file carries a DUPLICATE "close" key inside `mobile.labCommon` that a
#     dict round-trip silently deletes;
#   * every line ends CRLF, which json.dump would rewrite to LF.
# This script only INSERTS whole lines after a unique anchor line, in binary mode,
# then re-parses each file and re-checks the duplicate key to prove nothing broke.
#
# Idempotent: a file that already has the keys is skipped.
# Run from this directory:  python _phase4_keys.py
#
# Shape copied from `_phase3_keys.py` / `_phase5_keys.py` (integration doc C11),
# with TWO anchors instead of one. Locale edits are serialised one phase at a
# time; Phase 5's 7 keys and Phase 3's 11 are already in, and these are last.
#
# NOTE: no `marketplaceHint` keys. Integration C7 gives the marketplace
# description to Phase 5's `mobile.detail.marketplaceOption.<value>.description`,
# which already ships in all six files. A second key namespace for the same
# sentence would put it on the screen twice.

import json
import os

HERE = os.path.dirname(os.path.abspath(__file__))
LOCALES = os.path.join(HERE, 'locales')

# Both re-verified as EXACTLY ONE match per file, 2026-08-19, after Phase 3's
# locale edit landed. 6-space indented, inside `mobile.detail` and
# `mobile.reviewHub` respectively.
DETAIL_ANCHOR = b'"profitIntelligence":'
HUB_ANCHOR = b'"finalValidationTitle":'

# 18 routing keys, in a fixed order so every file's diff is identical in shape.
ROUTING_KEYS = [
    'willListOn',
    'change',
    'why',
    'whyNameplate',
    'whyNoNameplate',
    'askTitle',
    'askBody',
    'askGuess',
    'askCta',
    'bestGuess',
    'setOnce',
    'sheetTitle',
    'sheetSubtitle',
    'categoryNotSet',
    'confidence',
    'confHigh',
    'confMedium',
    'confLow',
]
HUB_KEYS = ['pickMarketplace', 'statusMissingMarketplace']

ROUTING = {}
HUB = {}

ROUTING['en'] = {
    'willListOn': "WE'LL LIST THIS ON",
    'change': 'Change',
    'why': 'WHY',
    'whyNameplate': 'Nameplate reads "{{identity}}".',
    'whyNoNameplate': 'No brand or model was legible in the photos.',
    'askTitle': "We're not sure where this belongs",
    'askBody': "Pick a marketplace and we'll load the right categories.",
    'askGuess': 'Our best guess is {{marketplace}}.',
    'askCta': 'Choose a marketplace to continue',
    'bestGuess': 'Best guess',
    'setOnce': "Category and currency are set once you choose — we won't guess them.",
    'sheetTitle': 'Choose a marketplace',
    'sheetSubtitle': "Category and currency are set once you choose — we won't guess them.",
    'categoryNotSet': 'Category: not set — pick one below. We would rather ask than guess.',
    'confidence': 'AI confidence: {{word}} · {{pct}}%',
    'confHigh': 'High',
    'confMedium': 'Medium',
    'confLow': 'Low',
}
HUB['en'] = {
    'pickMarketplace': 'Marketplace not chosen',
    'statusMissingMarketplace': 'Pick a marketplace',
}

ROUTING['zh-Hant'] = {
    'willListOn': '我們會刊登在',
    'change': '變更',
    'why': '判斷依據',
    'whyNameplate': '銘牌顯示「{{identity}}」。',
    'whyNoNameplate': '照片中看不清品牌或型號。',
    'askTitle': '我們不確定這台設備屬於哪個平台',
    'askBody': '請選擇一個平台，我們就會載入對應的分類。',
    'askGuess': '我們推測是 {{marketplace}}。',
    'askCta': '選擇平台以繼續',
    'bestGuess': '最可能',
    'setOnce': '分類與幣別會在您選擇後設定 — 我們不會亂猜。',
    'sheetTitle': '選擇平台',
    'sheetSubtitle': '分類與幣別會在您選擇後設定 — 我們不會亂猜。',
    'categoryNotSet': '分類：未設定 — 請在下方選擇。我們寧願詢問也不亂猜。',
    'confidence': 'AI 信心度：{{word}} · {{pct}}%',
    'confHigh': '高',
    'confMedium': '中',
    'confLow': '低',
}
HUB['zh-Hant'] = {'pickMarketplace': '尚未選擇平台', 'statusMissingMarketplace': '請選擇平台'}

ROUTING['zh-Hans'] = {
    'willListOn': '我们会刊登在',
    'change': '更改',
    'why': '判断依据',
    'whyNameplate': '铭牌显示“{{identity}}”。',
    'whyNoNameplate': '照片中看不清品牌或型号。',
    'askTitle': '我们不确定这台设备属于哪个平台',
    'askBody': '请选择一个平台，我们就会加载对应的分类。',
    'askGuess': '我们推测是 {{marketplace}}。',
    'askCta': '选择平台以继续',
    'bestGuess': '最可能',
    'setOnce': '分类与币别会在您选择后设定 — 我们不会乱猜。',
    'sheetTitle': '选择平台',
    'sheetSubtitle': '分类与币别会在您选择后设定 — 我们不会乱猜。',
    'categoryNotSet': '分类：未设定 — 请在下方选择。我们宁愿询问也不乱猜。',
    'confidence': 'AI 置信度：{{word}} · {{pct}}%',
    'confHigh': '高',
    'confMedium': '中',
    'confLow': '低',
}
HUB['zh-Hans'] = {'pickMarketplace': '尚未选择平台', 'statusMissingMarketplace': '请选择平台'}

ROUTING['ja'] = {
    'willListOn': '出品先',
    'change': '変更',
    'why': '判断の根拠',
    'whyNameplate': '銘板に「{{identity}}」と記載されています。',
    'whyNoNameplate': '写真からブランドと型番を読み取れませんでした。',
    'askTitle': 'どのマーケットプレイスか判断できません',
    'askBody': 'マーケットプレイスを選ぶと、対応するカテゴリを読み込みます。',
    'askGuess': '推定は {{marketplace}} です。',
    'askCta': 'マーケットプレイスを選択して続行',
    'bestGuess': '最有力',
    'setOnce': 'カテゴリと通貨は選択後に設定されます。推測はしません。',
    'sheetTitle': 'マーケットプレイスを選択',
    'sheetSubtitle': 'カテゴリと通貨は選択後に設定されます。推測はしません。',
    'categoryNotSet': 'カテゴリ：未設定 — 下で選択してください。推測せずにお尋ねします。',
    'confidence': 'AI 信頼度：{{word}} · {{pct}}%',
    'confHigh': '高',
    'confMedium': '中',
    'confLow': '低',
}
HUB['ja'] = {
    'pickMarketplace': 'マーケットプレイス未選択',
    'statusMissingMarketplace': 'マーケットプレイスを選択',
}

ROUTING['th'] = {
    'willListOn': 'เราจะลงประกาศที่',
    'change': 'เปลี่ยน',
    'why': 'เหตุผล',
    'whyNameplate': 'ป้ายเครื่องระบุว่า "{{identity}}"',
    'whyNoNameplate': 'อ่านแบรนด์หรือรุ่นจากรูปไม่ได้',
    'askTitle': 'เรายังไม่แน่ใจว่าเครื่องนี้อยู่ตลาดไหน',
    'askBody': 'เลือกตลาดหนึ่งแห่ง แล้วเราจะโหลดหมวดหมู่ที่ถูกต้อง',
    'askGuess': 'เราคาดว่าเป็น {{marketplace}}',
    'askCta': 'เลือกตลาดเพื่อดำเนินการต่อ',
    'bestGuess': 'น่าจะเป็น',
    'setOnce': 'หมวดหมู่และสกุลเงินจะถูกตั้งค่าเมื่อคุณเลือก — เราไม่เดา',
    'sheetTitle': 'เลือกตลาด',
    'sheetSubtitle': 'หมวดหมู่และสกุลเงินจะถูกตั้งค่าเมื่อคุณเลือก — เราไม่เดา',
    'categoryNotSet': 'หมวดหมู่: ยังไม่ได้ตั้ง — เลือกด้านล่าง เราขอถามดีกว่าเดา',
    'confidence': 'ความมั่นใจของ AI: {{word}} · {{pct}}%',
    'confHigh': 'สูง',
    'confMedium': 'กลาง',
    'confLow': 'ต่ำ',
}
HUB['th'] = {'pickMarketplace': 'ยังไม่ได้เลือกตลาด', 'statusMissingMarketplace': 'เลือกตลาด'}

ROUTING['vi'] = {
    'willListOn': 'CHÚNG TÔI SẼ ĐĂNG TẠI',
    'change': 'Đổi',
    'why': 'LÝ DO',
    'whyNameplate': 'Nhãn máy ghi "{{identity}}".',
    'whyNoNameplate': 'Không đọc được thương hiệu hoặc model trong ảnh.',
    'askTitle': 'Chúng tôi chưa chắc thiết bị này thuộc sàn nào',
    'askBody': 'Hãy chọn một sàn, chúng tôi sẽ tải đúng danh mục.',
    'askGuess': 'Phỏng đoán của chúng tôi là {{marketplace}}.',
    'askCta': 'Chọn một sàn để tiếp tục',
    'bestGuess': 'Khả năng cao nhất',
    'setOnce': 'Danh mục và tiền tệ được đặt sau khi bạn chọn — chúng tôi không đoán.',
    'sheetTitle': 'Chọn sàn',
    'sheetSubtitle': 'Danh mục và tiền tệ được đặt sau khi bạn chọn — chúng tôi không đoán.',
    'categoryNotSet': 'Danh mục: chưa đặt — hãy chọn bên dưới. Chúng tôi thà hỏi hơn là đoán.',
    'confidence': 'Độ tin cậy AI: {{word}} · {{pct}}%',
    'confHigh': 'Cao',
    'confMedium': 'Trung bình',
    'confLow': 'Thấp',
}
HUB['vi'] = {'pickMarketplace': 'Chưa chọn sàn', 'statusMissingMarketplace': 'Chọn một sàn'}

FILES = {
    'en': 'en.json',
    'zh-Hans': 'zh-Hans.json',
    'zh-Hant': 'zh-Hant.json',
    'ja': 'ja.json',
    'th': 'th.json',
    'vi': 'vi.json',
}

# 18 value lines + the `"routing": {` opener + the `},` closer + 2 hub lines.
LINES_ADDED = len(ROUTING_KEYS) + 2 + len(HUB_KEYS)


def esc(s):
    """JSON-escape a single string value (no dict round-trip)."""
    return json.dumps(s, ensure_ascii=False)


def routing_block(v):
    """The nested `routing` object, 6-space indent, CRLF-terminated."""
    lines = ['      "routing": {']
    for i, k in enumerate(ROUTING_KEYS):
        comma = '' if i == len(ROUTING_KEYS) - 1 else ','
        lines.append('        "%s": %s%s' % (k, esc(v[k]), comma))
    lines.append('      },')
    return b''.join((ln.encode('utf-8') + b'\r\n') for ln in lines)


def hub_block(v):
    lines = ['      "%s": %s,' % (k, esc(v[k])) for k in HUB_KEYS]
    return b''.join((ln.encode('utf-8') + b'\r\n') for ln in lines)


def dup_keys(raw):
    """Which keys appear twice in some object. Must be unchanged before/after."""
    hits = []

    def hook(pairs):
        seen = {}
        for k, val in pairs:
            if k in seen:
                hits.append(k)
            seen[k] = val
        return seen

    json.loads(raw.decode('utf-8'), object_pairs_hook=hook)
    return sorted(hits)


def insert_after(lines, anchor, ins_lines, fname):
    idx = [i for i, ln in enumerate(lines) if anchor in ln]
    assert len(idx) == 1, '%s: expected exactly 1 %r, found %d' % (fname, anchor, len(idx))
    at = idx[0]
    return lines[: at + 1] + ins_lines + lines[at + 1 :]


for locale, fname in FILES.items():
    path = os.path.join(LOCALES, fname)
    raw = open(path, 'rb').read()
    before_dups = dup_keys(raw)
    before_crlf = raw.count(b'\r\n')
    before_close = raw.count(b'"close"')
    assert before_dups == ['close'], '%s: unexpected dup set %r' % (fname, before_dups)
    assert raw.count(b'\n') == before_crlf, '%s: a bare LF is already present' % fname

    if b'"willListOn":' in raw:
        print('%-12s already has the keys - skipped' % locale)
        continue

    lines = raw.split(b'\r\n')
    lines = insert_after(
        lines, DETAIL_ANCHOR, routing_block(ROUTING[locale]).split(b'\r\n')[:-1], fname
    )
    lines = insert_after(lines, HUB_ANCHOR, hub_block(HUB[locale]).split(b'\r\n')[:-1], fname)
    out = b'\r\n'.join(lines)

    # Prove all four properties BEFORE writing.
    json.loads(out.decode('utf-8'))
    assert dup_keys(out) == before_dups, '%s: duplicate-key set changed' % fname
    assert out.count(b'\r\n') == before_crlf + LINES_ADDED, '%s: unexpected line count' % fname
    assert out.count(b'\n') == out.count(b'\r\n'), '%s: a bare LF appeared' % fname
    assert out.count(b'"close"') == before_close, '%s: "close" count changed' % fname

    open(path, 'wb').write(out)
    after = open(path, 'rb').read()
    assert after == out, '%s: readback differs from what was written' % fname
    print(
        '%-12s +%d keys (%d lines), still valid, CRLF intact'
        % (locale, len(ROUTING_KEYS) + len(HUB_KEYS), LINES_ADDED)
    )
