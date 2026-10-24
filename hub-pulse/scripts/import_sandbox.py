"""Convert the hackathon sandbox files in ../material into src/lib/sandbox.json.

Run from the hub-pulse folder:  python3 scripts/import_sandbox.py
Needs openpyxl (pip install openpyxl).
"""
import datetime
import json
import re
import unicodedata
from pathlib import Path
from zoneinfo import ZoneInfo

import openpyxl

ROOT = Path(__file__).resolve().parent.parent
MATERIAL = ROOT.parent / 'material'
OUT = ROOT / 'src' / 'lib' / 'sandbox.json'
LJ = ZoneInfo('Europe/Ljubljana')
TIERS = {'GO!': 'ShapersGO', 'Impact': 'Shapers Impact', 'Core': 'Shapers Core'}
STATES = {'present': 'present', 'remote': 'remote', 'excused': 'excused', 'unexcused': 'missed'}
CURRENT_WEEK_START = datetime.date(2026, 10, 19)


def slug(text):
    text = unicodedata.normalize('NFKD', text).encode('ascii', 'ignore').decode()
    return re.sub(r'[^a-z0-9]+', '-', text.lower()).strip('-')


def rows(name):
    sheet = openpyxl.load_workbook(MATERIAL / name, data_only=True).active
    header, *body = list(sheet.iter_rows(values_only=True))
    return [dict(zip(header, r)) for r in body if any(r)]


def member_id(email):
    return email.split('@')[0]


roster = rows('roster.xlsx')
members = []
series_members = {}
for r in roster:
    mid = member_id(r['email'])
    series = [s.strip() for s in r['series'].split(';')]
    for s in series:
        series_members.setdefault(s, []).append(mid)
    members.append({
        'id': mid,
        'name': r['name'],
        'email': r['email'],
        'initials': ''.join(p[0] for p in r['name'].split()[:2]).upper(),
        'tier': TIERS[r['tier']],
        'isAdmin': str(r['admin']).lower() == 'yes',
        'series': [slug(s) for s in series],
    })

hours = {}
for r in rows('hours.xlsx'):
    week = r['week_start'].date()
    hours.setdefault(member_id(r['email']), {})[week] = float(r['hours'])
for m in members:
    weeks = hours.get(m['id'], {})
    m['pastWeeks'] = [weeks[w] for w in sorted(weeks) if w < CURRENT_WEEK_START]
    m['currentWeek'] = weeks.get(CURRENT_WEEK_START, 0.0)

ics = (MATERIAL / 'meetings.ics').read_text().replace('\r\n ', '').replace('\n ', '')
meetings = []
for block in re.findall(r'BEGIN:VEVENT(.*?)END:VEVENT', ics, re.S):
    field = lambda key: re.search(rf'^{key}:(.*)$', block, re.M).group(1).strip()
    start = datetime.datetime.strptime(field('DTSTART'), '%Y%m%dT%H%M%SZ').replace(tzinfo=datetime.timezone.utc).astimezone(LJ)
    end = datetime.datetime.strptime(field('DTEND'), '%Y%m%dT%H%M%SZ').replace(tzinfo=datetime.timezone.utc).astimezone(LJ)
    meetings.append({
        'id': field('UID').split('@')[0],
        'seriesId': slug(field('CATEGORIES')),
        'date': start.date().isoformat(),
        'start': start.strftime('%H:%M'),
        'end': end.strftime('%H:%M'),
    })
meetings.sort(key=lambda m: (m['date'], m['start']))

series = [{'id': slug(name), 'name': name, 'invited': ids} for name, ids in series_members.items()]

by_series_date = {(m['seriesId'], m['date']): m['id'] for m in meetings}
attendance = []
for r in rows('attendance flat.xlsx'):
    key = (slug(r['series']), r['date'].date().isoformat())
    attendance.append({'meetingId': by_series_date[key], 'memberId': member_id(r['email']), 'status': STATES[r['state']]})

OUT.write_text(json.dumps({'members': members, 'series': series, 'meetings': meetings, 'attendance': attendance}, ensure_ascii=False, indent=1))
print(f'{len(members)} members, {len(series)} series, {len(meetings)} meetings, {len(attendance)} attendance records -> {OUT}')
