# Hiyas Museum ESP32 sensor node

Uploads live readings to Firebase RTDB `/liveSensors/{DEVICE_ID}`.

## Pins

| Device | ESP32 |
|--------|-------|
| PIR | IO13 |
| DHT11 | IO15 |
| HC-SR04 TRIG | IO4 |
| HC-SR04 ECHO | IO5 |

`DEVICE_ID` must match the registered sensor id on the website (e.g. `esp32_gallery_a_1`).

## Notes

- Serial Monitor baud: **115200**
- Includes a rising `heartbeat` field so the site stays Online when readings are stable
- Expect `Firebase: 200` every ~5 seconds when DHT reads are valid
