import re, sys, os, glob
R = sys.argv[1]
files = {os.path.basename(f)[:2]: f for f in glob.glob(R + '/0*.md')}
text = {k: open(v).read() for k, v in files.items()}
text['RM'] = open(R + '/README.md').read()
# sections per doc
secs = {}
for k, t in text.items():
    s = set()
    for m in re.finditer(r'^#{2,4}\s+(\d+(?:\.\d+)*)\.?\s', t, re.M):
        s.add(m.group(1))
    secs[k] = s
ids06 = set(re.findall(r'^\| ([WNEGO]\d\d) \|', text['06'], re.M))
qd = set(re.findall(r'^\| (Q-D\d+) \|', text['09'], re.M))
vv = set(re.findall(r'^\| (V-\d+) \|', text['09'], re.M))
uu = set(re.findall(r'^\| (U-\d+) \|', text['09'], re.M))
rr = set(re.findall(r'^\| (R\d\d) \|', text['07'], re.M))
print('06 ids', len(ids06), 'QD', len(qd), 'V', len(vv), 'U', len(uu), 'R', len(rr))
def unk_items(t):
    m = re.search(r'^## 未確認事項\s*\n(.*?)(?=^## |\Z)', t, re.M | re.S)
    if not m: return 0
    return len(re.findall(r'^\d+\.', m.group(1), re.M))
probs = []
for k, t in text.items():
    for ln, line in enumerate(t.split('\n'), 1):
        # doc § refs
        for m in re.finditer(r'(?<![\w@/.-])(0\d) ((?:§[\d.]+(?:・|、)?)+)', line):
            d = m.group(1)
            for s in re.findall(r'§(\d+(?:\.\d+)?)', m.group(2)):
                if d not in secs or s not in secs[d]:
                    probs.append((k, ln, f'{d} §{s} missing', line[:160]))
        for m in re.finditer(r'(0\d) §未確認事項 ([\d・]+)', line):
            n = unk_items(text[m.group(1)])
            for x in m.group(2).split('・'):
                if int(x) > n: probs.append((k, ln, f'{m.group(1)} 未確認事項 {x} > {n}', line[:160]))
        for m in re.finditer(r'(?<![\w-])([WNEGO]\d\d)(?![\w])', line):
            if m.group(1) not in ids06 and k in ('06','07','08','09','RM'):
                probs.append((k, ln, f'06 id {m.group(1)} missing', line[:160]))
        for m in re.finditer(r'Q-D(\d+)', line):
            if 'Q-D'+m.group(1) not in qd: probs.append((k, ln, 'QD missing', line[:120]))
        for m in re.finditer(r'(?<![\w-])V-(\d+)', line):
            if 'V-'+m.group(1) not in vv: probs.append((k, ln, 'V missing V-'+m.group(1), line[:120]))
        for m in re.finditer(r'(?<![\w-])U-(\d+)', line):
            if 'U-'+m.group(1) not in uu: probs.append((k, ln, 'U missing', line[:120]))
        for m in re.finditer(r'(?<![\w-])R(\d\d)(?!\d)', line):
            if 'R'+m.group(1) not in rr: probs.append((k, ln, 'R missing R'+m.group(1), line[:120]))
        # self refs bare § (not preceded by doc number)
        for m in re.finditer(r'(?<!0\d )(?<!・)§(\d+(?:\.\d+)?)', line):
            if k in secs and m.group(1) not in secs[k] and k!='RM':
                probs.append((k, ln, f'self §{m.group(1)} missing?', line[:160]))
for p in probs: print(p)
