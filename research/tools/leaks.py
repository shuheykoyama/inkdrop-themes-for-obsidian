import csv,re,sys
"""List semantic tokens whose (dark-branch) resolution reaches base primitive ramps the theme did not override."""
f,mode=sys.argv[1],sys.argv[2]
rows={r['token']:r for r in csv.DictReader(open(f))}
def dark(v):
    # pick dark branch of light-dark(a,b) textually
    while 'light-dark(' in v:
        i=v.index('light-dark('); j=i+len('light-dark('); d=1; k=j; parts=[]; cur=j
        while d:
            c=v[k]
            if c=='(': d+=1
            elif c==')': d-=1
            elif c==',' and d==1: parts.append(v[cur:k]); cur=k+1
            k+=1
        parts.append(v[cur:k-1]); v=v[:i]+parts[-1]+v[k:]
    return v
memo={}
def prims(t,seen=()):
    if t in memo: return memo[t]
    r=rows.get(t); out=set()
    if r is None or t in seen: return out
    if re.match(r'--(hsl|color)-[a-z]+-\d+$|--(hsl|color)-(black|white)$',t):
        if r['source']=='base': out.add(t)
        memo[t]=out; return out
    for ref in re.findall(r'var\(\s*(--[\w-]+)',dark(r['raw_value'])):
        out|=prims(ref,seen+(t,))
    memo[t]=out; return out
skip=re.compile(r'--(hsl|color)-|--tag-|--kanagawa-')
res={}
for t,r in rows.items():
    if skip.match(t): continue
    p={x for x in prims(t) if not re.search(r'-(black|white)$',x)}
    if p: res[t]=p
print(len(res))
for t in sorted(res): print(t, '->', ','.join(sorted(res[t])), '=', rows[t]['resolved_value'][:50], '['+rows[t]['source']+']')
