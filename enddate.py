import datetime

with open('corrects') as fh:
    words = [l for l in fh.readlines() if l.strip() != '']

end_date = datetime.date(2024, 11, 14) + datetime.timedelta(days=len(words))
print(end_date.isoformat())
print('days: ', end_date - datetime.date.today())
