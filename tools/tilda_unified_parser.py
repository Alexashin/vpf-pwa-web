#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import argparse, json, os, re, unicodedata
from datetime import datetime, timezone
from typing import Optional, Tuple, List, Dict
from bs4 import BeautifulSoup, Tag
import requests

# ---------- Настройки ----------
ALLOWED_TAGS = {"p","ul","ol","li","br","b","strong","i","em","h3","h4"}
TIMEOUT = 30
UA = ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
      "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36")

TIME_RE = re.compile(r"(?P<start>\d{1,2}:\d{2})\s*[–—-]\s*(?P<end>\d{1,2}:\d{2})")
DATE_NUM_RE = re.compile(r"\b(\d{1,2})[./-](\d{1,2})[./-](\d{2,4})\b")
MONTHS_RU = {"январ":"01","феврал":"02","март":"03","апрел":"04","ма":"05","июн":"06","июл":"07",
             "август":"08","сентябр":"09","октябр":"10","ноябр":"11","декабр":"12"}
MONTH_RE = re.compile(r"\b(\d{1,2})\s+([А-Яа-яЁё]+)\s+(\d{4})\b")

def ts_iso() -> str:
    return datetime.now(timezone.utc).isoformat()

def norm_ws(s: str) -> str:
    if not s: return ""
    # NBSP -> space, normalize dashes, collapse spaces but keep paragraph breaks
    s = s.replace("\xa0", " ").replace("\r", "")
    s = s.replace("–", "—").replace(" - ", " — ")
    # убираем лишние пробелы в строках
    lines = [re.sub(r"[ \t]+", " ", ln).strip() for ln in s.split("\n")]
    # схлопываем пустые группы в одиночные пустые строки
    out, blank = [], False
    for ln in lines:
        if ln:
            out.append(ln); blank=False
        else:
            if not blank: out.append(""); blank=True
    return "\n".join(out).strip()

def safe_text(node: Tag) -> str:
    # Плэйн-текст с аккуратными маркерами для <li>
    buf: List[str] = []
    for el in node.descendants:
        if isinstance(el, Tag):
            if el.name in ("ul","ol"):
                pass
            elif el.name == "li":
                t = norm_ws(el.get_text(" ", strip=True))
                if t: buf.append(f"• {t}")
        # пропускаем скрипты/стили
    flat = norm_ws(node.get_text("\n", strip=True))
    # если списков не было, оставим исходный flat
    if buf:
        # Собираем абзацы без дублирования
        base = [ln for ln in flat.split("\n") if ln]
        seen = set(base)
        for b in buf:
            if b not in seen:
                base.append(b); seen.add(b)
        return "\n".join(base)
    return flat

def clean_html_block(node: Tag) -> str:
    # вырезаем скрипты/стили/лишние атрибуты, оставляем только ALLOWED_TAGS
    for tag in node(["script","style"]):
        tag.decompose()
    # клонировать не будем — обнулим атрибуты in-place
    for el in node.find_all(True):
        if el.name not in ALLOWED_TAGS:
            # разворачиваем неизвестные теги в их текст (но не теряем содержимое)
            el.unwrap()
        else:
            # оставляем только безопасные атрибуты (ни одного)
            el.attrs = {}
    html = str(node)
    # вычленяем без внешней обёртки (берём innerHTML)
    return "".join(str(c) for c in node.contents)

def inner(node: Tag) -> str:
    return "".join(str(c) for c in node.contents)

def guess_date(html: str) -> Optional[str]:
    m = DATE_NUM_RE.search(html)
    if m:
        d, mo, y = m.groups()
        y = ("20"+y) if len(y)==2 else y
        return f"{int(y):04d}-{int(mo):02d}-{int(d):02d}"
    m = MONTH_RE.search(html)
    if m:
        d, mon, y = int(m.group(1)), m.group(2).lower(), int(m.group(3))
        for stem, num in MONTHS_RU.items():
            if mon.startswith(stem):
                return f"{y:04d}-{num}-{d:02d}"
    return None

def split_time_place(left_text: str) -> Tuple[Optional[str], Optional[str]]:
    lines = [ln.strip() for ln in left_text.split("\n") if ln.strip()]
    if not lines: return None, None
    time_line = lines[0]
    place = " ".join(lines[1:]) if len(lines)>1 else None
    return time_line, place

def parse_time_range(time_range: Optional[str]) -> Tuple[Optional[str], Optional[str]]:
    if not time_range: return None, None
    m = TIME_RE.search(time_range)
    if not m: return None, None
    return m.group("start"), m.group("end")

def slugify(text: str, max_len: int = 100) -> str:
    text = unicodedata.normalize("NFKD", text)
    text = re.sub(r"[^\w\s-]", "", text, flags=re.U)
    text = re.sub(r"[\s_-]+", "-", text, flags=re.U)
    return text.strip("-").lower()[:max_len] or "item"

# -------- спикеры/тезисы --------
ROLE_PAT = re.compile(r"^(Модератор|Спикер|Ведущий)\s*:?\s*", re.I)
NAME_POS_PAT = re.compile(r"^([А-ЯA-ZЁ][^,]+),\s*(.+)$")
TOPIC_PAT = re.compile(r"^\s*(Тема|Доклад|Выступление)\s*:?\s*[«\"]?(.+?)[»\"]?\s*$", re.I)
QUOTE_SUBTITLE = re.compile(r"^«.+»$")

def extract_title_and_subtitle(right: Tag) -> Tuple[Optional[str], Optional[str]]:
    # title: h3/h4/strong/b (первая)
    ttl = None
    head = right.select_one("h3, h4, strong, b")
    if head:
        ttl = norm_ws(head.get_text(" ", strip=True))
    # subtitle: строка в кавычках (первая подходящая не из заголовка)
    subtitle = None
    lines = [ln for ln in norm_ws(right.get_text("\n", strip=True)).split("\n") if ln]
    for ln in lines:
        if ttl and ln == ttl: 
            continue
        if QUOTE_SUBTITLE.match(ln):
            subtitle = ln.strip()
            break
    return ttl, subtitle

def extract_topics_and_speakers(right: Tag) -> Tuple[List[str], List[Dict]]:
    topics: List[str] = []
    speakers: List[Dict] = []
    # берём параграфы и элементы списка как атомарные строки
    atoms: List[str] = []
    for el in right.find_all(["p","li","h3","h4","strong","b"]):
        txt = norm_ws(el.get_text(" ", strip=True))
        if txt: atoms.append(txt)

    current_role = None
    for ln in atoms:
        # роли (Модератор/Спикер/Ведущий:)
        m_role = ROLE_PAT.match(ln)
        if m_role:
            role = m_role.group(1).capitalize()
            rest = ROLE_PAT.sub("", ln).strip(" :")
            current_role = role
            # возможно, сразу "Модератор: ФИО, должность"
            m_np = NAME_POS_PAT.match(rest)
            if m_np:
                speakers.append({"name": m_np.group(1).strip(),
                                 "position": m_np.group(2).strip(),
                                 "role": role})
            elif rest:
                speakers.append({"name": rest, "role": role})
            continue

        # Тема: ...
        m_topic = TOPIC_PAT.match(ln)
        if m_topic:
            topics.append(m_topic.group(2).strip())
            # если следующая строка будет ФИО — прикрепим тему туда
            continue

        # "ФИО, должность"
        m_np = NAME_POS_PAT.match(ln)
        if m_np and len(m_np.group(1).split()) <= 5:
            speakers.append({"name": m_np.group(1).strip(),
                             "position": m_np.group(2).strip(),
                             "role": current_role})
            continue

        # Просто отдельный тезис (фильтруем явный «ПРИВЕТСТВЕННОЕ СЛОВО», и т.п. — оставим, это полезно)
        if ln and len(ln) >= 3:
            topics.append(ln)

    # пост-обработка: склеим подряд идущие части, уберём дубли
    def dedup(seq):
        seen=set(); out=[]
        for x in seq:
            if x not in seen:
                seen.add(x); out.append(x)
        return out
    topics = dedup(topics)
    # переносим явно привязанные "Тема: ..." к соседнему спикеру, если следующая запись — имя
    for i, t in enumerate(list(topics)):
        if TOPIC_PAT.match("Тема: "+t) and i+1 < len(speakers) and not speakers[i].get("topic"):
            speakers[i]["topic"] = t

    return topics, speakers

def fetch_html(url: Optional[str], file_path: Optional[str]) -> str:
    if file_path:
        with open(file_path, "r", encoding="utf-8") as f:
            return f.read()
    if not url:
        raise ValueError("URL is required if no file provided")
    r = requests.get(url, headers={"User-Agent": UA}, timeout=TIMEOUT)
    r.raise_for_status()
    r.encoding = r.apparent_encoding or "utf-8"
    return r.text

def parse_program(html: str) -> Dict:
    soup = BeautifulSoup(html, "lxml")  # lxml — стабильнее
    date = guess_date(html)

    events: List[Dict] = []
    for row in soup.select("div.t521__row"):
        left = row.select_one(".t521__time")
        right = row.select_one(".t521__text")
        if not right:
            continue

        # аккуратный HTML и plain-text
        html_block = BeautifulSoup(inner(right), "lxml")
        html_clean = clean_html_block(html_block)
        text_plain = safe_text(html_block)

        title, subtitle = extract_title_and_subtitle(right)
        topics, speakers = extract_topics_and_speakers(right)

        if not left:
            events.append({
                "type": "info",
                "time": None, "start": None, "end": None, "location": None,
                "title": title or (topics[0] if topics else "Информация"),
                "subtitle": subtitle,
                "html": html_clean,
                "text": text_plain,
                "topics": topics,
                "speakers": speakers
            })
            continue

        left_text = norm_ws(left.get_text("\n", strip=True))
        time_range, place = split_time_place(left_text)
        start, end = parse_time_range(time_range)
        uid_base = f"{date or ''}_{start or ''}_{place or ''}_{title or ''}"
        uid = slugify(uid_base, 160)

        events.append({
            "type": "event",
            "uid": uid,
            "time": time_range,
            "start": start,
            "end": end,
            "location": place,
            "title": title or (topics[0] if topics else "Событие"),
            "subtitle": subtitle,
            "html": html_clean,
            "text": text_plain,
            "topics": topics,
            "speakers": speakers
        })

    return {
        "generated_at": ts_iso(),
        "source_url": None,
        "date": date,
        "events": events
    }

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--url", help="Tilda page URL")
    ap.add_argument("--file", help="Local HTML file")
    ap.add_argument("-o", "--output", default="schedule.json")
    args = ap.parse_args()

    html = fetch_html(args.url, args.file)
    data = parse_program(html)
    data["source_url"] = args.url
    with open(args.output, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    print(f"OK: wrote {args.output}")

if __name__ == "__main__":
    main()
