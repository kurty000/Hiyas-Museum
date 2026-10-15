# Hiyas Museum ESP32 + SIM800L

## Alert → SMS flow

1. ESP uploads sensor data to RTDB `/liveSensors/{DEVICE_ID}`
2. Website evaluates thresholds and **creates an alert**
3. Website writes RTDB `/smsCommands/{DEVICE_ID}` (`sent: false`, message, to)
4. ESP polls that path and **only then** sends SMS via SIM800L
5. ESP marks the command `sent: true`

ESP does **not** SMS on local critical by itself.

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
- `[SMS] Website alert command received` — site queued a text
- `[SIM] SMS OK` — SIM800L sent it
