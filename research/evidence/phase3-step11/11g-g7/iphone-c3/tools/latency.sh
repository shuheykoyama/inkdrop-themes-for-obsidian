#!/bin/zsh
# Times dvt screenshots per open note and samples the Mac-side CPU of the relays and of each screenshot process.
# usage: latency.sh <host> <rsdPort> <outDir>
host=$1 port=$2 out=$3
dev=$(dirname $0)
mkdir -p $out
relaycpu() { ps -Ao pcpu,command | grep -E "pymobiledevice3 (remote start-tunnel|webinspector cdp)" | grep -v grep | awk '{printf "%s ", $1}'; }
for note in "Sample note.md" "Mermaid.md" "Sample note.md" "Mermaid.md"; do
  node $dev/open-note.mjs 9244 "$note"
  sleep 8
  for k in 1 2 3 4; do
    r=$( { /usr/bin/time -p pymobiledevice3 developer dvt screenshot --rsd $host $port $out/s.png >/dev/null; } 2>&1 | awk '/^(real|user|sys)/{printf "%s=%s ", $1, $2}')
    echo "$note #$k $r relays%=[$(relaycpu)] load=$(sysctl -n vm.loadavg | awk '{print $2}')"
  done
done
