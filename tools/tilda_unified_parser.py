#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import os
import re
import sys
import json
import argparse
import unicodedata
from datetime import datetime, timezone
from typing import Optional, Tuple, List, Dict
import requests
from bs4 import BeautifulSoup, Tag
from urllib.parse import urlparse, urlunparse, parse_qs, urlencode, unquote

# ========= НАСТРОЙКИ =========
DEFAULT_UA = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36"
)
TIMEOUT = 30


# ========= УТИЛИТЫ =========
def ts_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def ensure_dir(path: str) -> None:
    os.makedirs(path, exist_ok=True)


def safe_join(*parts) -> str:
    return os.path.normpath(os.path.join(*parts)).replace("\\", "/")


def norm_ws(s: str) -> str:
    if not s:
        return ""
    return "\n".join(
        line.strip() for line in s.replace("\r", "").split("\n") if line.strip()
    )


def slugify(text: str, max_len: int = 100) -> str:
    text = unicodedata.normalize("NFKD", text)
    text = re.sub(r"[^\w\s-]", "", text, flags=re.U)
    text = re.sub(r"[\s_-]+", "-", text, flags=re.U)
    text = text.strip("-").lower()
    return text[:max_len] or "item"


def fetch_html(url: Optional[str], file_path: Optional[str], headers: dict) -> str:
    if file_path:
        with open(file_path, "r", encoding="utf-8") as f:
            return f.read()
    if not url:
        raise ValueError("URL is required if no local file is provided")
    r = requests.get(url, headers=headers, timeout=TIMEOUT)
    r.raise_for_status()
    r.encoding = r.apparent_encoding or "utf-8"
    return r.text


def clean_url(u: str) -> str:
    if not u:
        return u
    if u.startswith("//"):
        u = "https:" + u
    if "vk.com/away.php" in u:
        to = parse_qs(urlparse(u).query).get("to", [u])[0]
        return unquote(to)
    pr = urlparse(u)
    qs = parse_qs(pr.query, keep_blank_values=True)
    for k in list(qs):
        if k.lower().startswith(
            ("utm_", "yclid", "gclid", "fbclid", "_openstat", "ysclid", "mango")
        ):
            qs.pop(k, None)
    return urlunparse(pr._replace(query=urlencode(qs, doseq=True)))


def is_bad_host(u: str) -> bool:
    try:
        host = urlparse(u).netloc.lower()
    except Exception:
        return True
    return any(d in host for d in ("tilda.cc", "tilda.ws"))


# ========= ПРОГРАММА (t521) =========
TIME_RANGE_RE = re.compile(r"(?P<start>\d{1,2}:\d{2})\s*[–-]\s*(?P<end>\d{1,2}:\d{2})")
DATE_NUM_RE = re.compile(r"\b(\d{1,2})[./-](\d{1,2})[./-](\d{2,4})\b")
MONTHS_RU = {
    "январ": "01",
    "феврал": "02",
    "март": "03",
    "апрел": "04",
    "ма": "05",
    "июн": "06",
    "июл": "07",
    "август": "08",
    "сентябр": "09",
    "октябр": "10",
    "ноябр": "11",
    "декабр": "12",
}
MONTH_RE = re.compile(r"\b(\d{1,2})\s+([А-Яа-яЁё]+)\s+(\d{4})\b")


def guess_date(html: str) -> Optional[str]:
    # 1) 24.09.2025
    m = DATE_NUM_RE.search(html)
    if m:
        d, mo, y = m.group(1), m.group(2), m.group(3)
        if len(y) == 2:
            y = "20" + y
        return f"{int(y):04d}-{int(mo):02d}-{int(d):02d}"
    # 2) 24 сентября 2025
    m = MONTH_RE.search(html)
    if m:
        d, mon, y = int(m.group(1)), m.group(2).lower(), int(m.group(3))
        nm = None
        for stem, num in MONTHS_RU.items():
            if mon.startswith(stem):
                nm = num
                break
        if nm:
            return f"{y:04d}-{nm}-{d:02d}"
    return None


def split_time_and_place(left_block_text: str) -> Tuple[Optional[str], Optional[str]]:
    if not left_block_text:
        return None, None
    lines = [ln.strip() for ln in left_block_text.split("\n") if ln.strip()]
    if not lines:
        return None, None
    time_range = lines[0]
    place = " ".join(lines[1:]) if len(lines) > 1 else None
    return time_range, place


def parse_time_range(time_range: Optional[str]) -> Tuple[Optional[str], Optional[str]]:
    if not time_range:
        return None, None
    m = TIME_RANGE_RE.search(time_range)
    if not m:
        return None, None
    return m.group("start"), m.group("end")


def text_with_bullets(node) -> str:
    if node is None:
        return ""
    flat = node.get_text("\n", strip=True)
    flat_norm = norm_ws(flat)
    bullets = []
    for li in node.select("li"):
        t = norm_ws(li.get_text(" ", strip=True))
        if t:
            bullets.append(f"• {t}")
    for b in bullets:
        if b not in flat_norm:
            flat_norm = (flat_norm + "\n" if flat_norm else "") + b
    flat_norm = "\n".join([ln for ln in flat_norm.split("\n") if ln.strip()])
    return flat_norm


def parse_right_block(right: Tag) -> Tuple[str, Optional[str], List[str], List[Dict]]:
    raw = text_with_bullets(right)
    title = None
    cand = right.select_one("h3, h4, strong, b")
    if cand:
        title = norm_ws(cand.get_text(" ", strip=True))
    if not title:
        first_line = norm_ws(raw.split("\n")[0]) if raw else ""
        title = first_line[:160] if first_line else None

    topics: List[str] = []
    speakers: List[Dict] = []
    SKIP_PAT = re.compile(r"\b(модератор|ведущий|регистрация|перерыв|кофе)\b", re.I)
    for ln in (raw or "").split("\n"):
        ln = ln.strip("• ").strip()
        if not ln:
            continue
        if "—" in ln or " - " in ln:
            parts = re.split(r"\s+—\s+|\s+-\s+", ln, maxsplit=1)
            if len(parts) == 2:
                nm, tp = parts
                speakers.append({"name": nm.strip(), "topic": tp.strip()})
                continue
        m = re.match(r"^([А-ЯA-ZЁ][^,]+),\s*(.+)$", ln)
        if m and len(m.group(1).split()) <= 4:
            speakers.append(
                {"name": m.group(1).strip(), "position": m.group(2).strip()}
            )
            continue
        if not SKIP_PAT.search(ln):
            topics.append(ln)
    return raw, title, topics, speakers


def parse_program_t521(html: str, date_for_uid: Optional[str] = None) -> List[Dict]:
    # lxml быстрее и стабильнее; если не установлен — упадём на requirements
    soup = BeautifulSoup(html, "lxml")
    rows = soup.select("div.t521__row")
    out: List[Dict] = []
    for row in rows:
        left = row.select_one(".t521__time")
        right = row.select_one(".t521__text")
        if not right:
            continue
        raw, title, topics, speakers = parse_right_block(right)
        if not left:
            out.append(
                {
                    "type": "info",
                    "time": None,
                    "start": None,
                    "end": None,
                    "location": None,
                    "title": title or "Информация",
                    "html": raw,
                    "topics": topics,
                    "speakers": speakers,
                }
            )
            continue
        left_text = left.get_text("\n", strip=True)
        time_range, place = split_time_and_place(left_text)
        start, end = parse_time_range(time_range)
        uid = slugify(f"{date_for_uid or ''}_{start or ''}_{place or ''}_{title or ''}")
        out.append(
            {
                "type": "event",
                "uid": uid,
                "time": time_range,
                "start": start,
                "end": end,
                "location": place,
                "title": title or (topics[0] if topics else "Событие"),
                "html": raw,
                "topics": topics,
                "speakers": speakers,
            }
        )
    return out


# ========= УЧАСТНИКИ/СПИКЕРЫ (t844/t524) — пока опционально =========
IMG_URL_RE = re.compile(r"background-image\s*:\s*url\(['\"]?([^'\"()]+)")


def first_from_srcset(val: Optional[str]) -> Optional[str]:
    if not val:
        return None
    return val.split(",")[0].strip().split()[0]


def get_img_url(node: Tag) -> Optional[str]:
    candidates: List[str] = []
    img = node if node.name == "img" else node.select_one("img")
    if img:
        candidates += [
            img.get("data-original"),
            img.get("data-src"),
            first_from_srcset(img.get("srcset")),
            img.get("src"),
        ]
    el: Optional[Tag] = node
    while isinstance(el, Tag):
        dobj = el.get("data-original") or el.get("data-bg")
        if dobj:
            candidates.append(dobj)
        style = el.get("style")
        if style:
            m = IMG_URL_RE.search(style)
            if m:
                candidates.append(m.group(1))
        el = el.parent if isinstance(el.parent, Tag) else None
    for c in candidates:
        if not c:
            continue
        u = c.strip()
        if not u or u.startswith("data:"):
            continue
        if u.startswith("//"):
            u = "https:" + u
        return clean_url(u)
    return None


def fetch_soup(url: str, headers: dict) -> BeautifulSoup:
    r = requests.get(url, headers=headers, timeout=TIMEOUT)
    r.raise_for_status()
    soup = BeautifulSoup(r.text, "html.parser")
    for tag in soup(["script", "style"]):
        tag.decompose()
    return soup


def pick_external_link(card: Tag) -> Optional[str]:
    for a in card.select("a[href]"):
        href = (a.get("href") or "").strip()
        if href and href.startswith(("http://", "https://", "//")):
            u = clean_url(href)
            if u and not is_bad_host(u):
                return u
    return None


def extract_participant_card(card: Tag) -> Optional[Dict]:
    url = pick_external_link(card)
    if not url:
        return None
    name = None
    a = card.select_one("a[href]")
    if a:
        name = norm_ws(a.get_text())
    if not name:
        ttl = card.select_one(".t-card__title, .t-name, .t-title, h3, h4")
        if ttl:
            name = norm_ws(ttl.get_text())
    if not name:
        return None
    logo = None
    img = card.select_one("img")
    if img:
        logo = get_img_url(img)
    if not logo:
        logo = get_img_url(card)
    desc = None
    txt = card.select_one(".t-card__descr, .t-descr, p")
    if txt:
        cand = norm_ws(txt.get_text(" "))
        if cand and len(cand) > 12:
            cut = re.split(r"(?<=[.!?…])\s+", cand, maxsplit=1)[0]
            desc = (cut[:350].rstrip(" ,;:") + "…") if len(cand) > 350 else cut
    return {"name": name, "url": url, "description": desc, "logo": logo}


def parse_participants_t844(url: str, headers: dict) -> List[Dict]:
    soup = fetch_soup(url, headers=headers)
    cards = soup.select(
        ".t844 .t844__col, li.t844__col, li[class*='t844__col'], .t-card__col.t844__col"
    )
    out = []
    for c in cards:
        it = extract_participant_card(c)
        if it:
            out.append(it)
    uniq, seen = [], set()
    for it in out:
        u = it["url"]
        if u not in seen:
            seen.add(u)
            uniq.append(it)
    return uniq


def parse_speakers_t524(url: str, headers: dict) -> List[Dict]:
    soup = fetch_soup(url, headers=headers)
    cards = soup.find_all(
        lambda tag: tag.name in ("li", "div")
        and tag.has_attr("class")
        and any("t524__col" in c for c in tag.get("class", []))
    )
    out = []
    for card in cards:
        name = None
        n = card.select_one(".t524__personname") or card.select_one(
            ".t-name, .t-title, h3, h4, strong"
        )
        if n:
            name = norm_ws(n.get_text())
        if not name:
            continue
        desc = None
        d = card.select_one(".t524__persdescr")
        if d:
            cand = norm_ws(d.get_text(" "))
            if cand:
                cut = re.split(r"(?<=[.!?…])\s+", cand, maxsplit=1)[0]
                desc = (cut[:350].rstrip(" ,;:") + "…") if len(cand) > 350 else cut
        photo = None
        m = card.select_one('meta[itemprop="image"]')
        if m and m.get("content"):
            photo = clean_url((m["content"] or "").strip())
        if not photo:
            img = card.select_one("img")
            if img:
                photo = get_img_url(img)
        if not photo:
            photo = get_img_url(card)
        out.append({"name": name, "description": desc, "photo": photo})
    uniq, seen = [], set()
    for it in out:
        key = (it.get("name"), it.get("photo"))
        if key not in seen:
            seen.add(key)
            uniq.append(it)
    return uniq


# ========= ЗАПИСЬ =========
def write_json(path: str, payload: dict) -> None:
    ensure_dir(os.path.dirname(path))
    with open(path, "w", encoding="utf-8", newline="\n") as f:
        json.dump(payload, f, ensure_ascii=False, indent=2)


# ========= MAIN =========
def main():
    ap = argparse.ArgumentParser(
        description="Unified Tilda parser → public/data/*.json"
    )
    ap.add_argument(
        "--update",
        default=os.getenv("UPDATE", "schedule"),
        help="Список через запятую: schedule,participants,speakers,organizers,all (по умолчанию: schedule)",
    )

    # источники
    ap.add_argument(
        "--program-url",
        default=os.getenv(
            "URL_PROGRAM", "https://project13487951.tilda.ws/page74408851.html"
        ),
    )
    ap.add_argument(
        "--participants-url",
        default=os.getenv(
            "URL_PARTICIPANTS", "https://project13487951.tilda.ws/page74407793.html"
        ),
    )
    ap.add_argument(
        "--speakers-url",
        default=os.getenv(
            "URL_SPEAKERS", "https://project13487951.tilda.ws/page74407793.html"
        ),
    )
    ap.add_argument(
        "--organizers-url",
        default=os.getenv(
            "URL_ORGANIZERS", "https://project13487951.tilda.ws/page74407793.html"
        ),
    )

    # локальные файлы (для отладки)
    ap.add_argument("--program-file", default="")
    ap.add_argument("--participants-file", default="")
    ap.add_argument("--speakers-file", default="")
    ap.add_argument("--organizers-file", default="")

    # вывод
    ap.add_argument("--data-dir", default="public/data", help="Куда писать JSON")
    ap.add_argument(
        "--out-schedule",
        default="",
        help="Путь для schedule.json (по умолчанию public/data/schedule.json)",
    )
    ap.add_argument("--out-participants", default="", help="Путь для participants.json")
    ap.add_argument("--out-speakers", default="", help="Путь для speakers.json")
    ap.add_argument("--out-organizers", default="", help="Путь для organizers.json")

    # доп
    ap.add_argument(
        "--date",
        default=os.getenv("PROGRAM_DATE", ""),
        help="Дата для UID YYYY-MM-DD; если не задана — попробуем угадать",
    )

    args = ap.parse_args()
    update_set = set(x.strip().lower() for x in (args.update or "schedule").split(","))
    if "all" in update_set:
        update_set = {"schedule", "participants", "speakers", "organizers"}

    headers = {"User-Agent": DEFAULT_UA, "Accept-Language": "ru,en;q=0.9"}

    # ===== SCHEDULE =====
    if "schedule" in update_set:
        if not (args.program_url or args.program_file):
            print(
                "ERROR: for schedule you must pass --program-url or --program-file",
                file=sys.stderr,
            )
            sys.exit(2)
        html = fetch_html(args.program_url or None, args.program_file or None, headers)
        date_for_uid = args.date or guess_date(html)
        events = parse_program_t521(html, date_for_uid=date_for_uid)
        schedule = {
            "generated_at": ts_iso(),
            "source_url": args.program_url or f"file://{args.program_file}",
            "date": date_for_uid,
            "events": events,
        }
        out_path = args.out_schedule or safe_join(args.data_dir, "schedule.json")
        write_json(out_path, schedule)
        print(f"OK: schedule → {out_path} (events: {len(events)})")

    # ===== PARTICIPANTS =====
    if "participants" in update_set:
        url = args.participants_url
        if not (url or args.participants_file):
            print("WARN: participants skipped (no url/file)")
        else:
            if args.participants_file:
                text = fetch_html(None, args.participants_file, headers)
                soup = BeautifulSoup(text, "html.parser")
                cards = soup.select(
                    ".t844 .t844__col, li.t844__col, li[class*='t844__col'], .t-card__col.t844__col"
                )
                items = []
                for c in cards:
                    it = extract_participant_card(c)
                    if it:
                        items.append(it)
                # uniq
                seen, uniq = set(), []
                for it in items:
                    u = it["url"]
                    if u not in seen:
                        seen.add(u)
                        uniq.append(it)
                items = uniq
            else:
                items = parse_participants_t844(url, headers)
            payload = {
                "generated_at": ts_iso(),
                "source_url": url or f"file://{args.participants_file}",
                "items": items,
            }
            out_path = args.out_participants or safe_join(
                args.data_dir, "participants.json"
            )
            write_json(out_path, payload)
            print(f"OK: participants → {out_path} (items: {len(items)})")

    # ===== SPEAKERS =====
    if "speakers" in update_set:
        url = args.speakers_url
        if not (url or args.speakers_file):
            print("WARN: speakers skipped (no url/file)")
        else:
            if args.speakers_file:
                html = fetch_html(None, args.speakers_file, headers)
                soup = BeautifulSoup(html, "html.parser")
                cards = soup.find_all(
                    lambda tag: tag.name in ("li", "div")
                    and tag.has_attr("class")
                    and any("t524__col" in c for c in tag.get("class", []))
                )
                items = []
                for card in cards:
                    name = None
                    n = card.select_one(".t524__personname") or card.select_one(
                        ".t-name, .t-title, h3, h4, strong"
                    )
                    if n:
                        name = norm_ws(n.get_text())
                    if not name:
                        continue
                    desc = None
                    d = card.select_one(".t524__persdescr")
                    if d:
                        cand = norm_ws(d.get_text(" "))
                        if cand:
                            cut = re.split(r"(?<=[.!?…])\s+", cand, maxsplit=1)[0]
                            desc = (
                                (cut[:350].rstrip(" ,;:") + "…")
                                if len(cand) > 350
                                else cut
                            )
                    photo = None
                    m = card.select_one('meta[itemprop="image"]')
                    if m and m.get("content"):
                        photo = clean_url((m["content"] or "").strip())
                    if not photo:
                        img = card.select_one("img")
                        if img:
                            photo = get_img_url(img)
                    if not photo:
                        photo = get_img_url(card)
                    items.append({"name": name, "description": desc, "photo": photo})
                seen, uniq = set(), []
                for it in items:
                    key = (it.get("name"), it.get("photo"))
                    if key not in seen:
                        seen.add(key)
                        uniq.append(it)
                items = uniq
            else:
                items = parse_speakers_t524(url, headers)
            payload = {
                "generated_at": ts_iso(),
                "source_url": url or f"file://{args.speakers_file}",
                "items": items,
            }
            out_path = args.out_speakers or safe_join(args.data_dir, "speakers.json")
            write_json(out_path, payload)
            print(f"OK: speakers → {out_path} (items: {len(items)})")

    # ===== ORGANIZERS =====
    if "organizers" in update_set:
        url = args.organizers_url
        if not (url or args.organizers_file):
            print("WARN: organizers skipped (no url/file)")
        else:
            if args.organizers_file:
                text = fetch_html(None, args.organizers_file, headers)
                soup = BeautifulSoup(text, "html.parser")
                cards = soup.select(
                    ".t844 .t844__col, li.t844__col, li[class*='t844__col'], .t-card__col.t844__col"
                )
                items = []
                for c in cards:
                    it = extract_participant_card(c)
                    if it:
                        items.append(it)
                seen, uniq = set(), []
                for it in items:
                    u = it["url"]
                    if u not in seen:
                        seen.add(u)
                        uniq.append(it)
                items = uniq
            else:
                items = parse_participants_t844(url, headers)
            payload = {
                "generated_at": ts_iso(),
                "source_url": url or f"file://{args.organizers_file}",
                "items": items,
            }
            out_path = args.out_organizers or safe_join(
                args.data_dir, "organizers.json"
            )
            write_json(out_path, payload)
            print(f"OK: organizers → {out_path} (items: {len(items)})")

    print("DONE")


if __name__ == "__main__":
    try:
        main()
    except Exception as e:
        print("ERROR:", e, file=sys.stderr)
        sys.exit(2)
