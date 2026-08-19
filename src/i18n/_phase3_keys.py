# Phase 3 (M-2): insert 11 keys into `mobile.detail` in all six locales.
#
# TEXT MODE ONLY. Do NOT round-trip these files through json.load/json.dump:
#   * each file carries a DUPLICATE "close" key inside `mobile.labCommon` that a
#     dict round-trip silently deletes;
#   * every line ends CRLF, which json.dump would rewrite to LF.
# This script only INSERTS whole lines after a unique anchor line, in binary mode,
# then re-parses each file and re-checks the duplicate key to prove nothing broke.
#
# Idempotent: a file that already has the keys is skipped.
# Run from this directory:  python _phase3_keys.py
#
# Shape copied from `_phase5_keys.py` (integration doc C11). Locale edits are
# serialised one phase at a time; Phase 5's 7 keys are already in, and Phase 4's
# 14 come after these.

import json
import os

HERE = os.path.dirname(os.path.abspath(__file__))
LOCALES = os.path.join(HERE, 'locales')

# Unique, 6-space indented, inside `mobile.detail`, and comma-terminated in all six
# files (re-verified: exactly one match per file, 2026-08-19). Same anchor
# `_phase5_keys.py` used; these lines land immediately after it, ahead of its block.
ANCHOR = b'"profitIntelligence":'

# Order matches the source: the collapsed row's two verbs, its two empty/partial
# states, the sheet's title + subtitle, then search, then the two async states.
KEYS = [
    'change',
    'choose',
    'categoryNotSet',
    'categoryPickSubcategory',
    'selectCategoryTitle',
    'selectCategorySubtitle',
    'categorySearchPlaceholder',
    'categorySearchEmpty',
    'categorySearchClear',
    'categoriesLoading',
    'categoriesRetry',
]

TEXT = {
    'en': {
        'change': 'Change',
        'choose': 'Choose',
        'categoryNotSet': 'Not set — pick a category',
        'categoryPickSubcategory': 'pick a subcategory',
        'selectCategoryTitle': 'Select category',
        'selectCategorySubtitle': 'Search, or browse by group',
        'categorySearchPlaceholder': 'Search categories…',
        'categorySearchEmpty': 'No category matches "{{q}}"',
        'categorySearchClear': 'Clear search to browse all categories',
        'categoriesLoading': 'Loading {{marketplace}} categories…',
        'categoriesRetry': "Couldn't load categories — tap to retry",
    },
    'zh-Hans': {
        'change': '更改',
        'choose': '选择',
        'categoryNotSet': '未设置 — 请选择类别',
        'categoryPickSubcategory': '选择子类别',
        'selectCategoryTitle': '选择类别',
        'selectCategorySubtitle': '搜索，或按分组浏览',
        'categorySearchPlaceholder': '搜索类别…',
        'categorySearchEmpty': '找不到符合「{{q}}」的类别',
        'categorySearchClear': '清除搜索以浏览全部',
        'categoriesLoading': '正在加载 {{marketplace}} 类别…',
        'categoriesRetry': '无法加载类别 — 点击重试',
    },
    'zh-Hant': {
        'change': '變更',
        'choose': '選擇',
        'categoryNotSet': '未設定 — 請選擇類別',
        'categoryPickSubcategory': '選擇子分類',
        'selectCategoryTitle': '選擇類別',
        'selectCategorySubtitle': '搜尋，或依分組瀏覽',
        'categorySearchPlaceholder': '搜尋類別…',
        'categorySearchEmpty': '找不到符合「{{q}}」的類別',
        'categorySearchClear': '清除搜尋以瀏覽全部',
        'categoriesLoading': '正在載入 {{marketplace}} 類別…',
        'categoriesRetry': '無法載入類別 — 點選重試',
    },
    'ja': {
        'change': '変更',
        'choose': '選択',
        'categoryNotSet': '未設定 — カテゴリーを選択してください',
        'categoryPickSubcategory': 'サブカテゴリーを選択',
        'selectCategoryTitle': 'カテゴリーを選択',
        'selectCategorySubtitle': '検索するか、グループから選択',
        'categorySearchPlaceholder': 'カテゴリーを検索…',
        'categorySearchEmpty': '「{{q}}」に一致するカテゴリーがありません',
        'categorySearchClear': '検索をクリアしてすべて表示',
        'categoriesLoading': '{{marketplace}} のカテゴリーを読み込み中…',
        'categoriesRetry': 'カテゴリーを読み込めませんでした — タップで再試行',
    },
    'th': {
        'change': 'เปลี่ยน',
        'choose': 'เลือก',
        'categoryNotSet': 'ยังไม่ได้ตั้งค่า — เลือกหมวดหมู่',
        'categoryPickSubcategory': 'เลือกหมวดหมู่ย่อย',
        'selectCategoryTitle': 'เลือกหมวดหมู่',
        'selectCategorySubtitle': 'ค้นหา หรือเลือกตามกลุ่ม',
        'categorySearchPlaceholder': 'ค้นหาหมวดหมู่…',
        'categorySearchEmpty': 'ไม่พบหมวดหมู่ที่ตรงกับ "{{q}}"',
        'categorySearchClear': 'ล้างการค้นหาเพื่อดูทั้งหมด',
        'categoriesLoading': 'กำลังโหลดหมวดหมู่ของ {{marketplace}}…',
        'categoriesRetry': 'โหลดหมวดหมู่ไม่สำเร็จ — แตะเพื่อลองใหม่',
    },
    'vi': {
        'change': 'Đổi',
        'choose': 'Chọn',
        'categoryNotSet': 'Chưa đặt — hãy chọn danh mục',
        'categoryPickSubcategory': 'chọn danh mục con',
        'selectCategoryTitle': 'Chọn danh mục',
        'selectCategorySubtitle': 'Tìm kiếm, hoặc xem theo nhóm',
        'categorySearchPlaceholder': 'Tìm danh mục…',
        'categorySearchEmpty': 'Không có danh mục nào khớp với "{{q}}"',
        'categorySearchClear': 'Xóa tìm kiếm để xem tất cả',
        'categoriesLoading': 'Đang tải danh mục {{marketplace}}…',
        'categoriesRetry': 'Không thể tải danh mục — chạm để thử lại',
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
    lines = ['      "%s": %s,' % (k, esc(v[k])) for k in KEYS]
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


for locale, fname in FILES.items():
    path = os.path.join(LOCALES, fname)
    raw = open(path, 'rb').read()
    before_dups = dup_keys(raw)
    before_crlf = raw.count(b'\r\n')
    before_close = raw.count(b'"close"')
    if b'"categorySearchPlaceholder":' in raw:
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
    assert dup_keys(out) == before_dups, '%s: duplicate-key set changed' % fname
    assert out.count(b'\r\n') == before_crlf + len(KEYS), '%s: unexpected line count' % fname
    assert out.count(b'\n') == out.count(b'\r\n'), '%s: a bare LF appeared' % fname
    assert out.count(b'"close"') == before_close, '%s: "close" count changed' % fname
    open(path, 'wb').write(out)
    after = open(path, 'rb').read()
    assert after == out, '%s: readback differs from what was written' % fname
    print('%-12s +%d keys, still valid, CRLF intact' % (locale, len(KEYS)))
