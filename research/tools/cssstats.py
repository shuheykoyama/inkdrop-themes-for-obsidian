import re,sys
# Measurement method: strip /* */ comments, then a linear brace scanner.
# For every block whose prelude does not start with '@', split body on ';' (top-level of that block only)
# and classify declarations as custom property (--x) or regular property.
def scan(t):
    stack=[];buf='';blocks=[]
    cur=[]  # per-depth body text
    preludes=[]
    for ch in t:
        if ch=='{':
            preludes.append(buf.strip()); cur.append(''); buf=''
        elif ch=='}':
            body=cur.pop()+buf; pre=preludes.pop(); buf=''
            blocks.append((pre,body))
        else:
            if ch==';' and cur:
                cur[-1]+=buf+';'; buf=''
            else: buf+=ch
            # when nested block opens, text before '{' is prelude; flush pending decls of parent already handled via ';'
    return blocks
for p in sys.argv[1:]:
    raw=open(p,encoding='utf-8',errors='replace').read()
    t=re.sub(r'/\*.*?\*/','',raw,flags=re.S)
    blocks=scan(t)
    nd=nc=0;varonly=direct=0;nrules=0
    for pre,body in blocks:
        if pre.startswith('@'): continue
        nrules+=1
        ds=[d.split(':',1)[0].strip() for d in body.split(';') if ':' in d]
        ds=[d for d in ds if re.fullmatch(r'-?-?[\w-]+',d)]
        c=sum(1 for d in ds if d.startswith('--')); nd+=len(ds); nc+=c
        if ds:
            if c==len(ds): varonly+=1
            else: direct+=1
    print(f"{p.split('/repos/')[-1]} | lines={raw.count(chr(10))} | style_rules={nrules} | decls={nd} | custom_prop_decls={nc} | regular_decls={nd-nc} | !important={t.count('!important')} | rules_var_only={varonly} | rules_with_regular_props={direct} | .cm-*refs={len(re.findall(r'[.]cm-[A-Za-z0-9_-]+',t))} | .theme-dark refs={t.count('.theme-dark')} | .theme-light refs={t.count('.theme-light')}")
