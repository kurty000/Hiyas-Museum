# Hiyas Museum ESP32 + SIM800L

## Alert → SMS flow

1. ESP uploads sensor data to RTDB `/liveSensors/{DEVICE_ID}`
2. Website evaluates thresholds and **creates an alert**
3. Website writes RTDB `/smsCommands/{DEVICE_ID}` (`sent: false`, message, to, alertId)
4. ESP polls that path and **only then** sends SMS via SIM800L
5. ESP marks `sent: true` (dashboard toast confirms), then deletes the command on the next poll

ESP does **not** SMS on local critical by itself.
DHT `nan` readings reuse the last good temp/humidity so heartbeat / motion / distance still upload.

## Wiring

| Device | ESP32 |
|--------|-------|
| PIR | IO13 |
| DHT11 | IO15 |
| TRIG / ECHO | IO4 / IO5 |
| SIM800L RX ← | IO16 (TX) |
| SIM800L TX → | IO17 (RX) |
| SIM800L VCC | separate **5V_GSM** |

## Numbers

- Receiver: `+639602990107` (09602990107)
- Set by the website in the SMS command (`to` field)

## Serial (115200)

- `Firebase live: 200` — sensor upload OK
- `[SMS] poll body: {...}` — ESP sees the website queue entry
- `[SMS] Website alert command received` — site queued a text
- `[SIM] SMS OK` — SIM800L sent it
- `Firebase SMS ack: 200` — ESP marked `sent: true` in RTDB
- `Firebase SMS clear: 200` — ESP removed the command after ack

## Retest checklist (no SMS received)

1. Open the live dashboard while logged in.
2. Acknowledge any open alert for the sensor, then clear the breach (move away / stop motion) so the event can fire again.
3. Trigger a **new** breach (proximity/distance/temp/humidity).
4. Confirm toast: **SMS queued for SIM800L — waiting for ESP…**
5. In Firebase RTDB Console → `smsCommands/esp32_gallery_a_1` should show `sent: false`, then `sent: true`, then disappear.
6. Serial should show `[SIM] SMS OK` and `Firebase SMS ack: 200`; phone **09602990107** should receive the text.
7. If the queue stays at `sent: false`, the website/Firebase side is fine — reflash this sketch, check WiFi `Free_Wifi`, SIM800L **5V_GSM** + TX/RX (IO16/IO17), and Serial for `[SMS] poll body` / `[SIM] SMS FAILED`.
