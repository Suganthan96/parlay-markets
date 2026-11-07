#!/bin/sh
# Pitch showreel + app demo + terminal demo -> one 4:00 silent video.
# Frozen stretches are cut from the demo, then the demo is sped up to land on 240s.
set -e
D=$HOME/Downloads
OUT=out/parlay-markets-4min.mp4
PITCH=out/parlay-markets-showreel-silent.mp4
DEMO=$D/export-1794015038891.mp4
TERM=$D/export-1794016469214.mp4

# Seconds of the demo to drop (frozen frames; a short beat of each is kept).
CUTS="39.2:43.6 48.1:49.5 58.1:59.4 118.2:120.7 126.6:129.3"
DEMO_LEN=174.8; TERM_LEN=40.1667; PITCH_LEN=60; TOTAL=240

KEEP=$(echo "$CUTS" | tr ' ' '\n' | awk -F: -v len=$DEMO_LEN 'BEGIN{p=0} {printf "%s:%s ", p, $1; p=$2} END{printf "%s:%s", p, len}')
CUT_SUM=$(echo "$CUTS" | tr ' ' '\n' | awk -F: '{s+=$2-$1} END{print s}')
SPEED=$(awk -v d=$DEMO_LEN -v c=$CUT_SUM -v t=$TERM_LEN -v p=$PITCH_LEN -v T=$TOTAL 'BEGIN{printf "%.5f", (d-c)/(T-p-t)}')
echo "keep: $KEEP"; echo "cut ${CUT_SUM}s, demo speed x$SPEED"

F=""; N=0; LABELS=""
for k in $KEEP; do
  S=${k%%:*}; E=${k##*:}
  F="$F[1:v]trim=start=$S:end=$E,setpts=PTS-STARTPTS[k$N];"
  LABELS="$LABELS[k$N]"; N=$((N+1))
done
F="$F${LABELS}concat=n=$N:v=1:a=0,setpts=PTS/$SPEED,fps=30,scale=1920:1080,setsar=1[demo];"
F="$F[0:v]fps=30,scale=1920:1080,setsar=1[pitch];"
F="$F[2:v]fps=30,scale=1920:1080,setsar=1[term];"
F="$F[pitch][demo][term]concat=n=3:v=1:a=0,format=yuv420p[v]"

ffmpeg -hide_banner -loglevel error -stats -y -i $PITCH -i $DEMO -i $TERM \
  -filter_complex "$F" -map "[v]" -an -t $TOTAL -c:v libx264 -crf 18 -preset medium -movflags +faststart $OUT
ffprobe -v error -show_entries format=duration -of csv=p=0 $OUT
