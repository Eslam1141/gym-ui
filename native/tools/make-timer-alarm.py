"""Synthesises native/android/app/src/main/res/raw/timer_alarm.wav, the sound
of the `timer-alarm` notification channel (see scheduleRestNotification in
app.js). Same two-tone pattern as the in-app alarm: four pulses, 880 Hz and
1175 Hz alternating, then a short pause. 16-bit mono PCM, no dependencies.

    python native/tools/make-timer-alarm.py
"""
import math
import os
import struct
import wave

RATE = 22050
PULSE, GAP, TAIL = 0.20, 0.10, 0.60  # seconds
FREQS = [880, 1175, 880, 1175]
VOLUME = 0.8
EDGE = 0.012  # fade in/out so the pulses don't click

samples = []
for f in FREQS:
    n = int(RATE * PULSE)
    for i in range(n):
        t = i / RATE
        env = min(1.0, t / EDGE, (PULSE - t) / EDGE)
        # triangle wave: loud and clear, softer than a square
        ph = (t * f) % 1.0
        tri = 4 * abs(ph - 0.5) - 1
        samples.append(int(32767 * VOLUME * env * tri))
    samples.extend([0] * int(RATE * GAP))
samples.extend([0] * int(RATE * TAIL))

out = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "android", "app", "src", "main", "res", "raw", "timer_alarm.wav")
os.makedirs(os.path.dirname(out), exist_ok=True)
with wave.open(out, "wb") as w:
    w.setnchannels(1)
    w.setsampwidth(2)
    w.setframerate(RATE)
    w.writeframes(struct.pack("<%dh" % len(samples), *samples))
print(out, len(samples) / RATE, "s")
